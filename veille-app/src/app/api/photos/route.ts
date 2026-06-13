import { NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";
import { requireUser, teamScope } from "@/lib/auth";

const UPLOAD_DIR =
  process.env.VEILLE_UPLOAD_DIR ||
  join(process.cwd(), "public", "uploads");

export async function POST(req: Request) {
  let u;
  try {
    u = await requireUser();
  } catch (r) {
    return r as Response;
  }
  const form = await req.formData();
  const file = form.get("file");
  const observationId = form.get("observationId");
  const sessionId = form.get("sessionId");
  const agentSightingId = form.get("agentSightingId");
  const siteSightingId = form.get("siteSightingId");
  const legend = (form.get("legend") as string) || null;
  const clientId = (form.get("clientId") as string) || null;
  if (!(file instanceof Blob)) {
    return NextResponse.json({ error: "Fichier manquant" }, { status: 400 });
  }
  if (!observationId && !sessionId && !agentSightingId && !siteSightingId) {
    return NextResponse.json(
      {
        error:
          "observationId, sessionId, agentSightingId ou siteSightingId requis",
      },
      { status: 400 }
    );
  }

  // Vérif scope team via le parent référencé.
  let teamId: string | null = null;
  if (typeof observationId === "string" && observationId) {
    const obs = await prisma.observationItem.findUnique({
      where: { id: observationId },
      include: { procedureObservation: { include: { session: true } } },
    });
    if (!obs)
      return NextResponse.json({ error: "Observation inconnue" }, { status: 404 });
    teamId = obs.procedureObservation.session.teamId;
  } else if (typeof sessionId === "string" && sessionId) {
    const s = await prisma.veilleSession.findUnique({ where: { id: sessionId } });
    if (!s) return NextResponse.json({ error: "Session inconnue" }, { status: 404 });
    teamId = s.teamId;
  } else if (typeof agentSightingId === "string" && agentSightingId) {
    const sg = await prisma.agentSighting.findUnique({
      where: { id: agentSightingId },
    });
    if (!sg)
      return NextResponse.json(
        { error: "Sighting agent inconnu" },
        { status: 404 }
      );
    teamId = sg.teamId;
  } else if (typeof siteSightingId === "string" && siteSightingId) {
    const sg = await prisma.siteSighting.findUnique({
      where: { id: siteSightingId },
    });
    if (!sg)
      return NextResponse.json(
        { error: "Sighting site inconnu" },
        { status: 404 }
      );
    teamId = sg.teamId;
  }
  const scope = teamScope(u);
  // Note : scope.teamId peut être un objet { in: [...] } depuis le refactor
  // multi-équipes ; on accepte si teamId fait partie de la liste autorisée.
  if (scope.teamId && typeof scope.teamId === "object" && "in" in scope.teamId) {
    if (!teamId || !scope.teamId.in.includes(teamId)) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }
  } else if (
    typeof scope.teamId === "string" &&
    scope.teamId !== teamId
  ) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  // Persistence disque.
  // Nom de fichier : timestamp + 64 chars hex (256 bits d'entropie).
  // Mitigation tactique US-1.5 — anti-énumération en attendant le refactor
  // complet (route streaming auth + stockage hors `public/`) prévu Sprint 3.
  // Cf. AUDIT.md §C1 / DECISIONS-SPRINT1.md commit 8.
  const buf = Buffer.from(await file.arrayBuffer());
  const name = `${Date.now()}_${randomBytes(32).toString("hex")}.jpg`;
  const dir = join(UPLOAD_DIR, "photos");
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, name), buf);
  const storagePath = `/uploads/photos/${name}`;

  const created = await prisma.photo.create({
    data: {
      observationId: (observationId as string) || null,
      sessionId: (sessionId as string) || null,
      agentSightingId: (agentSightingId as string) || null,
      siteSightingId: (siteSightingId as string) || null,
      uploaderId: u.id,
      storagePath,
      clientId,
      legend,
      byteSize: buf.byteLength,
      syncStatus: "SYNCED",
    },
  });
  return NextResponse.json(created);
}
