import { NextResponse } from "next/server";
import { differenceInCalendarDays, format } from "date-fns";
import { prisma } from "@/lib/prisma";
import { requireUser, teamScope } from "@/lib/auth";

/**
 * Agrégations statistiques pour la page /stats.
 *
 * Filtres :
 *   ?from=YYYY-MM-DD&to=YYYY-MM-DD
 *   ?agentId=...  (filtre les types liés à un agent : session, validation, sighting)
 *   ?observerId=... (créateur de l'événement)
 *   ?siteId=...   (filtre les types liés à un site : visit, validation, site-sighting)
 *   ?types=visit,session,validation,sighting,note  (par défaut tous)
 *
 * Retour :
 *   {
 *     totalsByType: { type, count }[]
 *     byCreator:    { name, count }[]
 *     byAgent:      { name, count }[]
 *     bySite:       { name, count }[]
 *     timeline:     { date (YYYY-MM-DD), counts: { [type]: number } }[]
 *   }
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
    (url.searchParams.get("types") ?? "visit,session,validation,sighting,note")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
  );
  const agentId = url.searchParams.get("agentId") ?? undefined;
  const observerId = url.searchParams.get("observerId") ?? undefined;
  const siteId = url.searchParams.get("siteId") ?? undefined;
  const from = url.searchParams.get("from")
    ? new Date(url.searchParams.get("from") + "T00:00:00")
    : new Date(Date.now() - 30 * 24 * 3600 * 1000);
  const to = url.searchParams.get("to")
    ? new Date(url.searchParams.get("to") + "T23:59:59")
    : new Date();

  const scope = teamScope(u);
  const dateOn = (field: string) => ({ [field]: { gte: from, lte: to } });

  const [visits, sessions, validations, sightings, siteSightings] =
    await Promise.all([
      types.has("visit") && !agentId
        ? prisma.siteVisit.findMany({
            where: {
              ...scope,
              ...(siteId ? { siteId } : {}),
              ...(observerId ? { observerId } : {}),
              ...dateOn("visitDate"),
            },
            select: {
              id: true,
              visitDate: true,
              observer: { select: { name: true } },
              site: { select: { name: true } },
            },
          })
        : Promise.resolve([]),
      types.has("session")
        ? prisma.veilleSession.findMany({
            where: {
              ...scope,
              ...(agentId ? { agentId } : {}),
              ...(observerId ? { observerId } : {}),
              ...dateOn("startedAt"),
            },
            select: {
              id: true,
              startedAt: true,
              observer: { select: { name: true } },
              agent: { select: { firstName: true, lastName: true } },
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
              ...dateOn("realizedAt"),
            },
            select: {
              id: true,
              realizedAt: true,
              validatedBy: { select: { name: true } },
              agent: { select: { firstName: true, lastName: true } },
              site: { select: { name: true } },
            },
          })
        : Promise.resolve([]),
      types.has("sighting") || types.has("note")
        ? prisma.agentSighting.findMany({
            where: {
              ...scope,
              ...(agentId ? { agentId } : {}),
              ...(observerId ? { observerId } : {}),
              ...dateOn("sightedAt"),
              ...(types.has("sighting") && !types.has("note")
                ? { kind: "SIGHT" }
                : types.has("note") && !types.has("sighting")
                ? { kind: "NOTE" }
                : {}),
            },
            select: {
              id: true,
              kind: true,
              sightedAt: true,
              observer: { select: { name: true } },
              agent: { select: { firstName: true, lastName: true } },
            },
          })
        : Promise.resolve([]),
      (types.has("sighting") || types.has("note")) && !agentId
        ? prisma.siteSighting.findMany({
            where: {
              ...scope,
              ...(siteId ? { siteId } : {}),
              ...(observerId ? { observerId } : {}),
              ...dateOn("sightedAt"),
              ...(types.has("sighting") && !types.has("note")
                ? { kind: "SIGHT" }
                : types.has("note") && !types.has("sighting")
                ? { kind: "NOTE" }
                : {}),
            },
            select: {
              id: true,
              kind: true,
              sightedAt: true,
              observer: { select: { name: true } },
              site: { select: { name: true } },
            },
          })
        : Promise.resolve([]),
    ]);

  // Type interne pour normaliser les agrégats.
  type Event = {
    type: "visit" | "session" | "validation" | "sighting" | "note";
    at: Date;
    creator: string | null;
    subject: string | null; // agent ou site (selon le type)
  };
  const events: Event[] = [];
  for (const v of visits) {
    events.push({
      type: "visit",
      at: v.visitDate,
      creator: v.observer.name,
      subject: v.site.name,
    });
  }
  for (const s of sessions) {
    events.push({
      type: "session",
      at: s.startedAt,
      creator: s.observer.name,
      subject: s.agent ? `${s.agent.lastName} ${s.agent.firstName}` : null,
    });
  }
  for (const v of validations) {
    events.push({
      type: "validation",
      at: v.realizedAt,
      creator: v.validatedBy.name,
      subject:
        (v.agent ? `${v.agent.lastName} ${v.agent.firstName}` : null) ??
        v.site?.name ??
        null,
    });
  }
  for (const sg of sightings) {
    events.push({
      type: sg.kind === "NOTE" ? "note" : "sighting",
      at: sg.sightedAt,
      creator: sg.observer.name,
      subject: sg.agent ? `${sg.agent.lastName} ${sg.agent.firstName}` : null,
    });
  }
  for (const sg of siteSightings) {
    events.push({
      type: sg.kind === "NOTE" ? "note" : "sighting",
      at: sg.sightedAt,
      creator: sg.observer.name,
      subject: sg.site.name,
    });
  }

  // Agrégats.
  const totalsByType = (() => {
    const m = new Map<string, number>();
    for (const e of events) m.set(e.type, (m.get(e.type) ?? 0) + 1);
    return [...m.entries()].map(([type, count]) => ({ type, count }));
  })();

  const topCount = (
    getKey: (e: Event) => string | null | undefined,
    limit = 20
  ) => {
    const m = new Map<string, number>();
    for (const e of events) {
      const k = getKey(e);
      if (!k) continue;
      m.set(k, (m.get(k) ?? 0) + 1);
    }
    return [...m.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([name, count]) => ({ name, count }));
  };
  const byCreator = topCount((e) => e.creator);
  const bySubject = topCount((e) => e.subject);

  // Timeline : ventilation par jour ou semaine selon plage.
  const span = differenceInCalendarDays(to, from);
  const granularity: "day" | "week" =
    span <= 31 ? "day" : "week";
  const bucketOf = (d: Date) =>
    granularity === "day"
      ? format(d, "yyyy-MM-dd")
      : `${format(d, "yyyy-'W'II")}`;
  const timelineMap = new Map<string, Record<string, number>>();
  for (const e of events) {
    const k = bucketOf(e.at);
    const row = timelineMap.get(k) ?? {};
    row[e.type] = (row[e.type] ?? 0) + 1;
    timelineMap.set(k, row);
  }
  const timeline = [...timelineMap.entries()]
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([date, counts]) => ({ date, counts }));

  return NextResponse.json({
    range: { from: from.toISOString(), to: to.toISOString(), granularity },
    totalsByType,
    byCreator,
    bySubject,
    timeline,
    totalCount: events.length,
  });
}
