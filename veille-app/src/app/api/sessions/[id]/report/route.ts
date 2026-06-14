import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser, teamScope } from "@/lib/auth";

/**
 * Renvoie la structure du compte rendu en JSON. La génération PDF se fait
 * côté client (jsPDF dans le navigateur) pour éviter une dépendance lourde
 * côté serveur — la structure est figée ici comme contrat.
 */
export async function GET(
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
  const scope = teamScope(u);
  const session = await prisma.veilleSession.findFirst({
    where: { id, ...scope },
    include: {
      agent: true,
      observer: { select: { id: true, name: true, email: true } },
      poste: true,
      secteur: true,
      team: true,
      procedures: {
        include: {
          procedure: true,
          items: {
            include: {
              checklistItem: true,
              photos: true,
            },
          },
        },
      },
      photos: true,
    },
  });
  if (!session) return NextResponse.json({ error: "Inconnu" }, { status: 404 });

  const ncItems = session.procedures.flatMap((po) =>
    po.items
      .filter((i) => i.status === "NON_CONFORME" || i.status === "A_REVOIR")
      .map((i) => ({
        procedure: po.procedure.title,
        domain: po.procedure.domain,
        risk: po.procedure.risk,
        item: i.checklistItem.label,
        status: i.status,
        comment: i.comment,
        gravity: i.checklistItem.gravity ?? po.procedure.gravity,
        helpReference: i.checklistItem.helpReference,
        helpText: i.checklistItem.helpText,
        photos: i.photos.map((p) => `/api/photos/${p.id}/file`),
      }))
  );

  return NextResponse.json({
    session: {
      id: session.id,
      status: session.status,
      startedAt: session.startedAt,
      finishedAt: session.finishedAt,
      generalComment: session.generalComment,
    },
    team: session.team,
    agent: session.agent,
    observer: session.observer,
    poste: session.poste,
    secteur: session.secteur,
    procedures: session.procedures.map((po) => ({
      id: po.id,
      generalComment: po.generalComment,
      procedure: {
        title: po.procedure.title,
        domain: po.procedure.domain,
        theme: po.procedure.theme,
        gravity: po.procedure.gravity,
        documents: safeArray(po.procedure.documents),
        risk: po.procedure.risk,
      },
      items: po.items.map((i) => ({
        label: i.checklistItem.label,
        status: i.status,
        comment: i.comment,
        gravity: i.checklistItem.gravity,
        helpReference: i.checklistItem.helpReference,
        helpText: i.checklistItem.helpText,
        photos: i.photos.map((p) => ({
          path: `/api/photos/${p.id}/file`,
          legend: p.legend,
        })),
      })),
    })),
    nonConform: ncItems,
    sessionPhotos: session.photos.map((p) => ({
      path: `/api/photos/${p.id}/file`,
      legend: p.legend,
    })),
  });
}

function safeArray(s: string): string[] {
  try {
    const v = JSON.parse(s);
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}
