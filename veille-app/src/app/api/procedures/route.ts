import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole, requireUser } from "@/lib/auth";

export async function GET() {
  try {
    await requireUser();
  } catch (r) {
    return r as Response;
  }
  const procedures = await prisma.procedure.findMany({
    where: { isActive: true },
    include: { items: { where: { isActive: true }, orderBy: { sortOrder: "asc" } } },
    orderBy: [{ domain: "asc" }, { sortOrder: "asc" }, { title: "asc" }],
  });
  return NextResponse.json(procedures);
}

const createSchema = z.object({
  domain: z.string().min(1),
  theme: z.string().optional().nullable(),
  title: z.string().min(1),
  gravity: z.number().int().min(0).max(4).default(3),
  documents: z.array(z.string()).default([]),
  risk: z.string().optional().nullable(),
  requireGeneralComment: z.boolean().default(false),
  items: z
    .array(
      z.object({
        label: z.string().min(1),
        gravity: z.number().int().min(0).max(4).nullable().optional(),
        requireCommentIfKO: z.boolean().default(false),
        requirePhotoIfKO: z.boolean().default(false),
        helpReference: z.string().nullable().optional(),
        helpText: z.string().nullable().optional(),
      })
    )
    .default([]),
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
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Données invalides", issues: parsed.error.flatten() },
      { status: 400 }
    );
  }
  const data = parsed.data;
  const proc = await prisma.procedure.create({
    data: {
      domain: data.domain,
      theme: data.theme ?? undefined,
      title: data.title,
      gravity: data.gravity,
      documents: JSON.stringify(data.documents),
      risk: data.risk ?? undefined,
      requireGeneralComment: data.requireGeneralComment,
      items: {
        create: data.items.map((it, i) => ({
          label: it.label,
          gravity: it.gravity ?? null,
          requireCommentIfKO: it.requireCommentIfKO,
          requirePhotoIfKO: it.requirePhotoIfKO,
          helpReference: it.helpReference ?? null,
          helpText: it.helpText ?? null,
          sortOrder: i,
        })),
      },
    },
    include: { items: true },
  });
  return NextResponse.json(proc);
}
