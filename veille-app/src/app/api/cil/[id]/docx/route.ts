import { NextResponse } from "next/server";
import path from "path";
import fs from "fs/promises";
import { assertTeamAccess, requireUser } from "@/lib/auth";
import { loadIncidentFull, serializeIncident } from "@/lib/cil/repo";
import { buildCilDocxData, livretCilDocxFilename } from "@/lib/cil/docx/data";
import { renderLivretCil } from "@/lib/cil/docx/render";

/**
 * Génère le livret CIL officiel en .docx (superposition des données sur le
 * template balisé `public/cil/template.docx`). Miroir de la route RCI docx.
 */
export async function POST(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  let u;
  try {
    u = await requireUser();
  } catch {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }
  const { id } = await ctx.params;
  const row = await loadIncidentFull(id);
  if (!row) return NextResponse.json({ error: "Incident introuvable" }, { status: 404 });
  if (!assertTeamAccess(u, row.teamId)) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  const full = serializeIncident(row);
  const data = buildCilDocxData(full);

  const templatePath = path.join(process.cwd(), "public", "cil", "template.docx");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let templateBuffer: any;
  try {
    templateBuffer = await fs.readFile(templatePath);
  } catch {
    return NextResponse.json(
      { error: `Template introuvable : ${templatePath}` },
      { status: 500 },
    );
  }

  let blob: Blob;
  try {
    blob = await renderLivretCil(data, templateBuffer);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  const buf = await blob.arrayBuffer();
  return new Response(buf, {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename="${livretCilDocxFilename(full)}"`,
    },
  });
}
