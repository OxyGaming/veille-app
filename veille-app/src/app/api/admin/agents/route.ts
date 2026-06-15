import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";

const schema = z.object({
  matricule: z.string().trim().min(1).max(40),
  firstName: z.string().trim().min(1).max(80),
  lastName: z.string().trim().min(1).max(80),
  teamIds: z.array(z.string()).optional(),
  /**
   * Si l'utilisateur a explicitement confirmé la réactivation, on autorise
   * la mise à jour d'un agent existant (archivé ou non). Sinon, le serveur
   * refuse les doublons matricule avec 409 + détails.
   */
  reactivateIfExists: z.boolean().optional(),
});

/**
 * Création manuelle d'un agent depuis /admin/agents.
 *
 * Dédupe sur `matricule` (clé unique du modèle Agent) :
 *  - matricule libre → création + AuditLog AGENT_CREATED.
 *  - matricule existant + `reactivateIfExists=false` (défaut) → 409 avec
 *    payload `{ code: "DUPLICATE_MATRICULE", existing: { id, lastName,
 *    firstName, isActive } }` pour que l'UI propose la réactivation.
 *  - matricule existant + `reactivateIfExists=true` → met à jour
 *    isActive=true, isVisible=true, et — si fournis — firstName/lastName/
 *    teamIds (remplacement complet du jeu d'AgentTeam). AuditLog
 *    AGENT_REACTIVATED.
 */
export async function POST(req: Request) {
  let u;
  try {
    u = await requireRole("ADMIN");
  } catch (r) {
    return r as Response;
  }
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
  const { matricule, firstName, lastName, teamIds, reactivateIfExists } =
    parsed.data;

  const existing = await prisma.agent.findUnique({
    where: { matricule },
    select: {
      id: true,
      matricule: true,
      firstName: true,
      lastName: true,
      isActive: true,
      isVisible: true,
    },
  });

  if (existing && !reactivateIfExists) {
    return NextResponse.json(
      {
        error: "Matricule déjà utilisé",
        code: "DUPLICATE_MATRICULE",
        existing,
      },
      { status: 409 }
    );
  }

  if (existing && reactivateIfExists) {
    await prisma.$transaction(async (tx) => {
      await tx.agent.update({
        where: { id: existing.id },
        data: {
          firstName,
          lastName,
          isActive: true,
          isVisible: true,
        },
      });
      if (teamIds) {
        const wanted = new Set(teamIds);
        const current = await tx.agentTeam.findMany({
          where: { agentId: existing.id },
        });
        const currentIds = new Set(current.map((m) => m.teamId));
        const toAdd = [...wanted].filter((t) => !currentIds.has(t));
        const toRemove = current.filter((m) => !wanted.has(m.teamId));
        if (toRemove.length) {
          await tx.agentTeam.deleteMany({
            where: { id: { in: toRemove.map((m) => m.id) } },
          });
        }
        for (const teamId of toAdd) {
          await tx.agentTeam.create({
            data: { agentId: existing.id, teamId },
          });
        }
      }
      await tx.auditLog.create({
        data: {
          userId: u.id,
          userEmail: u.email,
          action: "AGENT_REACTIVATED",
          entity: "Agent",
          entityId: existing.id,
          details: JSON.stringify({
            matricule,
            firstName,
            lastName,
            teamIds: teamIds ?? null,
            previouslyActive: existing.isActive,
            previouslyVisible: existing.isVisible,
          }),
        },
      });
    });
    return NextResponse.json({
      ok: true,
      id: existing.id,
      reactivated: true,
    });
  }

  // Création.
  // teamId legacy : on prend le premier id passé pour rester aligné sur la
  // logique d'import (le scope effectif passe par AgentTeam).
  const primaryTeamId = teamIds?.[0] ?? null;
  const created = await prisma.$transaction(async (tx) => {
    const agent = await tx.agent.create({
      data: {
        matricule,
        firstName,
        lastName,
        teamId: primaryTeamId,
        isActive: true,
        isVisible: true,
      },
    });
    if (teamIds && teamIds.length) {
      for (const teamId of teamIds) {
        await tx.agentTeam.create({ data: { agentId: agent.id, teamId } });
      }
    }
    await tx.auditLog.create({
      data: {
        userId: u.id,
        userEmail: u.email,
        action: "AGENT_CREATED",
        entity: "Agent",
        entityId: agent.id,
        details: JSON.stringify({
          matricule,
          firstName,
          lastName,
          teamIds: teamIds ?? null,
        }),
      },
    });
    return agent;
  });

  return NextResponse.json({
    ok: true,
    id: created.id,
    reactivated: false,
  });
}
