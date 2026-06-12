import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";

export async function GET() {
  try {
    await requireUser();
  } catch (r) {
    return r as Response;
  }
  const templates = await prisma.siteVisitTemplate.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
    include: { _count: { select: { sections: true } } },
  });
  return NextResponse.json(templates);
}
