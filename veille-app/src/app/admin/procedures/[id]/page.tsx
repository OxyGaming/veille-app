import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import ProcedureEditClient from "./ProcedureEditClient";

export const dynamic = "force-dynamic";

export default async function EditProcedurePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const proc = await prisma.procedure.findUnique({
    where: { id },
    include: {
      items: { where: { isActive: true }, orderBy: { sortOrder: "asc" } },
    },
  });
  if (!proc) notFound();
  return (
    <ProcedureEditClient
      proc={{
        id: proc.id,
        domain: proc.domain,
        theme: proc.theme,
        title: proc.title,
        gravity: proc.gravity,
        documents: parseDocs(proc.documents),
        risk: proc.risk,
        requireGeneralComment: proc.requireGeneralComment,
        items: proc.items.map((i) => ({
          id: i.id,
          label: i.label,
          gravity: i.gravity,
          requireCommentIfKO: i.requireCommentIfKO,
          requirePhotoIfKO: i.requirePhotoIfKO,
        })),
      }}
    />
  );
}

function parseDocs(s: string) {
  try {
    const v = JSON.parse(s);
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}
