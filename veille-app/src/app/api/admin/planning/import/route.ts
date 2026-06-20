import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import {
  commitPlanningImport,
  previewPlanningImport,
} from "@/lib/planning/import";

/**
 * POST /api/admin/planning/import — exécute l'import du planning.
 *
 * Pipeline :
 *  1. Auth ADMIN strict (USER/EDITOR → 403).
 *  2. Validation du fichier (taille, présence).
 *  3. Reparse complet du fichier (stateless — pas de cache entre /preview et /import).
 *  4. `commitPlanningImport()` : transaction unique
 *     `deleteMany shifts → deleteMany imports → create import → createMany shifts → AuditLog`.
 *  5. Renvoi des compteurs finaux + importId.
 *
 * **Aucune création** d'agent / d'équipe / de rattachement.
 * **Aucun code NPO** ne touche la base — filtre amont côté parser.
 *
 * Cf. memory/planning-import-rules.md pour les règles métier.
 */
export const dynamic = "force-dynamic";
export const maxDuration = 120;

const MAX_FILE_BYTES = 25 * 1024 * 1024;

export async function POST(req: Request) {
  let u;
  try {
    u = await requireRole(["ADMIN"]);
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
    preview = await previewPlanningImport(buffer);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erreur de parsing.";
    return NextResponse.json(
      { error: `Parsing impossible : ${msg}` },
      { status: 422 },
    );
  }

  try {
    const result = await commitPlanningImport(preview, {
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
