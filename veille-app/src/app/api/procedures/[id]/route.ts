import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole, requireUser } from "@/lib/auth";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    await requireUser();
  } catch (r) {
    return r as Response;
  }
  const { id } = await ctx.params;
  const p = await prisma.procedure.findUnique({
    where: { id },
    include: {
      items: { where: { isActive: true }, orderBy: { sortOrder: "asc" } },
    },
  });
  if (!p) return NextResponse.json({ error: "Inconnu" }, { status: 404 });
  return NextResponse.json(p);
}

const updateSchema = z.object({
  domain: z.string().min(1).optional(),
  theme: z.string().optional().nullable(),
  title: z.string().min(1).optional(),
  gravity: z.number().int().min(0).max(4).optional(),
  documents: z.array(z.string()).optional(),
  risk: z.string().optional().nullable(),
  requireGeneralComment: z.boolean().optional(),
  isActive: z.boolean().optional(),
  items: z
    .array(
      z.object({
        id: z.string().optional(),
        label: z.string().min(1),
        gravity: z.number().int().min(0).max(4).nullable().optional(),
        requireCommentIfKO: z.boolean().default(false),
        requirePhotoIfKO: z.boolean().default(false),
        isActive: z.boolean().default(true),
      })
    )
    .optional(),
});

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    await requireRole(["ADMIN", "EDITOR"]);
  } catch (r) {
    return r as Response;
  }
  const { id } = await ctx.params;
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Requête invalide" }, { status: 400 });
  }
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Données invalides", issues: parsed.error.flatten() },
      { status: 400 }
    );
  }
  const data = parsed.data;

  const updated = await prisma.$transaction(async (tx) => {
    await tx.procedure.update({
      where: { id },
      data: {
        domain: data.domain,
        theme: data.theme ?? undefined,
        title: data.title,
        gravity: data.gravity,
        documents:
          data.documents !== undefined ? JSON.stringify(data.documents) : undefined,
        risk: data.risk ?? undefined,
        requireGeneralComment: data.requireGeneralComment,
        isActive: data.isActive,
      },
    });

    if (data.items) {
      const existing = await tx.checklistItem.findMany({
        where: { procedureId: id },
      });
      const incomingIds = new Set(data.items.filter((i) => i.id).map((i) => i.id!));
      const toDelete = existing.filter((e) => !incomingIds.has(e.id));
      // Soft-delete : on désactive, on ne supprime pas (historique).
      if (toDelete.length) {
        await tx.checklistItem.updateMany({
          where: { id: { in: toDelete.map((e) => e.id) } },
          data: { isActive: false },
        });
      }
      for (let i = 0; i < data.items.length; i++) {
        const it = data.items[i];
        if (it.id) {
          await tx.checklistItem.update({
            where: { id: it.id },
            data: {
              label: it.label,
              gravity: it.gravity ?? null,
              requireCommentIfKO: it.requireCommentIfKO,
              requirePhotoIfKO: it.requirePhotoIfKO,
              sortOrder: i,
              isActive: it.isActive,
            },
          });
        } else {
          await tx.checklistItem.create({
            data: {
              procedureId: id,
              label: it.label,
              gravity: it.gravity ?? null,
              requireCommentIfKO: it.requireCommentIfKO,
              requirePhotoIfKO: it.requirePhotoIfKO,
              sortOrder: i,
            },
          });
        }
      }
    }
    return tx.procedure.findUnique({
      where: { id },
      include: {
        items: { where: { isActive: true }, orderBy: { sortOrder: "asc" } },
      },
    });
  });
  return NextResponse.json(updated);
}

export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    await requireRole("ADMIN");
  } catch (r) {
    return r as Response;
  }
  const { id } = await ctx.params;
  // Soft-delete.
  await prisma.procedure.update({ where: { id }, data: { isActive: false } });
  return NextResponse.json({ ok: true });
}
