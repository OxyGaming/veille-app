import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { canActOnTeam, requireRole, teamScope } from "@/lib/auth";

export async function GET() {
  let u;
  try {
    u = await requireRole(["ADMIN", "EDITOR"]);
  } catch (r) {
    return r as Response;
  }
  // Cloisonnement (§4) : contact sans équipe = commun (visible par tous) ;
  // contact rattaché à une équipe = visible uniquement par cette équipe.
  const contacts = await prisma.contact.findMany({
    where: { OR: [{ teamId: null }, { ...teamScope(u) }] },
    orderBy: { name: "asc" },
  });
  return NextResponse.json(contacts);
}

const schema = z.object({
  id: z.string().optional(),
  name: z.string().min(1),
  role: z.string().nullable().optional(),
  phone: z.string().nullable().optional(),
  email: z.string().email().nullable().optional().or(z.literal("")),
  notes: z.string().nullable().optional(),
  teamId: z.string().nullable().optional(),
});

export async function POST(req: Request) {
  let u;
  try {
    u = await requireRole(["ADMIN", "EDITOR"]);
  } catch (r) {
    return r as Response;
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
  // Cloisonnement : un contact rattaché à une équipe doit l'être à une équipe
  // du périmètre (teamId null = contact commun, autorisé).
  if (parsed.data.teamId && !canActOnTeam(u, parsed.data.teamId)) {
    return NextResponse.json(
      { error: "Équipe hors de votre périmètre." },
      { status: 403 }
    );
  }
  // Édition : vérifier aussi l'accès au contact existant (et à sa cible).
  if (parsed.data.id) {
    const existing = await prisma.contact.findUnique({
      where: { id: parsed.data.id },
      select: { teamId: true },
    });
    if (!existing) {
      return NextResponse.json({ error: "Inconnu" }, { status: 404 });
    }
    // Un contact commun (teamId null) n'est éditable que par un ADMIN global.
    if (!canActOnTeam(u, existing.teamId)) {
      return NextResponse.json(
        { error: "Contact hors de votre périmètre." },
        { status: 403 }
      );
    }
  }
  const data = {
    name: parsed.data.name,
    role: parsed.data.role ?? null,
    phone: parsed.data.phone ?? null,
    email: parsed.data.email ? parsed.data.email : null,
    notes: parsed.data.notes ?? null,
    teamId: parsed.data.teamId ?? null,
  };
  if (parsed.data.id) {
    const u = await prisma.contact.update({ where: { id: parsed.data.id }, data });
    return NextResponse.json(u);
  }
  const c = await prisma.contact.create({ data });
  return NextResponse.json(c);
}

export async function DELETE(req: Request) {
  let u;
  try {
    u = await requireRole("ADMIN");
  } catch (r) {
    return r as Response;
  }
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id manquant" }, { status: 400 });
  const existing = await prisma.contact.findUnique({
    where: { id },
    select: { teamId: true },
  });
  if (!existing) return NextResponse.json({ error: "Inconnu" }, { status: 404 });
  // Cloisonnement : un ADMIN scopé ne supprime que les contacts de son
  // périmètre ; un contact commun (teamId null) reste réservé à l'ADMIN global.
  if (!canActOnTeam(u, existing.teamId)) {
    return NextResponse.json({ error: "Hors de votre périmètre." }, { status: 403 });
  }
  await prisma.contact.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
