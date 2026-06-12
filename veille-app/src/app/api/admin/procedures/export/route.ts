import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";

/**
 * Export JSON de toutes les procédures + leurs items.
 *
 * Format versionné — `version: 1`. Permet de migrer un référentiel d'un
 * environnement à l'autre, ou de sauvegarder avant un import massif.
 *
 * Documents sont stockés en JSON dans la BDD ; on les re-décode pour donner
 * un vrai tableau côté export.
 */
export async function GET() {
  try {
    await requireRole(["ADMIN", "EDITOR"]);
  } catch (r) {
    return r as Response;
  }
  const procs = await prisma.procedure.findMany({
    where: { isActive: true },
    orderBy: [{ domain: "asc" }, { sortOrder: "asc" }],
    include: {
      items: {
        where: { isActive: true },
        orderBy: { sortOrder: "asc" },
      },
    },
  });
  const payload = {
    version: 1,
    exportedAt: new Date().toISOString(),
    count: procs.length,
    procedures: procs.map((p) => ({
      domain: p.domain,
      theme: p.theme,
      title: p.title,
      gravity: p.gravity,
      documents: safeJSONArray(p.documents),
      risk: p.risk,
      sortOrder: p.sortOrder,
      requireGeneralComment: p.requireGeneralComment,
      items: p.items.map((it) => ({
        label: it.label,
        gravity: it.gravity,
        sortOrder: it.sortOrder,
        requireCommentIfKO: it.requireCommentIfKO,
        requirePhotoIfKO: it.requirePhotoIfKO,
      })),
    })),
  };
  const body = JSON.stringify(payload, null, 2);
  const filename = `procedures-${new Date().toISOString().slice(0, 10)}.json`;
  return new Response(body, {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}

function safeJSONArray(s: string): unknown[] {
  try {
    const p = JSON.parse(s);
    return Array.isArray(p) ? p : [];
  } catch {
    return [];
  }
}
