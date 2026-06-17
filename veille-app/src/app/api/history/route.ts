import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser, teamScope } from "@/lib/auth";

/**
 * Historique transverse : agrège visites de site, sessions de veille,
 * validations d'actions et « Vu » agent dans un flux chronologique unique.
 *
 * Filtres : ?type=visit,session,validation,sighting&agentId&siteId&from&to&take
 */
export async function GET(req: Request) {
  let u;
  try {
    u = await requireUser();
  } catch (r) {
    return r as Response;
  }
  const url = new URL(req.url);
  const types = new Set(
    (url.searchParams.get("type") ?? "visit,session,validation,sighting")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
  );
  const agentId = url.searchParams.get("agentId") ?? undefined;
  const siteId = url.searchParams.get("siteId") ?? undefined;
  const observerId = url.searchParams.get("observerId") ?? undefined;
  const from = url.searchParams.get("from")
    ? new Date(url.searchParams.get("from")!)
    : undefined;
  const to = url.searchParams.get("to")
    ? new Date(url.searchParams.get("to")!)
    : undefined;
  const take = Math.min(
    Number(url.searchParams.get("take") ?? 100) || 100,
    300
  );

  const scope = teamScope(u);

  // Construction des filtres communs.
  const dateWhere = (field: string) => {
    if (!from && !to) return {};
    return { [field]: { gte: from, lte: to } };
  };

  const [visits, sessions, validations, sightings, siteSightings] = await Promise.all([
    types.has("visit") && !agentId
      ? prisma.siteVisit.findMany({
          where: {
            ...scope,
            ...(siteId ? { siteId } : {}),
            ...(observerId ? { observerId } : {}),
            ...dateWhere("visitDate"),
          },
          orderBy: { visitDate: "desc" },
          take,
          include: {
            template: { select: { name: true, slug: true } },
            site: { select: { id: true, name: true, code: true } },
            observer: { select: { name: true } },
            _count: { select: { nonConformities: true } },
          },
        })
      : Promise.resolve([]),
    types.has("session")
      ? prisma.veilleSession.findMany({
          where: {
            ...scope,
            ...(agentId ? { agentId } : {}),
            ...(observerId ? { observerId } : {}),
            ...dateWhere("startedAt"),
          },
          orderBy: { startedAt: "desc" },
          take,
          include: {
            agent: { select: { id: true, firstName: true, lastName: true } },
            observer: { select: { name: true } },
            procedures: {
              include: { procedure: { select: { title: true } } },
            },
          },
        })
      : Promise.resolve([]),
    types.has("validation")
      ? prisma.actionValidation.findMany({
          where: {
            ...scope,
            ...(agentId ? { agentId } : {}),
            ...(siteId ? { siteId } : {}),
            ...(observerId ? { validatedById: observerId } : {}),
            ...dateWhere("realizedAt"),
          },
          orderBy: { realizedAt: "desc" },
          take,
          include: {
            action: {
              select: {
                externalId: true,
                comment: true,
                keyPoint: true,
                theme: true,
                domain: true,
                siteId: true,
              },
            },
            agent: { select: { id: true, firstName: true, lastName: true } },
            site: { select: { id: true, name: true } },
            validatedBy: { select: { name: true } },
          },
        })
      : Promise.resolve([]),
    types.has("sighting") && !siteId
      ? prisma.agentSighting.findMany({
          where: {
            ...scope,
            ...(agentId ? { agentId } : {}),
            ...(observerId ? { observerId } : {}),
            ...dateWhere("sightedAt"),
          },
          orderBy: { sightedAt: "desc" },
          take,
          include: {
            agent: { select: { id: true, firstName: true, lastName: true } },
            observer: { select: { name: true } },
            _count: { select: { photos: true } },
          },
          // Champs nécessaires pour distinguer un import : externalRef.
        })
      : Promise.resolve([]),
    types.has("sighting") && !agentId
      ? prisma.siteSighting.findMany({
          where: {
            ...scope,
            ...(siteId ? { siteId } : {}),
            ...(observerId ? { observerId } : {}),
            ...dateWhere("sightedAt"),
          },
          orderBy: { sightedAt: "desc" },
          take,
          include: {
            site: { select: { id: true, name: true, code: true } },
            observer: { select: { name: true } },
            _count: { select: { photos: true } },
          },
        })
      : Promise.resolve([]),
  ]);

  type Entry = {
    type:
      | "visit"
      | "session"
      | "validation"
      | "sighting"
      | "note"
      | "site-sighting"
      | "site-note";
    id: string;
    at: string;
    observerName: string | null;
    title: string;
    subtitle: string | null;
    agentId?: string | null;
    /**
     * Nom complet de l'agent rattaché à l'entrée — pour les validations,
     * où le titre porte le libellé de l'action (et pas l'agent). Pour les
     * sessions/sightings, le titre EST déjà le nom de l'agent : on laisse
     * `agentName` à null pour éviter une duplication visuelle.
     */
    agentName?: string | null;
    siteId?: string | null;
    href: string;
    badges?: string[];
    accent?: "default" | "warn" | "ok" | "info";
    icareDone?: boolean;
    /**
     * Commentaire-entrée : l'entrée EST le commentaire (note, site-note,
     * sighting d'import). Affiché en clair sous le titre.
     */
    commentText?: string | null;
    /**
     * Commentaire-d'action : l'entrée a un commentaire attaché (validation
     * d'action, sighting non-import avec note). Affiché derrière un bouton
     * d'information côté UI.
     */
    actionComment?: string | null;
  };

  const entries: Entry[] = [];
  for (const v of visits) {
    entries.push({
      type: "visit",
      id: v.id,
      at: v.visitDate.toISOString(),
      observerName: v.observer.name,
      title: `${v.template.name} · ${v.site.name}`,
      subtitle: null,
      siteId: v.siteId,
      href: `/visits/${v.id}`,
      badges: [
        v.status.toUpperCase(),
        ...(v._count.nonConformities > 0
          ? [`${v._count.nonConformities} NC`]
          : []),
      ],
      accent: v._count.nonConformities > 0 ? "warn" : "info",
    });
  }
  for (const s of sessions) {
    entries.push({
      type: "session",
      id: s.id,
      at: s.startedAt.toISOString(),
      observerName: s.observer.name,
      title: s.agent
        ? `${s.agent.lastName} ${s.agent.firstName}`
        : "Sans agent",
      subtitle: null,
      agentId: s.agentId,
      href: `/sessions/${s.id}`,
      badges: [
        s.status.toUpperCase(),
        ...s.procedures
          .slice(0, 2)
          .map((po) => po.procedure.title.slice(0, 30)),
      ],
      accent: "info",
    });
  }
  for (const v of validations) {
    // Cascade de titre alignée avec la carte agent (cf. AgentActionsClient
    // commentaire L321) : le `comment` est la description concrète à réaliser
    // (« Entrainement ODICEO », « Vérifier extincteurs »…). `keyPoint` n'est
    // qu'une catégorisation ; il sert de fallback. Si rien n'est renseigné,
    // on retombe sur l'agent/site rattaché pour donner du contexte.
    const validationTitle =
      v.action.comment ||
      v.action.keyPoint ||
      v.action.theme ||
      v.action.domain ||
      (v.agent ? `Action — ${v.agent.lastName} ${v.agent.firstName}` : null) ||
      (v.site ? `Action — ${v.site.name}` : null) ||
      "Action sans intitulé";
    entries.push({
      type: "validation",
      id: v.id,
      at: v.realizedAt.toISOString(),
      observerName: v.validatedBy.name,
      title: validationTitle,
      subtitle: null,
      agentId: v.agentId,
      agentName: v.agent
        ? `${v.agent.lastName} ${v.agent.firstName}`
        : null,
      siteId: v.siteId ?? v.action.siteId,
      href: v.agent
        ? `/agents/${v.agent.id}`
        : v.site
        ? `/sites/${v.site.id}`
        : "#",
      badges: [],
      actionComment: v.comment ?? null,
      accent: "ok",
    });
  }
  for (const sg of sightings) {
    const isNote = sg.kind === "NOTE";
    const isImport = sg.externalRef?.startsWith("pointage-") ?? false;
    // L'entrée note ou import : le commentaire EST l'entrée → `commentText`
    // (rendu inline). Sighting normal : commentaire = note attachée → `actionComment`
    // (rendu derrière ℹ️). Pour les imports, badge « Import » dédié.
    const badges: string[] = isImport ? ["Import"] : [];
    if (!isImport && sg._count.photos > 0) {
      badges.push(`${sg._count.photos} photo(s)`);
    }
    entries.push({
      type: isNote ? "note" : "sighting",
      id: sg.id,
      at: sg.sightedAt.toISOString(),
      observerName: sg.observer.name,
      title: sg.agent
        ? `${sg.agent.lastName} ${sg.agent.firstName}`
        : "Agent inconnu",
      subtitle: null,
      agentId: sg.agentId,
      href: `/agents/${sg.agentId}`,
      badges,
      commentText: (isNote || isImport) ? sg.comment : null,
      actionComment: !isNote && !isImport ? sg.comment ?? null : null,
      accent: isNote ? "info" : "default",
    });
  }
  for (const sg of siteSightings) {
    const isNote = sg.kind === "NOTE";
    const isImport = sg.externalRef?.startsWith("pointage-") ?? false;
    const badges: string[] = isImport ? ["Import"] : [];
    if (!isImport && sg._count.photos > 0) {
      badges.push(`${sg._count.photos} photo(s)`);
    }
    entries.push({
      type: isNote ? "site-note" : "site-sighting",
      id: sg.id,
      at: sg.sightedAt.toISOString(),
      observerName: sg.observer.name,
      title: sg.site.name,
      subtitle: null,
      siteId: sg.siteId,
      href: `/sites/${sg.siteId}`,
      badges,
      commentText: (isNote || isImport) ? sg.comment : null,
      actionComment: !isNote && !isImport ? sg.comment ?? null : null,
      accent: isNote ? "info" : "default",
    });
  }

  entries.sort((a, b) => (a.at < b.at ? 1 : -1));
  const sliced = entries.slice(0, take);

  // Hydrate le flag Icare en une seule requête (couples (refType, refId)).
  if (sliced.length > 0) {
    const marks = await prisma.icareEntry.findMany({
      where: {
        OR: sliced.map((e) => ({ refType: e.type, refId: e.id })),
      },
      select: { refType: true, refId: true },
    });
    const set = new Set(marks.map((m) => `${m.refType}:${m.refId}`));
    for (const e of sliced) {
      e.icareDone = set.has(`${e.type}:${e.id}`);
    }
  }

  return NextResponse.json({ entries: sliced });
}
