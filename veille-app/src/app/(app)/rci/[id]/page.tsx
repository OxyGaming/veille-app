import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { assertTeamAccess, getSessionUser } from "@/lib/auth";
import RciEditorClient from "./RciEditorClient";

export const dynamic = "force-dynamic";

export default async function RciEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const u = await getSessionUser();
  if (!u) redirect("/login");
  const rci = await prisma.rci.findUnique({
    where: { id },
    include: {
      author: { select: { id: true, name: true } },
      team: { select: { id: true, name: true } },
      photos: {
        select: { id: true, storagePath: true, legend: true, createdAt: true },
        orderBy: { createdAt: "asc" },
      },
    },
  });
  if (!rci) notFound();
  if (!assertTeamAccess(u, rci.teamId)) notFound();
  return (
    <RciEditorClient
      rci={{
        id: rci.id,
        status: rci.status,
        title: rci.title,
        dossierNumber: rci.dossierNumber,
        eventAt: rci.eventAt?.toISOString() ?? null,
        payload: rci.payload,
        authorName: rci.author.name,
        teamName: rci.team.name,
        updatedAt: rci.updatedAt.toISOString(),
      }}
    />
  );
}
