import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";

/**
 * Toggle Icare : marque (ou démarque) un événement de l'historique comme
 * "saisie Icare effectuée". L'événement est identifié par (refType, refId).
 *
 * refType ∈ { visit | session | validation | sighting | site-sighting |
 *             note | site-note }.
 *
 * Réponse : { done: boolean }.
 */
const REF_TYPES = [
  "visit",
  "session",
  "validation",
  "sighting",
  "site-sighting",
  "note",
  "site-note",
] as const;

const schema = z.object({
  refType: z.enum(REF_TYPES),
  refId: z.string().min(1),
});

export async function POST(req: Request) {
  let u;
  try {
    u = await requireUser();
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
  const { refType, refId } = parsed.data;
  const existing = await prisma.icareEntry.findUnique({
    where: { refType_refId: { refType, refId } },
    select: { id: true },
  });
  if (existing) {
    await prisma.icareEntry.delete({ where: { id: existing.id } });
    return NextResponse.json({ done: false });
  }
  await prisma.icareEntry.create({
    data: { refType, refId, doneById: u.id },
  });
  return NextResponse.json({ done: true });
}
