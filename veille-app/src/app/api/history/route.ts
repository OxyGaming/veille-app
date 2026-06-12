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
              select: { externalId: true, keyPoint: true, siteId: true },
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
    siteId?: string | null;
    href: string;
    badges?: string[];
    accent?: "default" | "warn" | "ok" | "info";
    icareDone?: boolean;
    /** Texte de commentaire à afficher en clair (séparément des badges). */
    commentText?: string | null;
  };

  const entries: Entry[] = [];
  for (const v of visits) {
    entries.push({
      type: "visit",
      id: v.id,
      at: v.visitDate.toISOString(),
      observerName: v.observer.name,
      title: `Visite — ${v.template.name}`,
      subtitle: v.site.name,
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
      title: "Session de veille",
      subtitle: s.agent
        ? `${s.agent.lastName} ${s.agent.firstName}`
        : "Sans agent",
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
    entries.push({
      type: "validation",
      id: v.id,
      at: v.realizedAt.toISOString(),
      observerName: v.validatedBy.name,
      title: `Action validée`,
      subtitle:
        v.action.keyPoint ?? v.action.externalId.slice(0, 12) + "…",
      agentId: v.agentId,
      siteId: v.siteId ?? v.action.siteId,
      href: v.agent
        ? `/agents/${v.agent.id}`
        : v.site
        ? `/sites/${v.site.id}`
        : "#",
      badges: v.comment ? [`« ${v.comment.slice(0, 40)} »`] : [],
      accent: "ok",
    });
  }
  for (const sg of sightings) {
    const isNote = sg.kind === "NOTE";
    const isImport = sg.externalRef?.startsWith("pointage-") ?? false;
    // Pour les imports, on remplace le badge « commentaire long » par une
    // étiquette « Import » : le commentaire reste lisible en clair sous le
    // titre via `commentText`.
    const badges = isImport
      ? ["Import"]
      : [
          ...(sg.comment ? [sg.comment.slice(0, 80)] : []),
          ...(sg._count.photos > 0 ? [`${sg._count.photos} photo(s)`] : []),
        ];
    if (!isImport && sg._count.photos > 0) {
      // Le compteur photos pour les imports n'a pas grand sens (pas
      // d'upload), donc on ne le met pas.
    }
    entries.push({
      type: isNote ? "note" : "sighting",
      id: sg.id,
      at: sg.sightedAt.toISOString(),
      observerName: sg.observer.name,
      title: isNote ? "Commentaire" : "Vu",
      subtitle: sg.agent
        ? `${sg.agent.lastName} ${sg.agent.firstName}`
        : "Agent inconnu",
      agentId: sg.agentId,
      href: `/agents/${sg.agentId}`,
      badges,
      commentText: isImport ? sg.comment : null,
      accent: isNote ? "info" : "default",
    });
  }
  for (const sg of siteSightings) {
    const isNote = sg.kind === "NOTE";
    const isImport = sg.externalRef?.startsWith("pointage-") ?? false;
    const badges = isImport
      ? ["Import"]
      : [
          ...(sg.comment ? [sg.comment.slice(0, 80)] : []),
          ...(sg._count.photos > 0 ? [`${sg._count.photos} photo(s)`] : []),
        ];
    entries.push({
      type: isNote ? "site-note" : "site-sighting",
      id: sg.id,
      at: sg.sightedAt.toISOString(),
      observerName: sg.observer.name,
      title: isNote ? "Commentaire (site)" : "Vu (site)",
      subtitle: sg.site.name,
      siteId: sg.siteId,
      href: `/sites/${sg.siteId}`,
      badges,
      commentText: isImport ? sg.comment : null,
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
