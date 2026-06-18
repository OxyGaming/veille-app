import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";

/**
 * Import JSON de procédures (format produit par `/export`).
 *
 * Accepte version: 1 (héritage, sans champs d'aide réglementaire) ET
 * version: 2 (depuis l'ajout de helpReference/helpText/historic*). Pour
 * un payload v1 : les nouveaux champs sont absents (undefined) et on ne
 * touche pas aux valeurs existantes côté DB pour ne pas écraser des
 * popovers d'aide qui auraient été enrichis depuis l'export.
 *
 * Stratégie « merge » (par défaut) :
 *  - clé naturelle = (domain, title) — insensible à la casse
 *  - si la procédure existe : on met à jour ses scalaires et on remplace ses
 *    items (delete-all-then-create)
 *  - sinon : on crée
 *
 * Stratégie « add-only » :
 *  - n'écrase rien — skip si la clé existe déjà
 *
 * Body : { strategy: "merge"|"add-only", payload: { version, procedures: [...] } }
 * Réponse : { created, updated, skipped, items: { created }, errors[] }
 */
const itemSchema = z.object({
  label: z.string().min(1).max(500),
  gravity: z.number().int().min(0).max(4).nullable().optional(),
  sortOrder: z.number().int().default(0),
  requireCommentIfKO: z.boolean().default(false),
  requirePhotoIfKO: z.boolean().default(false),
  // Ajoutés en v2 — optionnels pour rétrocompat. `optional()` SANS `default()`
  // → on peut distinguer « absent » (= ne pas toucher) de « explicitement
  // null » (= effacer le champ côté DB).
  helpReference: z.string().nullable().optional(),
  helpText: z.string().nullable().optional(),
  historicConformPct: z.number().int().min(0).max(100).nullable().optional(),
  historicSampleSize: z.number().int().min(0).nullable().optional(),
});

const procSchema = z.object({
  domain: z.string().min(1).max(100),
  theme: z.string().nullable().optional(),
  title: z.string().min(1).max(300),
  gravity: z.number().int().min(0).max(4).default(3),
  documents: z.array(z.unknown()).default([]),
  risk: z.string().nullable().optional(),
  sortOrder: z.number().int().default(0),
  requireGeneralComment: z.boolean().default(false),
  items: z.array(itemSchema).default([]),
});

const schema = z.object({
  strategy: z.enum(["merge", "add-only"]).default("merge"),
  payload: z.object({
    // Versions supportées : 1 (legacy) et 2 (avec champs d'aide). Un fichier
    // v1 importé ne touchera pas helpReference/helpText/historic* des
    // procédures existantes (champs absents = `undefined` → on ne met pas
    // dans `data` côté Prisma).
    version: z.number().int().min(1).max(2),
    procedures: z.array(procSchema).max(2000),
  }),
});

export async function POST(req: Request) {
  try {
    await requireRole(["ADMIN", "EDITOR"]);
  } catch (r) {
    return r as Response;
  }
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON invalide" }, { status: 400 });
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Données invalides", issues: parsed.error.flatten() },
      { status: 400 }
    );
  }
  const { strategy, payload } = parsed.data;

  const report = {
    strategy,
    received: payload.procedures.length,
    created: 0,
    updated: 0,
    skipped: 0,
    itemsCreated: 0,
    errors: [] as string[],
  };

  // Préchargement par clé naturelle (domain+title normalisé).
  const existing = await prisma.procedure.findMany({
    select: { id: true, domain: true, title: true },
  });
  const keyOf = (d: string, t: string) =>
    `${d.toLowerCase().trim()}|${t.toLowerCase().trim()}`;
  const existingByKey = new Map(
    existing.map((p) => [keyOf(p.domain, p.title), p])
  );

  for (let i = 0; i < payload.procedures.length; i++) {
    const p = payload.procedures[i];
    try {
      const key = keyOf(p.domain, p.title);
      const found = existingByKey.get(key);
      if (found) {
        if (strategy === "add-only") {
          report.skipped++;
          continue;
        }
        // Merge : upsert items par label (clé naturelle) pour préserver les FK
        // vers les observations existantes. Items absents de l'import sont
        // soft-deleted (isActive=false).
        await prisma.$transaction(async (tx) => {
          await tx.procedure.update({
            where: { id: found.id },
            data: {
              domain: p.domain,
              theme: p.theme ?? null,
              title: p.title,
              gravity: p.gravity,
              documents: JSON.stringify(p.documents),
              risk: p.risk ?? null,
              sortOrder: p.sortOrder,
              requireGeneralComment: p.requireGeneralComment,
              isActive: true,
            },
          });
          const existingItems = await tx.checklistItem.findMany({
            where: { procedureId: found.id },
            select: { id: true, label: true },
          });
          const itemByLabel = new Map(
            existingItems.map((it) => [it.label.toLowerCase().trim(), it])
          );
          const seen = new Set<string>();
          for (let j = 0; j < p.items.length; j++) {
            const it = p.items[j];
            const key = it.label.toLowerCase().trim();
            seen.add(key);
            const ex = itemByLabel.get(key);
            if (ex) {
              // Pour les champs v2 (helpReference, helpText, historic*),
              // on respecte la rétrocompat : `undefined` (absent du payload
              // v1) → on ne touche pas. Valeur fournie (y compris null) →
              // on l'écrit. Cela évite qu'un import v1 ancien efface des
              // popovers d'aide enrichis depuis.
              await tx.checklistItem.update({
                where: { id: ex.id },
                data: {
                  label: it.label,
                  gravity: it.gravity ?? null,
                  sortOrder: it.sortOrder ?? j,
                  requireCommentIfKO: it.requireCommentIfKO,
                  requirePhotoIfKO: it.requirePhotoIfKO,
                  isActive: true,
                  ...(it.helpReference !== undefined
                    ? { helpReference: it.helpReference }
                    : {}),
                  ...(it.helpText !== undefined
                    ? { helpText: it.helpText }
                    : {}),
                  ...(it.historicConformPct !== undefined
                    ? { historicConformPct: it.historicConformPct }
                    : {}),
                  ...(it.historicSampleSize !== undefined
                    ? { historicSampleSize: it.historicSampleSize }
                    : {}),
                },
              });
            } else {
              await tx.checklistItem.create({
                data: {
                  procedureId: found.id,
                  label: it.label,
                  gravity: it.gravity ?? null,
                  sortOrder: it.sortOrder ?? j,
                  requireCommentIfKO: it.requireCommentIfKO,
                  requirePhotoIfKO: it.requirePhotoIfKO,
                  helpReference: it.helpReference ?? null,
                  helpText: it.helpText ?? null,
                  historicConformPct: it.historicConformPct ?? null,
                  historicSampleSize: it.historicSampleSize ?? null,
                },
              });
              report.itemsCreated++;
            }
          }
          // Soft-delete des items absents de l'import.
          for (const ex of existingItems) {
            if (!seen.has(ex.label.toLowerCase().trim())) {
              await tx.checklistItem.update({
                where: { id: ex.id },
                data: { isActive: false },
              });
            }
          }
        });
        report.updated++;
      } else {
        // Création.
        await prisma.$transaction(async (tx) => {
          const proc = await tx.procedure.create({
            data: {
              domain: p.domain,
              theme: p.theme ?? null,
              title: p.title,
              gravity: p.gravity,
              documents: JSON.stringify(p.documents),
              risk: p.risk ?? null,
              sortOrder: p.sortOrder,
              requireGeneralComment: p.requireGeneralComment,
            },
          });
          if (p.items.length > 0) {
            await tx.checklistItem.createMany({
              data: p.items.map((it, j) => ({
                procedureId: proc.id,
                label: it.label,
                gravity: it.gravity ?? null,
                sortOrder: it.sortOrder ?? j,
                requireCommentIfKO: it.requireCommentIfKO,
                requirePhotoIfKO: it.requirePhotoIfKO,
                helpReference: it.helpReference ?? null,
                helpText: it.helpText ?? null,
                historicConformPct: it.historicConformPct ?? null,
                historicSampleSize: it.historicSampleSize ?? null,
              })),
            });
            report.itemsCreated += p.items.length;
          }
          existingByKey.set(key, {
            id: proc.id,
            domain: proc.domain,
            title: proc.title,
          });
        });
        report.created++;
      }
    } catch (e: unknown) {
      report.errors.push(
        `Procédure ${i + 1} (« ${p.title} ») : ${
          e instanceof Error ? e.message : String(e)
        }`
      );
    }
  }

  return NextResponse.json(report);
}
