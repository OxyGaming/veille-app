import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { hashPassword, requireRole } from "@/lib/auth";

const ROLES = ["ADMIN", "EDITOR", "USER"] as const;

const schema = z.object({
  email: z.string().email().optional(),
  name: z.string().min(1).optional(),
  password: z.string().min(6).optional(),
  role: z.enum(ROLES).optional(),
  isActive: z.boolean().optional(),
  teamId: z.string().nullable().optional(),
  viewAllTeams: z.boolean().optional(),
});

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  let me;
  try {
    me = await requireRole("ADMIN");
  } catch (r) {
    return r as Response;
  }
  const { id } = await ctx.params;
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
  const target = await prisma.user.findUnique({ where: { id } });
  if (!target) return NextResponse.json({ error: "Inconnu" }, { status: 404 });

  // Garde-fous spec :
  // - interdire l'auto-désactivation
  if (parsed.data.isActive === false && target.id === me.id) {
    return NextResponse.json(
      { error: "Impossible de désactiver votre propre compte." },
      { status: 400 }
    );
  }
  // - interdire la désactivation du dernier ADMIN actif
  if (parsed.data.isActive === false && target.role === "ADMIN") {
    const otherAdmins = await prisma.user.count({
      where: { role: "ADMIN", isActive: true, id: { not: target.id } },
    });
    if (otherAdmins === 0) {
      return NextResponse.json(
        { error: "Impossible de désactiver le dernier administrateur." },
        { status: 400 }
      );
    }
  }
  // - même règle si on change le rôle d'un dernier ADMIN
  if (
    parsed.data.role &&
    parsed.data.role !== "ADMIN" &&
    target.role === "ADMIN"
  ) {
    const otherAdmins = await prisma.user.count({
      where: { role: "ADMIN", isActive: true, id: { not: target.id } },
    });
    if (otherAdmins === 0) {
      return NextResponse.json(
        { error: "Impossible de retirer le rôle au dernier administrateur." },
        { status: 400 }
      );
    }
  }
  // - interdire la désactivation si l'utilisateur possède des sessions actives
  if (parsed.data.isActive === false) {
    const activeSessions = await prisma.veilleSession.count({
      where: { observerId: target.id, status: { in: ["draft", "active"] } },
    });
    if (activeSessions > 0) {
      return NextResponse.json(
        {
          error: `Impossible de désactiver : ${activeSessions} session(s) de veille active(s).`,
        },
        { status: 400 }
      );
    }
  }

  const update: Record<string, unknown> = {
    email: parsed.data.email?.toLowerCase(),
    name: parsed.data.name,
    role: parsed.data.role,
    isActive: parsed.data.isActive,
    teamId: parsed.data.teamId,
    viewAllTeams: parsed.data.viewAllTeams,
  };
  if (parsed.data.password) {
    update.password = hashPassword(parsed.data.password);
  }
  const updated = await prisma.user.update({ where: { id }, data: update });
  return NextResponse.json({
    id: updated.id,
    email: updated.email,
    name: updated.name,
    role: updated.role,
    isActive: updated.isActive,
    teamId: updated.teamId,
    viewAllTeams: updated.viewAllTeams,
  });
}

/**
 * Suppression d'un utilisateur.
 *
 * - Par défaut (ou `?mode=soft`) : alias de PATCH isActive=false — l'historique
 *   reste intact. Le compte est juste désactivé.
 * - `?mode=hard` : suppression définitive. N'est autorisée que si l'utilisateur
 *   n'a **aucune** trace opérationnelle (session de veille, observation, NC,
 *   validation, visite, vu/note, photo, log). Sinon réponse 409 avec détail.
 *   Les seules relations qu'on nettoie automatiquement (et qui ne sont pas
 *   du contenu utilisateur) : memberships d'équipe, UserAgentHidden, IcareEntry.
 */
export async function DELETE(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  let me;
  try {
    me = await requireRole("ADMIN");
  } catch (r) {
    return r as Response;
  }
  const { id } = await ctx.params;
  const url = new URL(req.url);
  const mode = url.searchParams.get("mode") ?? "soft";

  if (mode === "soft") {
    return PATCH(
      new Request(req.url, {
        method: "PATCH",
        headers: req.headers,
        body: JSON.stringify({ isActive: false }),
      }),
      { params: Promise.resolve({ id }) }
    );
  }

  // === Mode hard ===

  if (id === me.id) {
    return NextResponse.json(
      { error: "Impossible de supprimer votre propre compte." },
      { status: 400 }
    );
  }

  const target = await prisma.user.findUnique({ where: { id } });
  if (!target) return NextResponse.json({ error: "Inconnu" }, { status: 404 });

  // Dernier ADMIN ?
  if (target.role === "ADMIN") {
    const otherAdmins = await prisma.user.count({
      where: { role: "ADMIN", isActive: true, id: { not: target.id } },
    });
    if (otherAdmins === 0) {
      return NextResponse.json(
        { error: "Impossible de supprimer le dernier administrateur." },
        { status: 400 }
      );
    }
  }

  // Comptage des traces opérationnelles. Si une seule est > 0, on refuse.
  const [
    sessions,
    observations,
    comments,
    validations,
    photos,
    audit,
    visits,
    agentSightings,
    siteSightings,
  ] = await Promise.all([
    prisma.veilleSession.count({ where: { observerId: target.id } }),
    prisma.observationItem.count({ where: { recordedById: target.id } }),
    prisma.comment.count({ where: { authorId: target.id } }),
    prisma.actionValidation.count({ where: { validatedById: target.id } }),
    prisma.photo.count({ where: { uploaderId: target.id } }),
    prisma.auditLog.count({ where: { userId: target.id } }),
    prisma.siteVisit.count({ where: { observerId: target.id } }),
    prisma.agentSighting.count({ where: { observerId: target.id } }),
    prisma.siteSighting.count({ where: { observerId: target.id } }),
  ]);

  const counts: Record<string, number> = {
    sessions,
    observations,
    comments,
    validations,
    photos,
    audit,
    visits,
    agentSightings,
    siteSightings,
  };
  const nonEmpty = Object.entries(counts).filter(([, n]) => n > 0);
  if (nonEmpty.length > 0) {
    const detail = nonEmpty
      .map(([k, n]) => `${n} ${k}`)
      .join(", ");
    return NextResponse.json(
      {
        error: `Suppression refusée — l'utilisateur a des données rattachées (${detail}). Désactivez-le plutôt (statut Inactif).`,
        counts,
      },
      { status: 409 }
    );
  }

  // Aucune trace : on nettoie les relations légères et on supprime.
  await prisma.$transaction([
    prisma.userTeam.deleteMany({ where: { userId: target.id } }),
    prisma.userAgentHidden.deleteMany({ where: { userId: target.id } }),
    prisma.icareEntry.deleteMany({ where: { doneById: target.id } }),
    prisma.user.delete({ where: { id: target.id } }),
  ]);

  return NextResponse.json({ ok: true, deleted: target.email });
}

