import { NextResponse } from "next/server";
import { z } from "zod";
import { createHash, randomUUID } from "crypto";
import { addMonths } from "date-fns";
import { prisma } from "@/lib/prisma";
import { requireUser, siteScope } from "@/lib/auth";
import { encodeTags, normalizeTag } from "@/lib/tags";
import {
  defaultMessageFor,
  recordActivitySafe,
} from "@/lib/activityFeed";
import { notifyActionAssigned } from "@/lib/notifications-generators";

/**
 * Création manuelle d'une action depuis la fiche d'un site.
 * Symétrique à /api/agents/[id]/actions, mais l'action est rattachée
 * à un siteId (et non à un agentId).
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
  const { id: siteId } = await ctx.params;

  const site = await prisma.site.findFirst({
    where: { id: siteId, ...siteScope(u) },
    include: { memberships: { select: { teamId: true } } },
  });
  if (!site) {
    return NextResponse.json({ error: "Site inconnu" }, { status: 404 });
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
  const tags = parsed.data.extraTags ?? [];

  const teamId =
    site.teamId ?? site.memberships[0]?.teamId ?? u.teamId ?? u.teamIds[0];
  if (!teamId) {
    return NextResponse.json(
      { error: "Aucune équipe rattachée à ce site." },
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
      siteId,
      localStatus: "ACTIVE",
      dedupHash,
      originalStatus: "Planifiée",
      keyPoint: title,
      veilleType: "Site",
      dueAt,
      tags: encodeTags(tags),
    },
  });

  const teamIds = [
    ...new Set([teamId, ...site.memberships.map((m) => m.teamId)]),
  ];
  await recordActivitySafe({
    teamIds,
    actorId: u.id,
    actorName: u.name,
    type: "ACTION_CREATED",
    entityType: "action",
    entityId: created.id,
    entityLabel: site.name,
    message: defaultMessageFor({
      type: "ACTION_CREATED",
      actorName: u.name,
      entityLabel: site.name,
    }),
    targetUrl: `/sites/${siteId}`,
    metadata: {
      actionId: created.id,
      siteId,
      title,
      dueAt: dueAt.toISOString(),
    },
  });

  await notifyActionAssigned({
    actionId: created.id,
    siteId,
    siteName: site.name,
    teamIds,
    authorId: u.id,
    actionLabel: title,
  });

  return NextResponse.json({ id: created.id, externalId, title, tags });
}
