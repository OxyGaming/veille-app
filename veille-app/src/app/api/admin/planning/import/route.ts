import { NextResponse } from "next/server";
import { canActOnTeam, effectiveTeamIds, requireRole } from "@/lib/auth";
import {
  commitPlanningImport,
  previewPlanningImport,
} from "@/lib/planning/import";

/**
 * POST /api/admin/planning/import — importe le planning D'UNE ÉQUIPE.
 *
 * Cloisonnement (cf. memory/planning-import-rules.md) :
 *  1. ADMIN ou EDITOR (USER → 403, lecture seule).
 *  2. Équipe cible explicite (champ `teamId`), dans le périmètre de l'acteur.
 *     Multi-équipes / ADMIN GLOBAL → choix obligatoire ; mono-équipe → déduit.
 *  3. L'import ÉCRASE uniquement le planning de l'équipe cible (per-team), pas
 *     celui des autres équipes.
 *  4. Seuls les agents appartenant à l'équipe cible sont résolus (les autres
 *     matricules sont comptés inconnus). Aucune création d'agent.
 */
export const dynamic = "force-dynamic";
export const maxDuration = 120;

const MAX_FILE_BYTES = 25 * 1024 * 1024;

export async function POST(req: Request) {
  let u;
  try {
    u = await requireRole(["ADMIN", "EDITOR"]);
  } catch (r) {
    return r as Response;
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json(
      { error: "Requête invalide (multipart attendu)." },
      { status: 400 },
    );
  }

  // Équipe cible : explicite, sinon déduite si l'acteur n'a qu'une équipe.
  const eff = effectiveTeamIds(u);
  const requestedTeamId = form.get("teamId");
  let teamId =
    typeof requestedTeamId === "string" && requestedTeamId
      ? requestedTeamId
      : null;
  if (!teamId) {
    if (eff !== null && eff.length === 1) {
      teamId = eff[0];
    } else {
      return NextResponse.json(
        {
          error: "Sélectionnez l'équipe cible de l'import.",
          code: "TEAM_REQUIRED",
        },
        { status: 400 },
      );
    }
  }
  if (!canActOnTeam(u, teamId)) {
    return NextResponse.json(
      { error: "Équipe cible hors de votre périmètre." },
      { status: 403 },
    );
  }

  const file = form.get("file");
  if (!(file instanceof Blob)) {
    return NextResponse.json({ error: "Fichier manquant." }, { status: 400 });
  }
  if (file.size === 0) {
    return NextResponse.json({ error: "Fichier vide." }, { status: 400 });
  }
  if (file.size > MAX_FILE_BYTES) {
    return NextResponse.json(
      {
        error: `Fichier trop volumineux (${(file.size / 1024 / 1024).toFixed(
          1,
        )} Mo > ${MAX_FILE_BYTES / 1024 / 1024} Mo).`,
      },
      { status: 413 },
    );
  }

  const fileName = file instanceof File ? file.name : null;
  const buffer = Buffer.from(await file.arrayBuffer());

  const t0 = Date.now();
  let preview;
  try {
    preview = await previewPlanningImport(buffer, teamId);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erreur de parsing.";
    return NextResponse.json(
      { error: `Parsing impossible : ${msg}` },
      { status: 422 },
    );
  }

  try {
    const result = await commitPlanningImport(preview, {
      teamId,
      importedById: u.id,
      importedByEmail: u.email,
      fileName,
    });
    return NextResponse.json({
      importId: result.importId,
      fileName,
      rowsTotal: preview.rowsTotal,
      rowsService: preview.rowsService,
      rowsNonService: preview.rowsNonService,
      rowsImported: result.rowsImported,
      rowsIgnored: preview.rowsIgnored,
      rowsErrored: preview.rowsErrored,
      unknownMatriculesCount: preview.unknownMatricules.length,
      periodStart: preview.periodStart?.toISOString() ?? null,
      periodEnd: preview.periodEnd?.toISOString() ?? null,
      elapsedMs: Date.now() - t0,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erreur d'import.";
    return NextResponse.json(
      { error: `Import échoué : ${msg}` },
      { status: 500 },
    );
  }
}
