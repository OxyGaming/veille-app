import { NextResponse } from "next/server";
import { z } from "zod";
import { createHash, randomUUID } from "crypto";
import { addMonths } from "date-fns";
import { prisma } from "@/lib/prisma";
import { requireUser, resolveOwningTeam, siteScope } from "@/lib/auth";
import { encodeTags, normalizeTag } from "@/lib/tags";
import {
  defaultMessageFor,
  formatQuotedSnippet,
  joinActivityParts,
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
  /** Équipe propriétaire (site multi-équipes) — requise si ambiguë. */
  teamId: z.string().optional(),
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

  // Équipe propriétaire désambiguïsée (site multi-équipes).
  const owning = resolveOwningTeam(
    u,
    [site.teamId, ...site.memberships.map((m) => m.teamId)],
    parsed.data.teamId,
  );
  if (!owning.ok) {
    const status = owning.code === "TEAM_REQUIRED" ? 400 : 403;
    return NextResponse.json(
      {
        error:
          owning.code === "TEAM_REQUIRED"
            ? "Site partagé : précisez l'équipe."
            : owning.code === "NO_TEAM"
              ? "Aucune équipe de votre périmètre rattachée à ce site."
              : "Équipe hors de votre périmètre.",
        code: owning.code,
      },
      { status }
    );
  }
  const teamId = owning.teamId;

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

  // Cloisonnement (cohérent avec la validation) : seul l'équipe propriétaire
  // de l'action est notifiée, pas toutes les équipes du site partagé.
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
    entityLabel: site.name,
    // Enrichi C10 — titre/keyPoint de l'action dans le message.
    message: joinActivityParts([
      defaultMessageFor({
        type: "ACTION_CREATED",
        actorName: u.name,
        entityLabel: site.name,
      }),
      formatQuotedSnippet(title),
    ]),
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
