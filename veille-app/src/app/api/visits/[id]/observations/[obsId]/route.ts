import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser, teamScope } from "@/lib/auth";
import { PHONE_STATUSES } from "@/lib/s6a7";

/**
 * PATCH d'une observation existante.
 *
 * Couvre les deux modes :
 *  - CHECKLIST : met à jour status + comment (équivalent du POST existant
 *    mais ciblé par id, plus pratique côté client).
 *  - INVENTORY : enrichit avec present, quantityObserved,
 *    expirationDateObserved, discrepancyType. Le `status` est **dérivé
 *    automatiquement** côté serveur — pas besoin de le faire côté UI :
 *      * un écart → status = "NON"
 *      * pas d'écart et present=true → status = "OUI"
 *
 *  - `discrepancyType` peut être :
 *      * `null`     : on laisse le serveur recalculer (recommandé)
 *      * "NONE"     : on force « conforme » même si les chiffres divergent
 *      * "MISSING" | "EXPIRED" | "QUANTITY_LOW" | "DAMAGED" : forcé manuel
 */
const schema = z.object({
  // Champs CHECKLIST.
  status: z
    .enum([
      "OUI",
      "NON",
      "CONFORME",
      "NON_CONFORME",
      "SANS_OBJET",
      "PENDING",
    ])
    .optional(),
  comment: z.string().nullable().optional(),
  // Champs INVENTORY / petit matériel S6A7.
  present: z.boolean().nullable().optional(),
  quantityObserved: z.number().int().min(0).nullable().optional(),
  expirationDateObserved: z.string().datetime().nullable().optional(),
  discrepancyType: z
    .enum(["MISSING", "EXPIRED", "QUANTITY_LOW", "DAMAGED", "NONE"])
    .nullable()
    .optional(),
  // Champ téléphone de voie S6A7 (aucune action, même HS).
  phoneStatus: z.enum(PHONE_STATUSES).nullable().optional(),
});

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string; obsId: string }> }
) {
  let u;
  try {
    u = await requireUser();
  } catch (r) {
    return r as Response;
  }
  const { id: visitId, obsId } = await ctx.params;
  const scope = teamScope(u);
  const visit = await prisma.siteVisit.findFirst({
    where: { id: visitId, ...scope },
    select: {
      id: true,
      status: true,
      visitDate: true,
      template: { select: { kind: true } },
    },
  });
  if (!visit) return NextResponse.json({ error: "Inconnu" }, { status: 404 });
  if (visit.status === "completed" || visit.status === "archived") {
    const isAdmin = u.role === "ADMIN" || u.role === "EDITOR";
    if (!isAdmin) {
      return NextResponse.json(
        { error: "Visite clôturée — saisie verrouillée." },
        { status: 400 }
      );
    }
  }

  const existing = await prisma.siteVisitObservation.findFirst({
    where: { id: obsId, visitId },
    include: {
      equipment: {
        select: {
          id: true,
          itemKind: true,
          expectedQuantity: true,
          expirationDate: true,
        },
      },
    },
  });
  if (!existing)
    return NextResponse.json({ error: "Observation inconnue" }, { status: 404 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Requête invalide" }, { status: 400 });
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Données invalides", issues: parsed.error.flatten() },
      { status: 400 }
    );
  }
  const data = parsed.data;

  // Valeurs « après PATCH » utilisées pour le calcul d'écart.
  const present =
    data.present === undefined ? existing.present : data.present;
  const quantityObserved =
    data.quantityObserved === undefined
      ? existing.quantityObserved
      : data.quantityObserved;
  const expirationDateObserved =
    data.expirationDateObserved === undefined
      ? existing.expirationDateObserved
      : data.expirationDateObserved
      ? new Date(data.expirationDateObserved)
      : null;

  // Familles :
  //  - téléphone de voie (S6A7) : statut à 4 états, JAMAIS d'écart ni d'action ;
  //  - petit matériel (INVENTORY ou S6A7) : logique trousse de secours.
  const isPhone = existing.equipment?.itemKind === "PHONE";
  const isCatalog =
    visit.template.kind === "INVENTORY" || visit.template.kind === "S6A7";
  const isMaterielInventory = isCatalog && !isPhone;

  // phoneStatus : réservé aux téléphones ; conservé null ailleurs.
  const phoneStatus = isPhone
    ? data.phoneStatus === undefined
      ? existing.phoneStatus
      : data.phoneStatus
    : existing.phoneStatus;

  // Calcul auto du discrepancyType si non explicitement fourni.
  // Un téléphone n'a jamais d'écart : discrepancyType reste null (garantit
  // qu'aucune action n'est générée, même pour un téléphone HS).
  let discrepancyType: string | null;
  if (isPhone) {
    discrepancyType = null;
  } else if (data.discrepancyType !== undefined) {
    discrepancyType =
      data.discrepancyType === "NONE" ? null : data.discrepancyType;
  } else if (isMaterielInventory) {
    discrepancyType = computeDiscrepancy({
      present,
      quantityObserved,
      expirationDateObserved,
      expectedQuantity: existing.equipment?.expectedQuantity ?? null,
      visitDate: visit.visitDate,
    });
  } else {
    discrepancyType = existing.discrepancyType;
  }

  // Dérive le status (source d'agrégation côté stats).
  let status = data.status ?? existing.status;
  if (isPhone) {
    // OK uniquement si BON ; HS / difficultés d'émission ou réception → NON.
    status = phoneStatus === null || phoneStatus === "BON" ? "OUI" : "NON";
  } else if (isMaterielInventory) {
    if (discrepancyType === null && present !== false) {
      status = "OUI";
    } else if (discrepancyType || present === false) {
      status = "NON";
    } else if (present === null) {
      status = "PENDING";
    }
  }

  const updated = await prisma.siteVisitObservation.update({
    where: { id: obsId },
    data: {
      status,
      comment: data.comment === undefined ? undefined : data.comment,
      present,
      quantityObserved,
      expirationDateObserved,
      discrepancyType,
      phoneStatus,
      recordedAt: new Date(),
      recordedById: u.id,
    },
  });
  return NextResponse.json(updated);
}

/**
 * Calcule un écart à partir des valeurs en main. Ordre de priorité :
 *   MISSING > EXPIRED > QUANTITY_LOW
 * DAMAGED n'est jamais calculé automatiquement (saisie manuelle).
 */
function computeDiscrepancy(args: {
  present: boolean | null;
  quantityObserved: number | null;
  expirationDateObserved: Date | null;
  expectedQuantity: number | null;
  visitDate: Date;
}): string | null {
  if (args.present === false) return "MISSING";
  if (
    args.expirationDateObserved &&
    args.expirationDateObserved.getTime() < args.visitDate.getTime()
  ) {
    return "EXPIRED";
  }
  if (
    args.expectedQuantity != null &&
    args.quantityObserved != null &&
    args.quantityObserved < args.expectedQuantity
  ) {
    return "QUANTITY_LOW";
  }
  return null;
}
