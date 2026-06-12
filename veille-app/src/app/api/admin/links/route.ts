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
  const categories = await prisma.linkCategory.findMany({
    orderBy: { sortOrder: "asc" },
    include: { links: { orderBy: { sortOrder: "asc" } } },
  });
  return NextResponse.json(categories);
}

const linkSchema = z.object({
  kind: z.literal("link"),
  id: z.string().optional(),
  categoryId: z.string().min(1),
  label: z.string().min(1),
  url: z.string().url(),
  description: z.string().nullable().optional(),
  icon: z.string().nullable().optional(),
  color: z.string().nullable().optional(),
  sortOrder: z.number().int().default(0),
  isActive: z.boolean().default(true),
});

const categorySchema = z.object({
  kind: z.literal("category"),
  id: z.string().optional(),
  name: z.string().min(1),
  icon: z.string().nullable().optional(),
  color: z.string().nullable().optional(),
  sortOrder: z.number().int().default(0),
  isActive: z.boolean().default(true),
});

const schema = z.discriminatedUnion("kind", [linkSchema, categorySchema]);

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
  if (parsed.data.kind === "category") {
    const d = parsed.data;
    if (d.id) {
      const u = await prisma.linkCategory.update({
        where: { id: d.id },
        data: {
          name: d.name,
          icon: d.icon ?? null,
          color: d.color ?? null,
          sortOrder: d.sortOrder,
          isActive: d.isActive,
        },
      });
      return NextResponse.json(u);
    }
    const c = await prisma.linkCategory.create({
      data: {
        name: d.name,
        icon: d.icon ?? null,
        color: d.color ?? null,
        sortOrder: d.sortOrder,
        isActive: d.isActive,
      },
    });
    return NextResponse.json(c);
  }
  const d = parsed.data;
  if (d.id) {
    const u = await prisma.link.update({
      where: { id: d.id },
      data: {
        categoryId: d.categoryId,
        label: d.label,
        url: d.url,
        description: d.description ?? null,
        icon: d.icon ?? null,
        color: d.color ?? null,
        sortOrder: d.sortOrder,
        isActive: d.isActive,
      },
    });
    return NextResponse.json(u);
  }
  const l = await prisma.link.create({
    data: {
      categoryId: d.categoryId,
      label: d.label,
      url: d.url,
      description: d.description ?? null,
      icon: d.icon ?? null,
      color: d.color ?? null,
      sortOrder: d.sortOrder,
      isActive: d.isActive,
    },
  });
  return NextResponse.json(l);
}
