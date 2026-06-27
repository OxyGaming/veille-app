import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { canActOnTeam, requireRole } from "@/lib/auth";

/**
 * Sprint 8 C3 — Gestion granulaire des rattachements équipe ↔ entité.
 *
 *  POST  /api/admin/teams/[id]/members/[kind]/[refId]   → crée le lien
 *  DELETE /api/admin/teams/[id]/members/[kind]/[refId]  → supprime le lien
 *
 * `kind` ∈ { "user" | "agent" | "site" }. Les liens sont stockés dans
 * UserTeam / AgentTeam / SiteTeam (M2M) — aucun delete physique de
 * l'entité elle-même.
 *
 * Idempotence :
 *  - POST sur un lien existant → 200 (no-op), pas d'erreur.
 *  - DELETE sur un lien absent → 200 (no-op), pas d'erreur.
 *
 * Sécurité : ADMIN-only. AuditLog `TEAM_MEMBER_ADDED` /
 * `TEAM_MEMBER_REMOVED` pour traçabilité.
 */

type Kind = "user" | "agent" | "site";

function isKind(s: string): s is Kind {
  return s === "user" || s === "agent" || s === "site";
}

async function loadEntity(kind: Kind, refId: string) {
  switch (kind) {
    case "user":
      return prisma.user.findUnique({
        where: { id: refId },
        select: { id: true, name: true, email: true },
      });
    case "agent":
      return prisma.agent.findUnique({
        where: { id: refId },
        select: { id: true, matricule: true, firstName: true, lastName: true },
      });
    case "site":
      return prisma.site.findUnique({
        where: { id: refId },
        select: { id: true, name: true, code: true },
      });
  }
}

export async function POST(
  _req: Request,
  ctx: { params: Promise<{ id: string; kind: string; refId: string }> },
) {
  let u;
  try {
    u = await requireRole("ADMIN");
  } catch (r) {
    return r as Response;
  }
  const { id: teamId, kind: rawKind, refId } = await ctx.params;
  if (!isKind(rawKind)) {
    return NextResponse.json({ error: "Type inconnu", kind: rawKind }, { status: 400 });
  }
  const kind: Kind = rawKind;

  // Cloisonnement : un ADMIN scopé ne peut rattacher une entité qu'à une de ses
  // propres équipes (empêche l'auto-attribution et le rattachement cross-équipe).
  if (!canActOnTeam(u, teamId)) {
    return NextResponse.json({ error: "Hors de votre périmètre." }, { status: 403 });
  }

  const [team, entity] = await Promise.all([
    prisma.team.findUnique({ where: { id: teamId }, select: { id: true, name: true } }),
    loadEntity(kind, refId),
  ]);
  if (!team) return NextResponse.json({ error: "Équipe inconnue" }, { status: 404 });
  if (!entity) {
    return NextResponse.json({ error: "Entité inconnue" }, { status: 404 });
  }

  // Création idempotente — si le lien existe, l'upsert ne fait rien.
  let alreadyMember = false;
  await prisma.$transaction(async (tx) => {
    if (kind === "user") {
      const existing = await tx.userTeam.findUnique({
        where: { userId_teamId: { userId: refId, teamId } },
      });
      if (existing) {
        alreadyMember = true;
        return;
      }
      await tx.userTeam.create({ data: { userId: refId, teamId } });
    } else if (kind === "agent") {
      const existing = await tx.agentTeam.findUnique({
        where: { agentId_teamId: { agentId: refId, teamId } },
      });
      if (existing) {
        alreadyMember = true;
        return;
      }
      await tx.agentTeam.create({ data: { agentId: refId, teamId } });
    } else {
      const existing = await tx.siteTeam.findUnique({
        where: { siteId_teamId: { siteId: refId, teamId } },
      });
      if (existing) {
        alreadyMember = true;
        return;
      }
      await tx.siteTeam.create({ data: { siteId: refId, teamId } });
    }
    if (!alreadyMember) {
      await tx.auditLog.create({
        data: {
          userId: u.id,
          userEmail: u.email,
          action: "TEAM_MEMBER_ADDED",
          entity: "Team",
          entityId: teamId,
          details: JSON.stringify({ kind, refId, teamName: team.name }),
        },
      });
    }
  });

  return NextResponse.json({ ok: true, kind, refId, teamId, alreadyMember });
}

export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ id: string; kind: string; refId: string }> },
) {
  let u;
  try {
    u = await requireRole("ADMIN");
  } catch (r) {
    return r as Response;
  }
  const { id: teamId, kind: rawKind, refId } = await ctx.params;
  if (!isKind(rawKind)) {
    return NextResponse.json({ error: "Type inconnu", kind: rawKind }, { status: 400 });
  }
  const kind: Kind = rawKind;

  // Cloisonnement : un ADMIN scopé ne peut détacher que dans ses propres équipes.
  if (!canActOnTeam(u, teamId)) {
    return NextResponse.json({ error: "Hors de votre périmètre." }, { status: 403 });
  }

  const team = await prisma.team.findUnique({
    where: { id: teamId },
    select: { id: true, name: true },
  });
  if (!team) return NextResponse.json({ error: "Équipe inconnue" }, { status: 404 });

  let removed = false;
  await prisma.$transaction(async (tx) => {
    if (kind === "user") {
      const r = await tx.userTeam.deleteMany({
        where: { userId: refId, teamId },
      });
      removed = r.count > 0;
    } else if (kind === "agent") {
      const r = await tx.agentTeam.deleteMany({
        where: { agentId: refId, teamId },
      });
      removed = r.count > 0;
    } else {
      const r = await tx.siteTeam.deleteMany({
        where: { siteId: refId, teamId },
      });
      removed = r.count > 0;
    }
    if (removed) {
      await tx.auditLog.create({
        data: {
          userId: u.id,
          userEmail: u.email,
          action: "TEAM_MEMBER_REMOVED",
          entity: "Team",
          entityId: teamId,
          details: JSON.stringify({ kind, refId, teamName: team.name }),
        },
      });
    }
  });

  return NextResponse.json({ ok: true, kind, refId, teamId, removed });
}
