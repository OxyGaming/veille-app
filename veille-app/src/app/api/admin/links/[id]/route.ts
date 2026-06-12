import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";

/**
 * Supprime soit un lien soit une catégorie selon `?kind=link|category`.
 * Pour une catégorie, on supprime aussi tous les liens associés (cascade
 * applicative — pas de FK CASCADE pour préserver l'historique des autres
 * relations).
 */
export async function DELETE(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    await requireRole(["ADMIN", "EDITOR"]);
  } catch (r) {
    return r as Response;
  }
  const { id } = await ctx.params;
  const url = new URL(req.url);
  const kind = url.searchParams.get("kind");
  if (kind === "category") {
    await prisma.$transaction(async (tx) => {
      await tx.link.deleteMany({ where: { categoryId: id } });
      await tx.linkCategory.delete({ where: { id } });
    });
    return NextResponse.json({ ok: true });
  }
  if (kind === "link") {
    await prisma.link.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  }
  return NextResponse.json(
    { error: "Paramètre `kind` requis (link|category)" },
    { status: 400 }
  );
}
