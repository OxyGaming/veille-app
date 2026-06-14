import { NextResponse } from "next/server";
import { readFile } from "fs/promises";
import { prisma } from "@/lib/prisma";
import { requireUser, assertTeamAccess } from "@/lib/auth";
import { resolvePhotoFilePath } from "@/lib/photoStorage";
import { log } from "@/lib/logger";

export const runtime = "nodejs";

/**
 * Lecture authentifiée d'une photo (Sprint 3 C9).
 *
 * Remplace l'accès direct à `/uploads/photos/...` (public en V1).
 *
 * Contrôles :
 *  - utilisateur connecté (`requireUser`)
 *  - utilisateur a accès à l'équipe propriétaire (`assertTeamAccess`) via
 *    la session, l'observation, le sighting agent ou le sighting site.
 *
 * Cohabitation : sert aussi bien les nouvelles photos (storagePath
 * `private:photos/...`) que les anciennes (`/uploads/photos/...`) le temps
 * que la migration soit jouée.
 */
export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
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
    include: {
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
    },
  });

  if (!photo) {
    return NextResponse.json({ error: "Inconnu" }, { status: 404 });
  }

  const teamId =
    photo.session?.teamId ??
    photo.observation?.procedureObservation.session.teamId ??
    photo.agentSighting?.teamId ??
    photo.siteSighting?.teamId ??
    null;

  if (!teamId || !assertTeamAccess(u, teamId)) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  const loc = resolvePhotoFilePath(photo.storagePath);
  if (!loc) {
    log.warn("photo.invalidStoragePath", { photoId: id });
    return NextResponse.json({ error: "Fichier introuvable" }, { status: 404 });
  }

  let buf: Buffer;
  try {
    buf = await readFile(loc.absolutePath);
  } catch (e: unknown) {
    const err = e as NodeJS.ErrnoException;
    if (err.code === "ENOENT") {
      return NextResponse.json(
        { error: "Fichier introuvable" },
        { status: 404 },
      );
    }
    log.error("photo.readFile", { photoId: id, code: err.code });
    return NextResponse.json({ error: "Erreur disque" }, { status: 500 });
  }

  return new NextResponse(new Uint8Array(buf), {
    status: 200,
    headers: {
      "Content-Type": "image/jpeg",
      // Cache privé : navigateur uniquement, pas les proxies partagés.
      // 5 min pour rester fluide en navigation tout en restant court si la
      // photo est supprimée (RGPD).
      "Cache-Control": "private, max-age=300",
      "Content-Length": String(buf.byteLength),
      "X-Content-Type-Options": "nosniff",
    },
  });
}
