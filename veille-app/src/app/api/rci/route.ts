import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser, teamScope } from "@/lib/auth";

/**
 * Liste des RCI visibles par l'utilisateur (scope équipe).
 * Drafts en premier, puis finalisés. Tri stable sur updatedAt desc.
 */
export async function GET() {
  let u;
  try {
    u = await requireUser();
  } catch (r) {
    return r as Response;
  }
  const rcis = await prisma.rci.findMany({
    where: { ...teamScope(u) },
    orderBy: [{ status: "asc" }, { updatedAt: "desc" }],
    take: 100,
    include: {
      author: { select: { id: true, name: true } },
      team: { select: { id: true, name: true } },
      _count: { select: { photos: true } },
    },
  });
  return NextResponse.json(rcis);
}

const createSchema = z.object({
  teamId: z.string().optional(),
  title: z.string().trim().max(200).optional(),
});

/**
 * Crée un brouillon vide. teamId par défaut = équipe principale de l'utilisateur,
 * sinon la première de ses memberships. L'auteur courant est enregistré.
 */
export async function POST(req: Request) {
  let u;
  try {
    u = await requireUser();
  } catch (r) {
    return r as Response;
  }
  let body: unknown = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Données invalides", issues: parsed.error.flatten() },
      { status: 400 }
    );
  }
  const teamId =
    parsed.data.teamId ?? u.teamId ?? u.teamIds[0] ?? null;
  if (!teamId) {
    return NextResponse.json(
      { error: "Aucune équipe rattachée à l'utilisateur." },
      { status: 400 }
    );
  }
  if (!u.teamIds.includes(teamId) && u.role !== "ADMIN") {
    return NextResponse.json({ error: "Équipe hors scope" }, { status: 403 });
  }
  const created = await prisma.rci.create({
    data: {
      teamId,
      authorId: u.id,
      status: "DRAFT",
      title: parsed.data.title ?? null,
    },
  });
  return NextResponse.json(created);
}
