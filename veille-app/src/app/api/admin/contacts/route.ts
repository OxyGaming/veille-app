import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";

export async function GET() {
  try {
    await requireRole(["ADMIN", "EDITOR"]);
  } catch (r) {
    return r as Response;
  }
  const contacts = await prisma.contact.findMany({ orderBy: { name: "asc" } });
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
  try {
    await requireRole(["ADMIN", "EDITOR"]);
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
  try {
    await requireRole("ADMIN");
  } catch (r) {
    return r as Response;
  }
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id manquant" }, { status: 400 });
  await prisma.contact.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
