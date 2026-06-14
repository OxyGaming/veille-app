/**
 * POST /api/admin/scope-preference (Sprint 6 C4).
 *
 * Mise à jour de la préférence de périmètre d'un ADMIN.
 *
 * Accès : ADMIN uniquement (D2). USER / EDITOR → 403.
 * Aucun AuditLog (D7 — changement de vue n'est pas une action sensible).
 */

import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { resolveAdminScope } from "@/lib/admin-scope";
import {
  isAdminScopeMode,
  updateAdminScopePreference,
} from "@/lib/admin-scope-preference";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  let actor;
  try {
    actor = await requireRole(["ADMIN"]);
  } catch (e) {
    if (e instanceof Response) return e;
    throw e;
  }

  let body: { mode?: unknown; teamId?: unknown };
  try {
    body = (await req.json()) as { mode?: unknown; teamId?: unknown };
  } catch {
    return NextResponse.json({ error: "Body JSON invalide" }, { status: 400 });
  }

  const rawMode = typeof body.mode === "string" ? body.mode : "";
  if (!isAdminScopeMode(rawMode)) {
    return NextResponse.json(
      { error: "mode requis : GLOBAL | MY_TEAMS | TEAM" },
      { status: 400 },
    );
  }
  const mode = rawMode;

  // teamId requis et non vide pour mode TEAM
  let teamId: string | null = null;
  if (mode === "TEAM") {
    const raw = body.teamId;
    if (typeof raw !== "string" || raw.length === 0) {
      return NextResponse.json(
        { error: "teamId requis pour mode=TEAM" },
        { status: 400 },
      );
    }
    teamId = raw;
    // Validation existence en DB
    const exists = await prisma.team.findUnique({
      where: { id: teamId },
      select: { id: true },
    });
    if (!exists) {
      return NextResponse.json(
        { error: "teamId inconnu" },
        { status: 404 },
      );
    }
  }

  const preference = await updateAdminScopePreference(actor.id, mode, teamId);

  // Recompute le scope résolu avec le nom des équipes (label nominatif).
  const teams = await prisma.team.findMany({
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
  const teamsMap: Record<string, string> = {};
  for (const t of teams) teamsMap[t.id] = t.name;

  const resolvedScope = resolveAdminScope(
    {
      role: actor.role,
      teamIds: actor.teamIds,
      adminScopeMode: preference.mode,
      adminTeamId: preference.teamId,
    },
    { teamsMap },
  );

  return NextResponse.json(
    { ok: true, preference, resolvedScope },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
