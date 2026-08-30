import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { canActOnTeam, requireRole, requireUser } from "@/lib/auth";
import type { SessionUser } from "@/lib/auth";

/**
 * Persistance serveur du plan de voies (synoptique), un document par équipe.
 *
 * GET  /api/synoptique/[key]        → lecture du plan de l'équipe (scope).
 * PUT  /api/synoptique/[key]        → enregistrement (EDITOR / ADMIN),
 *                                     verrou optimiste via `baseVersion`.
 *
 * Le document `doc` est stocké en JSON String (pas de type Json natif —
 * cohérence SQLite). Le viewer HTML (public/synoptique-secteur.html) appelle
 * ces routes ; hors application (artifact, hors ligne) il retombe sur l'état
 * embarqué du fichier.
 */

const KEY_RE = /^[a-z0-9][a-z0-9-]{0,59}$/;

/** Taille max du document sérialisé (garde-fou). */
const MAX_DOC_BYTES = 4 * 1024 * 1024;

/** Résout l'équipe cible : `teamId` demandé (validé) sinon équipe principale. */
function resolveTeam(
  u: SessionUser,
  requested?: string | null,
): { ok: true; teamId: string } | { ok: false; status: number; error: string } {
  const teamId = requested ?? u.teamId ?? u.teamIds[0] ?? null;
  if (!teamId) {
    return { ok: false, status: 400, error: "Aucune équipe rattachée à l'utilisateur." };
  }
  if (!canActOnTeam(u, teamId) && !(u.role === "ADMIN")) {
    return { ok: false, status: 403, error: "Équipe hors périmètre." };
  }
  return { ok: true, teamId };
}

export async function GET(
  req: Request,
  ctx: { params: Promise<{ key: string }> },
) {
  let u: SessionUser;
  try {
    u = await requireUser();
  } catch (r) {
    return r as Response;
  }
  const { key } = await ctx.params;
  if (!KEY_RE.test(key)) {
    return NextResponse.json({ error: "Clé invalide." }, { status: 400 });
  }
  const requested = new URL(req.url).searchParams.get("teamId");
  const team = resolveTeam(u, requested);
  if (!team.ok) {
    return NextResponse.json({ error: team.error }, { status: team.status });
  }

  const plan = await prisma.synoptiquePlan.findUnique({
    where: { teamId_key: { teamId: team.teamId, key } },
    include: { updatedBy: { select: { id: true, name: true } } },
  });
  if (!plan) {
    // Aucun plan enregistré : le viewer utilisera sa graine embarquée.
    return NextResponse.json({ doc: null, version: 0, teamId: team.teamId });
  }

  let doc: unknown = null;
  try {
    doc = JSON.parse(plan.doc);
  } catch {
    doc = null;
  }
  return NextResponse.json({
    doc,
    version: plan.version,
    teamId: plan.teamId,
    updatedAt: plan.updatedAt,
    updatedBy: plan.updatedBy?.name ?? null,
  });
}

const putSchema = z.object({
  // Le document complet du plan (les vues). Objet libre, validé sommairement.
  doc: z.record(z.string(), z.unknown()),
  /** Version chargée par le client, pour le verrou optimiste. */
  baseVersion: z.number().int().nonnegative().optional(),
  /** Équipe cible (ADMIN multi-équipes) ; sinon équipe principale. */
  teamId: z.string().optional(),
});

export async function PUT(
  req: Request,
  ctx: { params: Promise<{ key: string }> },
) {
  let u: SessionUser;
  try {
    u = await requireRole(["EDITOR", "ADMIN"]);
  } catch (r) {
    return r as Response;
  }
  const { key } = await ctx.params;
  if (!KEY_RE.test(key)) {
    return NextResponse.json({ error: "Clé invalide." }, { status: 400 });
  }

  let body: unknown = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }
  const parsed = putSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Données invalides", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }
  // Le document doit ressembler à un plan : des vues, ou une voie/aiguille (legacy).
  const d = parsed.data.doc as Record<string, unknown>;
  const looksLikePlan =
    Array.isArray(d.views) || Array.isArray(d.voies) || Array.isArray(d.aiguilles);
  if (!looksLikePlan) {
    return NextResponse.json({ error: "Document de plan non reconnu." }, { status: 400 });
  }
  const docStr = JSON.stringify(parsed.data.doc);
  if (Buffer.byteLength(docStr, "utf8") > MAX_DOC_BYTES) {
    return NextResponse.json({ error: "Plan trop volumineux." }, { status: 413 });
  }

  const team = resolveTeam(u, parsed.data.teamId ?? null);
  if (!team.ok) {
    return NextResponse.json({ error: team.error }, { status: team.status });
  }

  const result = await prisma.$transaction(async (tx) => {
    const existing = await tx.synoptiquePlan.findUnique({
      where: { teamId_key: { teamId: team.teamId, key } },
    });
    if (
      existing &&
      parsed.data.baseVersion != null &&
      existing.version !== parsed.data.baseVersion
    ) {
      return { conflict: true as const, currentVersion: existing.version };
    }
    const saved = existing
      ? await tx.synoptiquePlan.update({
          where: { id: existing.id },
          data: { doc: docStr, version: existing.version + 1, updatedById: u.id },
        })
      : await tx.synoptiquePlan.create({
          data: { teamId: team.teamId, key, doc: docStr, version: 1, updatedById: u.id },
        });
    await tx.auditLog.create({
      data: {
        userId: u.id,
        userEmail: u.email,
        action: existing ? "synoptique.update" : "synoptique.create",
        entity: "SynoptiquePlan",
        entityId: saved.id,
        details: JSON.stringify({ teamId: team.teamId, key, version: saved.version }),
      },
    });
    return { conflict: false as const, saved };
  });

  if (result.conflict) {
    return NextResponse.json(
      {
        error:
          "Le plan a été modifié entre-temps par un autre utilisateur. Rechargez avant d'enregistrer.",
        currentVersion: result.currentVersion,
      },
      { status: 409 },
    );
  }

  return NextResponse.json({
    ok: true,
    version: result.saved.version,
    updatedAt: result.saved.updatedAt,
  });
}
