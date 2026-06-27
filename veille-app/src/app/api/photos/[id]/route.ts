import { NextResponse } from "next/server";
import { unlink } from "fs/promises";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { assertTeamAccess, requireUser } from "@/lib/auth";
import { resolvePhotoFilePath } from "@/lib/photoStorage";

/** Inclusions pour résoudre l'équipe propriétaire d'une photo via son parent. */
const PHOTO_TEAM_INCLUDE = {
  session: { select: { teamId: true } },
  observation: {
    select: {
      procedureObservation: {
        select: { session: { select: { teamId: true } } },
      },
    },
  },
  agentSighting: { select: { teamId: true } },
  siteSighting: { select: { teamId: true } },
  rci: { select: { teamId: true } },
} as const;

type PhotoWithTeam = {
  session: { teamId: string } | null;
  observation: {
    procedureObservation: { session: { teamId: string } };
  } | null;
  agentSighting: { teamId: string } | null;
  siteSighting: { teamId: string } | null;
  rci: { teamId: string } | null;
};

function photoTeamId(p: PhotoWithTeam): string | null {
  return (
    p.session?.teamId ??
    p.observation?.procedureObservation.session.teamId ??
    p.agentSighting?.teamId ??
    p.siteSighting?.teamId ??
    p.rci?.teamId ??
    null
  );
}

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
  const photo = await prisma.photo.findUnique({
    where: { id },
    include: PHOTO_TEAM_INCLUDE,
  });
  if (!photo) return NextResponse.json({ error: "Inconnu" }, { status: 404 });
  // Cloisonnement : la photo doit appartenir au périmètre de l'utilisateur…
  const teamId = photoTeamId(photo);
  if (!teamId || !assertTeamAccess(u, teamId)) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }
  // …et seul l'uploader ou un admin peut la modifier.
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
  const photo = await prisma.photo.findUnique({
    where: { id },
    include: PHOTO_TEAM_INCLUDE,
  });
  if (!photo) return NextResponse.json({ error: "Inconnu" }, { status: 404 });
  // Cloisonnement : la photo doit appartenir au périmètre de l'utilisateur…
  const teamId = photoTeamId(photo);
  if (!teamId || !assertTeamAccess(u, teamId)) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }
  // …et seul l'uploader ou un admin peut la supprimer.
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
