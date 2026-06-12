import { prisma } from "@/lib/prisma";
import ProceduresClient from "./ProceduresClient";

export const dynamic = "force-dynamic";

export default async function ProceduresPage() {
  const procedures = await prisma.procedure.findMany({
    where: { isActive: true },
    include: {
      items: { where: { isActive: true }, orderBy: { sortOrder: "asc" } },
    },
    orderBy: [{ domain: "asc" }, { sortOrder: "asc" }, { title: "asc" }],
  });

  const initial = procedures.map((p) => ({
    id: p.id,
    domain: p.domain,
    theme: p.theme,
    title: p.title,
    gravity: p.gravity,
    documents: safeParseDocs(p.documents),
    risk: p.risk,
    itemCount: p.items.length,
  }));

  return <ProceduresClient initial={initial} />;
}

function safeParseDocs(s: string): string[] {
  try {
    const v = JSON.parse(s);
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}
