import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";

/**
 * Import JSON de procédures (format produit par `/export`).
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
    version: z.number().int().min(1).max(1),
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
              await tx.checklistItem.update({
                where: { id: ex.id },
                data: {
                  label: it.label,
                  gravity: it.gravity ?? null,
                  sortOrder: it.sortOrder ?? j,
                  requireCommentIfKO: it.requireCommentIfKO,
                  requirePhotoIfKO: it.requirePhotoIfKO,
                  isActive: true,
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
