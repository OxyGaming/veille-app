import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser, teamScope } from "@/lib/auth";

/**
 * Historique transverse : agrège visites de site, sessions de veille,
 * validations d'actions et « Vu » agent dans un flux chronologique unique.
 *
 * Filtres : ?type=visit,session,validation,sighting&agentId&siteId&from&to&q
 *           &icare=all|true|false&cursor=&take=
 *
 * Pagination par curseur composite `(at, id)` — chaque source est requêtée
 * avec `take = pageSize + 1` pour détecter `hasMore` sans requête
 * supplémentaire. Le filtre Icare est poussé en SQL (`id IN/NOT IN` les
 * refId marqués dans `IcareEntry`) plutôt que filtré après coup, pour rester
 * compatible avec la pagination.
 */

type IcareFilter = "all" | "true" | "false";

const MIN_TAKE = 20;
const MAX_TAKE = 50;
const DEFAULT_TAKE = 30;

function clampTake(raw: string | null): number {
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return DEFAULT_TAKE;
  return Math.min(Math.max(Math.round(n), MIN_TAKE), MAX_TAKE);
}

type Cursor = { at: string; id: string };

function decodeCursor(raw: string | null): Cursor | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(
      Buffer.from(raw, "base64url").toString("utf8"),
    ) as { at?: unknown; id?: unknown };
    if (typeof parsed.at === "string" && typeof parsed.id === "string") {
      return { at: parsed.at, id: parsed.id };
    }
    return null;
  } catch {
    return null;
  }
}

function encodeCursor(at: string, id: string): string {
  return Buffer.from(JSON.stringify({ at, id }), "utf8").toString("base64url");
}

/** Curseur composite `(dateField, id) < (cursor.at, cursor.id)`, tri desc. */
function cursorClause(
  dateField: string,
  cursor: Cursor | null,
): Record<string, unknown> {
  if (!cursor) return {};
  const at = new Date(cursor.at);
  return {
    OR: [{ [dateField]: { lt: at } }, { [dateField]: at, id: { lt: cursor.id } }],
  };
}

/** Filtre Icare simple : un refType == un type d'entrée (visit/session/validation). */
function icareClauseSimple(
  ids: Set<string> | undefined,
  icare: IcareFilter,
): Record<string, unknown> {
  if (icare === "all" || !ids) return {};
  const arr = [...ids];
  return icare === "true" ? { id: { in: arr } } : { id: { notIn: arr } };
}

/**
 * Filtre Icare pour les sources dont le refType dépend de `kind`
 * (AgentSighting → sighting/note ; SiteSighting → site-sighting/site-note).
 */
function icareClauseSplitByKind(
  otherIds: Set<string>,
  noteIds: Set<string>,
  icare: IcareFilter,
): Record<string, unknown> {
  if (icare === "all") return {};
  const op = icare === "true" ? "in" : "notIn";
  return {
    OR: [
      { kind: "NOTE", id: { [op]: [...noteIds] } },
      { kind: { not: "NOTE" }, id: { [op]: [...otherIds] } },
    ],
  };
}

/** Charge les refId marqués Icare pour les refTypes demandés. */
async function fetchIcareIds(
  refTypes: string[],
): Promise<Map<string, Set<string>>> {
  const map = new Map<string, Set<string>>(refTypes.map((rt) => [rt, new Set()]));
  if (!refTypes.length) return map;
  const rows = await prisma.icareEntry.findMany({
    where: { refType: { in: refTypes } },
    select: { refType: true, refId: true },
  });
  for (const r of rows) map.get(r.refType)?.add(r.refId);
  return map;
}

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
  const icareRaw = url.searchParams.get("icare");
  const icare: IcareFilter =
    icareRaw === "true" || icareRaw === "false" ? icareRaw : "all";
  const cursor = decodeCursor(url.searchParams.get("cursor"));
  const take = clampTake(url.searchParams.get("take"));
  const sourceTake = take + 1;
  // Recherche libre — trim + ignore les requêtes très courtes (1 caractère
  // ramènerait quasi tout le dataset et coûterait cher en SQL). Le seuil
  // de 2 caractères est aligné sur le pattern qu'on utilise sur les
  // autres barres de recherche du projet.
  const qRaw = (url.searchParams.get("q") ?? "").trim();
  const q = qRaw.length >= 2 ? qRaw : "";

  const scope = teamScope(u);

  // Construction des filtres communs.
  const dateWhere = (field: string) => {
    if (!from && !to) return {};
    return { [field]: { gte: from, lte: to } };
  };

  // Filtre `q` par entité — OR sur les champs textuels les plus utiles
  // côté usage métier. SQLite : `contains` est case-insensitive pour
  // l'ASCII, partiel pour les accentués (compromis acceptable ici).
  const qVisitWhere = q
    ? {
        OR: [
          { site: { name: { contains: q } } },
          { site: { code: { contains: q } } },
          { template: { name: { contains: q } } },
        ],
      }
    : {};
  const qSessionWhere = q
    ? {
        OR: [
          { agent: { lastName: { contains: q } } },
          { agent: { firstName: { contains: q } } },
          { agent: { matricule: { contains: q } } },
          {
            procedures: {
              some: { procedure: { title: { contains: q } } },
            },
          },
        ],
      }
    : {};
  const qValidationWhere = q
    ? {
        OR: [
          { comment: { contains: q } },
          { action: { comment: { contains: q } } },
          { action: { keyPoint: { contains: q } } },
          { action: { theme: { contains: q } } },
          { action: { domain: { contains: q } } },
          { agent: { lastName: { contains: q } } },
          { agent: { firstName: { contains: q } } },
          { site: { name: { contains: q } } },
        ],
      }
    : {};
  const qAgentSightingWhere = q
    ? {
        OR: [
          { comment: { contains: q } },
          { agent: { lastName: { contains: q } } },
          { agent: { firstName: { contains: q } } },
          { agent: { matricule: { contains: q } } },
        ],
      }
    : {};
  const qSiteSightingWhere = q
    ? {
        OR: [
          { comment: { contains: q } },
          { site: { name: { contains: q } } },
          { site: { code: { contains: q } } },
        ],
      }
    : {};
  // Recherche tournée VS — immatriculation + libellé véhicule.
  const qVehicleRoundWhere = q
    ? {
        OR: [
          { immatriculation: { contains: q } },
          { vehicle: { label: { contains: q } } },
          { template: { name: { contains: q } } },
        ],
      }
    : {};

  // RefId marqués Icare — un seul aller-retour, uniquement pour les refTypes
  // couverts par les types actifs (évite de charger IcareEntry en entier).
  const neededRefTypes: string[] = [];
  if (icare !== "all") {
    if (types.has("visit")) neededRefTypes.push("visit");
    if (types.has("session")) neededRefTypes.push("session");
    if (types.has("validation")) neededRefTypes.push("validation");
    if (types.has("sighting")) {
      neededRefTypes.push("sighting", "note", "site-sighting", "site-note");
    }
  }
  const icareIds = await fetchIcareIds(neededRefTypes);
  const visitIcareClause = icareClauseSimple(icareIds.get("visit"), icare);
  const sessionIcareClause = icareClauseSimple(icareIds.get("session"), icare);
  const validationIcareClause = icareClauseSimple(
    icareIds.get("validation"),
    icare,
  );
  const agentSightingIcareClause = icareClauseSplitByKind(
    icareIds.get("sighting") ?? new Set(),
    icareIds.get("note") ?? new Set(),
    icare,
  );
  const siteSightingIcareClause = icareClauseSplitByKind(
    icareIds.get("site-sighting") ?? new Set(),
    icareIds.get("site-note") ?? new Set(),
    icare,
  );

  const [
    visits,
    sessions,
    validations,
    sightings,
    siteSightings,
    vehicleRounds,
  ] = await Promise.all([
    types.has("visit") && !agentId
      ? prisma.siteVisit.findMany({
          where: {
            ...scope,
            ...(siteId ? { siteId } : {}),
            ...(observerId ? { observerId } : {}),
            ...dateWhere("visitDate"),
            ...visitIcareClause,
            AND: [
              ...(q ? [qVisitWhere] : []),
              cursorClause("visitDate", cursor),
            ],
          },
          orderBy: { visitDate: "desc" },
          take: sourceTake,
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
            ...sessionIcareClause,
            AND: [
              ...(q ? [qSessionWhere] : []),
              cursorClause("startedAt", cursor),
            ],
          },
          orderBy: { startedAt: "desc" },
          take: sourceTake,
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
            ...validationIcareClause,
            AND: [
              ...(q ? [qValidationWhere] : []),
              cursorClause("realizedAt", cursor),
            ],
          },
          orderBy: { realizedAt: "desc" },
          take: sourceTake,
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
            AND: [
              ...(q ? [qAgentSightingWhere] : []),
              agentSightingIcareClause,
              cursorClause("sightedAt", cursor),
            ],
          },
          orderBy: { sightedAt: "desc" },
          take: sourceTake,
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
            AND: [
              ...(q ? [qSiteSightingWhere] : []),
              siteSightingIcareClause,
              cursorClause("sightedAt", cursor),
            ],
          },
          orderBy: { sightedAt: "desc" },
          take: sourceTake,
          include: {
            site: { select: { id: true, name: true, code: true } },
            observer: { select: { name: true } },
            _count: { select: { photos: true } },
          },
        })
      : Promise.resolve([]),
    // Tournées VS — couvertes par le filtre `visit`. Exclues si le filtre
    // restreint à un site ou à un agent (les tournées n'ont ni l'un ni l'autre).
    types.has("visit") && !siteId && !agentId
      ? prisma.vehicleRound.findMany({
          where: {
            ...scope,
            ...(observerId ? { observerId } : {}),
            ...dateWhere("roundDate"),
            ...visitIcareClause,
            AND: [
              ...(q ? [qVehicleRoundWhere] : []),
              cursorClause("roundDate", cursor),
            ],
          },
          orderBy: { roundDate: "desc" },
          take: sourceTake,
          include: {
            template: { select: { name: true, slug: true } },
            vehicle: { select: { label: true } },
            observer: { select: { name: true } },
            _count: { select: { nonConformities: true } },
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
  for (const r of vehicleRounds) {
    entries.push({
      type: "visit",
      id: r.id,
      at: r.roundDate.toISOString(),
      observerName: r.observer.name,
      title: `${r.template.name} · ${r.immatriculation}`,
      subtitle: r.vehicle.label,
      href: `/vehicle-rounds/${r.id}`,
      badges: [
        r.status.toUpperCase(),
        "TOURNÉE VS",
        ...(r._count.nonConformities > 0
          ? [`${r._count.nonConformities} NC`]
          : []),
      ],
      accent: r._count.nonConformities > 0 ? "warn" : "info",
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

  // Tri stable (at desc, id desc) — cohérent avec le curseur composite.
  entries.sort((a, b) => {
    if (a.at !== b.at) return a.at < b.at ? 1 : -1;
    return a.id < b.id ? 1 : -1;
  });

  // Chaque source a été sur-lue de 1 (sourceTake = take + 1) : si le total
  // fusionné dépasse `take`, il reste au moins un élément plus ancien.
  const hasMore = entries.length > take;
  const sliced = entries.slice(0, take);
  const last = sliced[sliced.length - 1];
  const nextCursor = hasMore && last ? encodeCursor(last.at, last.id) : null;

  // Hydrate le flag Icare sur la page retournée (indépendant du filtre —
  // même quand icare=all, l'UI a besoin de savoir quelles lignes sont faites).
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

  return NextResponse.json({ entries: sliced, nextCursor, hasMore });
}
