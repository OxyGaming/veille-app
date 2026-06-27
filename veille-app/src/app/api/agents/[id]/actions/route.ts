import { NextResponse } from "next/server";
import { z } from "zod";
import { createHash, randomUUID } from "crypto";
import { addMonths } from "date-fns";
import { prisma } from "@/lib/prisma";
import { agentScope, effectiveTeamIds, requireUser } from "@/lib/auth";
import { encodeTags, normalizeTag } from "@/lib/tags";
import {
  defaultMessageFor,
  formatQuotedSnippet,
  joinActivityParts,
  recordActivitySafe,
} from "@/lib/activityFeed";
import { notifyActionAssigned } from "@/lib/notifications-generators";

/**
 * Création manuelle d'une action depuis la fiche d'un agent.
 * Les tags « veille légale » + « obligatoire » sont pré-cochés côté UI
 * mais l'utilisateur peut les retirer s'ils ne s'appliquent pas — donc
 * pas de forçage serveur, on prend la liste telle quelle.
 * Échéance par défaut = +7 mois.
 */
const schema = z.object({
  title: z.string().trim().min(1).max(300),
  dueAt: z.string().datetime().optional(),
  extraTags: z.array(z.string().trim().min(1).max(40)).max(10).default([]),
  /** Équipe propriétaire choisie côté UI (agent multi-équipes). Optionnel :
   *  si une seule équipe est éligible, le serveur la déduit. */
  teamId: z.string().min(1).optional(),
});

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  let u;
  try {
    u = await requireUser();
  } catch (r) {
    return r as Response;
  }
  const { id: agentId } = await ctx.params;

  const agent = await prisma.agent.findFirst({
    where: { id: agentId, ...agentScope(u) },
    include: { memberships: { select: { teamId: true } } },
  });
  if (!agent) {
    return NextResponse.json({ error: "Agent inconnu" }, { status: 404 });
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

  const title = parsed.data.title;
  const dueAt = parsed.data.dueAt
    ? new Date(parsed.data.dueAt)
    : addMonths(new Date(), 7);

  // Tags tels que renvoyés par le client (dédup via normalize côté encode).
  const tags = parsed.data.extraTags ?? [];

  // Équipe propriétaire de l'action. Cloisonnement oblige : elle DOIT être une
  // équipe partagée entre l'utilisateur et l'agent, sinon le créateur ne verrait
  // pas sa propre action (cf. teamScope sur la fiche). On calcule l'intersection
  // équipes(agent) ∩ équipes-agissables(user) ; un global (ADMIN/viewAllTeams)
  // peut viser n'importe quelle équipe de l'agent.
  const agentTeamIds = [
    ...new Set([
      ...(agent.teamId ? [agent.teamId] : []),
      ...agent.memberships.map((m) => m.teamId),
    ]),
  ];
  const eff = effectiveTeamIds(u);
  const eligible =
    eff === null ? agentTeamIds : agentTeamIds.filter((t) => eff.includes(t));

  let teamId: string;
  if (parsed.data.teamId) {
    // Choix explicite : doit appartenir au périmètre autorisé.
    if (!eligible.includes(parsed.data.teamId)) {
      return NextResponse.json(
        { error: "Équipe non autorisée pour cet agent." },
        { status: 403 }
      );
    }
    teamId = parsed.data.teamId;
  } else if (eligible.length === 1) {
    teamId = eligible[0];
  } else if (eligible.length === 0) {
    return NextResponse.json(
      { error: "Aucune équipe commune avec cet agent." },
      { status: 400 }
    );
  } else {
    // Plusieurs équipes possibles mais aucune fournie → l'UI doit demander.
    return NextResponse.json(
      { error: "Précisez l'équipe propriétaire de l'action.", code: "TEAM_REQUIRED" },
      { status: 400 }
    );
  }

  const externalId = `manual-${randomUUID()}`;
  const dedupHash = createHash("sha1")
    .update(
      [
        title.toLowerCase().trim(),
        "",
        "",
        dueAt.toISOString().slice(0, 10),
        tags.map(normalizeTag).sort().join(","),
        "",
      ].join("|")
    )
    .digest("hex");

  const created = await prisma.importedAction.create({
    data: {
      externalId,
      teamId,
      agentId,
      localStatus: "ACTIVE",
      dedupHash,
      originalStatus: "Planifiée",
      keyPoint: title,
      veilleType: "Agent",
      dueAt,
      tags: encodeTags(tags),
    },
  });

  // Cloisonnement (cohérent avec la validation) : l'événement ne concerne que
  // l'équipe propriétaire de l'action, pas toutes les équipes de l'agent partagé.
  // targetUrl = fiche agent (pas de fiche action dédiée V1).
  const agentName = `${agent.lastName} ${agent.firstName}`.trim();
  const teamIds = [teamId];
  await recordActivitySafe({
    teamIds,
    // Notif dédiée notifyActionAssigned ci-dessous → pas de doublon.
    notify: false,
    actorId: u.id,
    actorName: u.name,
    type: "ACTION_CREATED",
    entityType: "action",
    entityId: created.id,
    entityLabel: agentName,
    // Enrichi C10 — titre/keyPoint de l'action dans le message.
    message: joinActivityParts([
      defaultMessageFor({
        type: "ACTION_CREATED",
        actorName: u.name,
        entityLabel: agentName,
      }),
      formatQuotedSnippet(title),
    ]),
    targetUrl: `/agents/${agentId}`,
    metadata: {
      actionId: created.id,
      agentId,
      title,
      dueAt: dueAt.toISOString(),
    },
  });

  // Notification personnelle (Sprint 5 C3) — non-bloquante.
  await notifyActionAssigned({
    actionId: created.id,
    agentId,
    agentName,
    teamIds,
    authorId: u.id,
    actionLabel: title,
  });

  return NextResponse.json({ id: created.id, externalId, title, tags });
}
