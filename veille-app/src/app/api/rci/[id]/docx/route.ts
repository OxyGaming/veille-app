import { NextResponse } from "next/server";
import path from "path";
import fs from "fs/promises";
import { requireUser } from "@/lib/auth";
import { renderRci } from "@/lib/rci/render";
import type { RciPayload, RciPhotos } from "@/lib/rci/fields";

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    await requireUser();
  } catch {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  const { id } = await ctx.params;

  let payload: RciPayload;
  let photos: RciPhotos;
  try {
    const body = await req.json();
    payload = body.payload;
    photos = body.photos ?? {};
  } catch {
    return NextResponse.json({ error: "Corps invalide" }, { status: 400 });
  }

  // Lire le template directement depuis le FS (évite le fetch loopback localhost).
  // On passe le Buffer Node.js brut — PizZip l'accepte nativement.
  const templatePath = path.join(process.cwd(), "public", "rci", "template.docx");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let templateBuffer: any;
  try {
    templateBuffer = await fs.readFile(templatePath);
  } catch {
    return NextResponse.json({ error: `Template introuvable : ${templatePath}` }, { status: 500 });
  }

  let blob: Blob;
  try {
    blob = await renderRci(payload, photos, { templateBuffer });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  const buf = await blob.arrayBuffer();
  return new Response(buf, {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename="rci-${id}.docx"`,
    },
  });
}
