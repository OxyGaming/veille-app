import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser, teamScope } from "@/lib/auth";

async function loadScoped(
  id: string,
  u: Awaited<ReturnType<typeof requireUser>>
) {
  return prisma.siteVisit.findFirst({
    where: { id, ...teamScope(u) },
    include: {
      template: {
        include: {
          sections: {
            include: {
              items: { where: { isActive: true }, orderBy: { sortOrder: "asc" } },
            },
            orderBy: { sortOrder: "asc" },
            where: { isActive: true },
          },
        },
      },
      site: true,
      observer: { select: { id: true, name: true } },
      participants: { orderBy: { sortOrder: "asc" } },
      observations: true,
      nonConformities: { orderBy: { sortOrder: "asc" } },
    },
  });
}

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  let u;
  try {
    u = await requireUser();
  } catch (r) {
    return r as Response;
  }
  const { id } = await ctx.params;
  const v = await loadScoped(id, u);
  if (!v) return NextResponse.json({ error: "Inconnu" }, { status: 404 });
  return NextResponse.json(v);
}

const patchSchema = z.object({
  status: z.enum(["draft", "active", "completed", "archived"]).optional(),
  generalComment: z.string().nullable().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  let u;
  try {
    u = await requireUser();
  } catch (r) {
    return r as Response;
  }
  const { id } = await ctx.params;
  const existing = await loadScoped(id, u);
  if (!existing) return NextResponse.json({ error: "Inconnu" }, { status: 404 });
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Requête invalide" }, { status: 400 });
  }
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Données invalides", issues: parsed.error.flatten() },
      { status: 400 }
    );
  }
  const data = parsed.data;
  const finishedAt = data.status === "completed" ? new Date() : undefined;
  const updated = await prisma.siteVisit.update({
    where: { id },
    data: {
      status: data.status,
      generalComment:
        data.generalComment === undefined ? undefined : data.generalComment,
      metadata: data.metadata ? JSON.stringify(data.metadata) : undefined,
      finishedAt,
    },
  });
  return NextResponse.json(updated);
}
