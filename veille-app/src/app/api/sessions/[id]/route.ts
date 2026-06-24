import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser, teamScope } from "@/lib/auth";
import {
  defaultMessageFor,
  defaultTargetUrlFor,
  formatQuotedSnippet,
  joinActivityParts,
  recordActivitySafe,
} from "@/lib/activityFeed";

async function loadScoped(id: string, u: Awaited<ReturnType<typeof requireUser>>) {
  const scope = teamScope(u);
  return prisma.veilleSession.findFirst({
    where: { id, ...scope },
    include: {
      agent: true,
      observer: { select: { id: true, name: true } },
      poste: true,
      secteur: true,
      procedures: {
        include: {
          procedure: true,
          items: {
            include: {
              checklistItem: true,
              photos: { select: { id: true, storagePath: true, legend: true } },
            },
            orderBy: { id: "asc" },
          },
        },
      },
      photos: true,
      comments: { include: { author: { select: { id: true, name: true } } } },
    },
  });
}

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  let u;
  try {
    u = await requireUser();
  } catch (r) {
    return r as Response;
  }
  const { id } = await ctx.params;
  const s = await loadScoped(id, u);
  if (!s) return NextResponse.json({ error: "Inconnu" }, { status: 404 });
  return NextResponse.json(s);
}

const patchSchema = z.object({
  status: z.enum(["draft", "active", "completed", "archived"]).optional(),
  generalComment: z.string().nullable().optional(),
  agentId: z.string().nullable().optional(),
  posteId: z.string().nullable().optional(),
  secteurId: z.string().nullable().optional(),
  finishedAt: z.string().datetime().nullable().optional(),
});

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  let u;
  try {
    u = await requireUser();
  } catch (r) {
    return r as Response;
  }
  const { id } = await ctx.params;
  const existing = await loadScoped(id, u);
  if (!existing) return NextResponse.json({ error: "Inconnu" }, { status: 404 });
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Requête invalide" }, { status: 400 });
  }
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Données invalides", issues: parsed.error.flatten() },
      { status: 400 }
    );
  }
  const data = parsed.data;
  // Logique `finishedAt` :
  //  - status → completed : stamp = maintenant
  //  - status → active / draft : on EFFACE explicitement (`null`). Sans ça
  //    une réouverture laissait l'ancien horodatage de clôture et faisait
  //    croire que la session était toujours terminée côté rapports/feed.
  //  - status inchangé / pas fourni : on respecte le `finishedAt` du body
  //    s'il est là, sinon on n'écrit rien (`undefined` → Prisma ignore).
  const finishedAt =
    data.status === "completed"
      ? new Date()
      : data.status === "active" || data.status === "draft"
      ? null
      : data.finishedAt
      ? new Date(data.finishedAt)
      : undefined;
  // Garde-fou métier : la réouverture d'une session déjà clôturée est
  // une action sensible (le rapport associé peut avoir déjà servi en
  // formation). On la réserve aux ADMIN/EDITOR. Les autres rôles voient
  // le bouton désactivé côté UI ; le contrôle serveur ferme la porte.
  const reopening =
    existing.status === "completed" &&
    (data.status === "active" || data.status === "draft");
  if (reopening && u.role !== "ADMIN" && u.role !== "EDITOR") {
    return NextResponse.json(
      { error: "Réouverture réservée aux administrateurs et éditeurs." },
      { status: 403 },
    );
  }
  const updated = await prisma.veilleSession.update({
    where: { id },
    data: {
      status: data.status,
      generalComment: data.generalComment ?? undefined,
      agentId: data.agentId === undefined ? undefined : data.agentId,
      posteId: data.posteId === undefined ? undefined : data.posteId,
      secteurId: data.secteurId === undefined ? undefined : data.secteurId,
      finishedAt,
    },
  });

  // Audit log de la réouverture (la clôture est déjà tracée côté
  // activityFeed, mais la réversion mérite un log dédié pour pouvoir
  // remonter "qui a rouvert quoi quand").
  if (reopening) {
    await prisma.auditLog.create({
      data: {
        userId: u.id,
        userEmail: u.email,
        action: "SESSION_REOPENED",
        entity: "VeilleSession",
        entityId: id,
        details: JSON.stringify({
          previousStatus: existing.status,
          newStatus: data.status,
          agentId: existing.agentId,
        }),
      },
    });
  }

  // Flux d'activité équipe — uniquement à la transition vers `completed`.
  // L'écriture est non bloquante : un échec ne casse pas la mutation.
  if (data.status === "completed" && existing.status !== "completed") {
    const agentName = existing.agent
      ? `${existing.agent.lastName} ${existing.agent.firstName}`.trim()
      : "Sans agent";
    let itemsCount = 0;
    let nonConformitiesCount = 0;
    for (const po of existing.procedures) {
      for (const it of po.items) {
        itemsCount++;
        if (it.status === "NON_CONFORME") nonConformitiesCount++;
      }
    }
    // Enrichi C10 — message inclut les intitulés de procédures observées,
    // le bilan (points / NC) et le commentaire général. Cap 3 procédures
    // listées sinon "+N" pour rester sous la limite de payload push.
    const procedureTitles = existing.procedures
      .map((po) => po.procedure.title?.trim())
      .filter((t): t is string => Boolean(t));
    let procedurePart: string | null = null;
    if (procedureTitles.length > 0) {
      procedurePart =
        procedureTitles.length <= 3
          ? `Procédures : ${procedureTitles.join(", ")}.`
          : `Procédures : ${procedureTitles.slice(0, 3).join(", ")} (+${procedureTitles.length - 3}).`;
    }
    const statsPart =
      itemsCount > 0
        ? `${itemsCount} point${itemsCount > 1 ? "s" : ""}, ${nonConformitiesCount} NC.`
        : null;
    await recordActivitySafe({
      teamIds: [updated.teamId],
      actorId: u.id,
      actorName: u.name,
      type: "SESSION_FINISHED",
      entityType: "session",
      entityId: updated.id,
      entityLabel: agentName,
      message: joinActivityParts([
        defaultMessageFor({
          type: "SESSION_FINISHED",
          actorName: u.name,
          entityLabel: agentName,
        }),
        procedurePart,
        statsPart,
        formatQuotedSnippet(existing.generalComment),
      ]),
      targetUrl: `/sessions/${updated.id}/report`,
      metadata: {
        agentId: existing.agentId,
        procedureCount: existing.procedures.length,
        itemsCount,
        nonConformitiesCount,
      },
    });
  }

  return NextResponse.json(updated);
}

/**
 * Suppression d'une session de veille.
 *  - ?mode=soft (défaut) : status="archived". Le rapport n'apparaît plus
 *    dans les listes courantes mais reste consultable.
 *  - ?mode=hard : supprime la session et toutes ses observations (cascade
 *    Prisma) UNIQUEMENT si elle est `draft` ou `active` sans observation
 *    enregistrée. Bloqué pour les sessions `completed` (l'historique doit
 *    être préservé) — utiliser le soft.
 *  - Seul l'observer ou un ADMIN/EDITOR peut supprimer.
 */
export async function DELETE(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  let u;
  try {
    u = await requireUser();
  } catch (r) {
    return r as Response;
  }
  const { id } = await ctx.params;
  const url = new URL(req.url);
  const mode = url.searchParams.get("mode") ?? "soft";
  const session = await loadScoped(id, u);
  if (!session)
    return NextResponse.json({ error: "Inconnu" }, { status: 404 });

  const isOwner = session.observerId === u.id;
  const isAdmin = u.role === "ADMIN" || u.role === "EDITOR";
  if (!isOwner && !isAdmin) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  if (mode === "soft") {
    await prisma.veilleSession.update({
      where: { id },
      data: { status: "archived" },
    });
    return NextResponse.json({ ok: true });
  }

  // Hard : interdit sur session clôturée (historique à préserver).
  if (session.status === "completed") {
    return NextResponse.json(
      {
        error:
          "Session clôturée — utilisez l'archivage (mode soft) pour préserver l'historique.",
      },
      { status: 409 }
    );
  }
  // Compteur d'observations renseignées (autres que PENDING) — si > 0, refus.
  const filledObs = await prisma.observationItem.count({
    where: {
      procedureObservation: { sessionId: id },
      status: { not: "NON_OBSERVE" },
    },
  });
  if (filledObs > 0 && !isAdmin) {
    return NextResponse.json(
      {
        error: `Session contient ${filledObs} observation(s) saisie(s). Demande à un admin pour la supprimer.`,
      },
      { status: 409 }
    );
  }
  // Suppression cascade : Prisma cascade les ProcedureObservation -> ObservationItem.
  await prisma.veilleSession.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
