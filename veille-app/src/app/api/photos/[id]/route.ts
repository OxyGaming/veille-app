import { NextResponse } from "next/server";
import { unlink } from "fs/promises";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { resolvePhotoFilePath } from "@/lib/photoStorage";

const patchSchema = z.object({
  legend: z.string().nullable().optional(),
});

/** Édition légère d'une photo (légende). */
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
  const photo = await prisma.photo.findUnique({ where: { id } });
  if (!photo) return NextResponse.json({ error: "Inconnu" }, { status: 404 });
  // Seul l'uploader ou un admin peut modifier.
  if (photo.uploaderId !== u.id && u.role !== "ADMIN") {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }
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
  const updated = await prisma.photo.update({
    where: { id },
    data: {
      legend: parsed.data.legend === undefined ? undefined : parsed.data.legend,
    },
  });
  return NextResponse.json(updated);
}

/**
 * Suppression d'une photo — supprime aussi le fichier disque (exigence RGPD :
 * droit à l'effacement). Réservé à l'uploader ou un ADMIN.
 *
 * Pas de soft-delete : la photo n'a pas vraiment de raison de rester si on
 * la supprime — c'est un retrait demandé.
 */
export async function DELETE(
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
  const photo = await prisma.photo.findUnique({ where: { id } });
  if (!photo) return NextResponse.json({ error: "Inconnu" }, { status: 404 });
  if (photo.uploaderId !== u.id && u.role !== "ADMIN") {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  // Suppression du fichier disque : multi-format (private/legacy) via le
  // helper. On accepte ENOENT (déjà absent) pour ne pas bloquer la
  // suppression de la row.
  const loc = resolvePhotoFilePath(photo.storagePath);
  if (loc) {
    await unlink(loc.absolutePath).catch((e: NodeJS.ErrnoException) => {
      if (e.code !== "ENOENT") throw e;
    });
  }
  await prisma.photo.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
