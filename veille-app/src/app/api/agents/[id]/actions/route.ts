import { NextResponse } from "next/server";
import { z } from "zod";
import { createHash, randomUUID } from "crypto";
import { addMonths } from "date-fns";
import { prisma } from "@/lib/prisma";
import { agentScope, requireUser } from "@/lib/auth";
import {
  encodeTags,
  normalizeTag,
  TAG_OBLIGATOIRE,
  TAG_VEILLE_LEGALE,
} from "@/lib/tags";
import {
  defaultMessageFor,
  recordActivitySafe,
} from "@/lib/activityFeed";
import { notifyActionAssigned } from "@/lib/notifications-generators";

/**
 * Création manuelle d'une action depuis la fiche d'un agent.
 * Cf. spec : doit OBLIGATOIREMENT porter les tags "veille légale" + "obligatoire".
 * D'autres tags libres peuvent être ajoutés. Échéance par défaut = +7 mois.
 */
const schema = z.object({
  title: z.string().trim().min(1).max(300),
  dueAt: z.string().datetime().optional(),
  extraTags: z.array(z.string().trim().min(1).max(40)).max(10).default([]),
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

  // Tags imposés + extras (dédup via normalize côté encode).
  const tags = [
    TAG_VEILLE_LEGALE,
    TAG_OBLIGATOIRE,
    ...(parsed.data.extraTags ?? []),
  ];

  // teamId scalaire : équipe principale de l'agent, sinon une de ses équipes.
  const teamId =
    agent.teamId ?? agent.memberships[0]?.teamId ?? u.teamId ?? u.teamIds[0];
  if (!teamId) {
    return NextResponse.json(
      { error: "Aucune équipe rattachée à cet agent." },
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

  // Flux d'activité — multi-team via les équipes de l'agent.
  // targetUrl = fiche agent (pas de fiche action dédiée V1).
  const agentName = `${agent.lastName} ${agent.firstName}`.trim();
  const teamIds = [
    ...new Set([teamId, ...agent.memberships.map((m) => m.teamId)]),
  ];
  await recordActivitySafe({
    teamIds,
    actorId: u.id,
    actorName: u.name,
    type: "ACTION_CREATED",
    entityType: "action",
    entityId: created.id,
    entityLabel: agentName,
    message: defaultMessageFor({
      type: "ACTION_CREATED",
      actorName: u.name,
      entityLabel: agentName,
    }),
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
