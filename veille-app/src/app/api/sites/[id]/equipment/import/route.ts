import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser, siteScope } from "@/lib/auth";

/**
 * Import CSV de bootstrap pour le catalogue d'équipements d'un site.
 *
 * Format attendu (CSV utf-8 avec BOM toléré) — extrait d'une ancienne
 * application PowerApps :
 *
 *   Titre, Localisation, TypeEquipement, Perissable, DateFin, Present,
 *   DateVerification, Quantite, Commentaire
 *
 * Mapping vers SiteEquipment :
 *   - Titre            -> label
 *   - TypeEquipement   -> category
 *   - Perissable (Vrai/Faux) -> isPerishable
 *   - DateFin          -> expirationDate (parse DD/MM/YYYY)
 *   - Quantite         -> expectedQuantity (Int? si présent)
 *   - Commentaire      -> notes (sauf "RAS" / vide)
 *
 * Les colonnes Localisation / Present / DateVerification sont ignorées
 * (la localisation est l'URL du site ; Present/DateVerif concernent un
 * contrôle, pas le référentiel).
 *
 * Idempotent : clé naturelle (siteId, label normalisé). Si trouvé, on
 * met à jour (catégorie, périssable, etc.) ; sinon on crée.
 *
 * Réservé ADMIN/EDITOR.
 */
export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  let u;
  try {
    u = await requireUser();
  } catch (r) {
    return r as Response;
  }
  if (u.role !== "ADMIN" && u.role !== "EDITOR") {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }
  const { id: siteId } = await ctx.params;
  const site = await prisma.site.findFirst({
    where: { id: siteId, ...siteScope(u) },
    select: { id: true, name: true },
  });
  if (!site)
    return NextResponse.json({ error: "Site introuvable" }, { status: 404 });

  let body: { csv?: string; siteFilter?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON attendu" }, { status: 400 });
  }
  const csv = body.csv ?? "";
  // Filtre optionnel sur la colonne Localisation — utile quand le CSV
  // contient plusieurs sites et qu'on ne veut importer que celles
  // pour le site courant. Par défaut on déduit depuis site.name.
  const expectedLoc = (body.siteFilter ?? site.name).trim().toLowerCase();
  if (!csv.trim())
    return NextResponse.json({ error: "CSV vide" }, { status: 400 });

  const rows = parseCSV(csv);
  if (rows.length < 2)
    return NextResponse.json(
      { error: "CSV sans donnée (en-tête seule)" },
      { status: 400 }
    );

  const headers = rows[0].map((h) => h.trim());
  const col = (name: string) =>
    headers.findIndex((h) => norm(h) === norm(name));
  const I_TITRE = col("Titre");
  const I_LOC = col("Localisation");
  const I_TYPE = col("TypeEquipement");
  const I_PER = col("Perissable");
  const I_FIN = col("DateFin");
  const I_QTE = col("Quantite");
  const I_COM = col("Commentaire");
  if (I_TITRE < 0 || I_TYPE < 0) {
    return NextResponse.json(
      {
        error:
          "Colonnes manquantes — attendu au minimum Titre et TypeEquipement.",
      },
      { status: 400 }
    );
  }

  // Préchargement du catalogue existant pour dédup.
  const existing = await prisma.siteEquipment.findMany({
    where: { siteId },
    select: { id: true, label: true },
  });
  const byKey = new Map(existing.map((e) => [norm(e.label), e.id]));

  const report = {
    received: rows.length - 1,
    matchedSite: 0,
    created: 0,
    updated: 0,
    skippedOtherSite: 0,
    errors: [] as string[],
  };

  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    try {
      const label = (row[I_TITRE] ?? "").replace(/[\r\n]+/g, " ").trim();
      if (!label) continue;
      const loc = I_LOC >= 0 ? norm(row[I_LOC] ?? "") : "";
      if (I_LOC >= 0 && loc !== norm(expectedLoc)) {
        report.skippedOtherSite++;
        continue;
      }
      report.matchedSite++;
      const category = (row[I_TYPE] ?? "").trim() || "Divers";
      const isPerishable = parseBool(I_PER >= 0 ? row[I_PER] : "");
      const expirationDate =
        I_FIN >= 0 ? parseFrDate(row[I_FIN] ?? "") : null;
      const qtyRaw = I_QTE >= 0 ? (row[I_QTE] ?? "").trim() : "";
      const expectedQuantity = qtyRaw && /^\d+$/.test(qtyRaw)
        ? Number(qtyRaw)
        : null;
      const comment = (row[I_COM] ?? "").trim();
      const notes =
        comment && !["ras", "ok"].includes(comment.toLowerCase())
          ? comment
          : null;

      const key = norm(label);
      const id = byKey.get(key);
      if (id) {
        await prisma.siteEquipment.update({
          where: { id },
          data: {
            category,
            expectedQuantity,
            isPerishable,
            expirationDate,
            notes,
            isActive: true,
          },
        });
        report.updated++;
      } else {
        const created = await prisma.siteEquipment.create({
          data: {
            siteId,
            label,
            category,
            expectedQuantity,
            isPerishable,
            expirationDate,
            notes,
            sortOrder: r,
          },
        });
        byKey.set(key, created.id);
        report.created++;
      }
    } catch (e: unknown) {
      report.errors.push(
        `Ligne ${r + 1} : ${e instanceof Error ? e.message : String(e)}`
      );
    }
  }

  return NextResponse.json(report);
}

/* ============================================================================
 *  Parsing CSV (réutilise le pattern de imports/pointages : BOM, quotes
 *  multilignes, commas dans les champs).
 * ========================================================================== */

function parseCSV(text: string): string[][] {
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else inQuotes = false;
      } else field += c;
    } else {
      if (c === '"') inQuotes = true;
      else if (c === ",") {
        row.push(field);
        field = "";
      } else if (c === "\n" || c === "\r") {
        if (c === "\r" && text[i + 1] === "\n") i++;
        row.push(field);
        field = "";
        if (row.length > 1 || row[0] !== "") rows.push(row);
        row = [];
      } else field += c;
    }
  }
  if (field !== "" || row.length) {
    row.push(field);
    if (row.length > 1 || row[0] !== "") rows.push(row);
  }
  return rows;
}

function norm(s: string | undefined): string {
  if (!s) return "";
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function parseBool(s: string | undefined): boolean {
  const n = norm(s);
  return n === "vrai" || n === "true" || n === "oui" || n === "1";
}

function parseFrDate(s: string): Date | null {
  const t = (s ?? "").trim();
  if (!t) return null;
  const m = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return null;
  const d = new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
  return isNaN(d.getTime()) ? null : d;
}
