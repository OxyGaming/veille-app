import { NextResponse } from "next/server";
import { canActOnTeam, effectiveTeamIds, requireRole } from "@/lib/auth";
import { previewPlanningImport } from "@/lib/planning/import";

/**
 * POST /api/admin/planning/preview — analyse un fichier ODS/XLSX de planning
 * et renvoie un récapitulatif chiffré. **Aucune écriture en DB.**
 *
 * Réservé au rôle ADMIN (USER/EDITOR refusés avec 403).
 *
 * Payload : multipart/form-data avec champ `file` (Blob).
 * Réponse JSON :
 *  - fileName, fileSizeBytes
 *  - rowsTotal / rowsService / rowsNonService / rowsImported / rowsIgnored / rowsErrored
 *  - unknownMatricules (liste tronquée à 50 pour ne pas alourdir la réponse)
 *  - unknownMatriculesCount (total non tronqué)
 *  - errors (tronqué à 50)
 *  - periodStart / periodEnd (ISO)
 *  - rawUchSummary (objet — info brute, jamais utilisée pour le scope)
 *
 * `resolvedShifts` n'est PAS renvoyé (volume + pas utile côté UI).
 * Le commit `/import` reparse le fichier — opération stateless.
 */
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MAX_FILE_BYTES = 25 * 1024 * 1024; // 25 Mo — large pour un planning ODS
const PREVIEW_UNKNOWN_LIMIT = 50;
const PREVIEW_ERROR_LIMIT = 50;

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

  // Équipe cible : la preview scope la résolution des matricules à cette équipe.
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
        { error: "Sélectionnez l'équipe cible.", code: "TEAM_REQUIRED" },
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

  try {
    const preview = await previewPlanningImport(buffer, teamId);
    return NextResponse.json({
      fileName,
      fileSizeBytes: file.size,
      rowsTotal: preview.rowsTotal,
      rowsService: preview.rowsService,
      rowsNonService: preview.rowsNonService,
      rowsImported: preview.rowsImported,
      rowsIgnored: preview.rowsIgnored,
      rowsErrored: preview.rowsErrored,
      unknownMatricules: preview.unknownMatricules.slice(
        0,
        PREVIEW_UNKNOWN_LIMIT,
      ),
      unknownMatriculesCount: preview.unknownMatricules.length,
      errors: preview.errors.slice(0, PREVIEW_ERROR_LIMIT),
      errorsCount: preview.errors.length,
      periodStart: preview.periodStart?.toISOString() ?? null,
      periodEnd: preview.periodEnd?.toISOString() ?? null,
      rawUchSummary: preview.rawUchSummary,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erreur de parsing.";
    return NextResponse.json(
      { error: `Parsing impossible : ${msg}` },
      { status: 422 },
    );
  }
}
