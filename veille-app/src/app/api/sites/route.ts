import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser, siteScope } from "@/lib/auth";

export async function GET() {
  let u;
  try {
    u = await requireUser();
  } catch (r) {
    return r as Response;
  }
  const sites = await prisma.site.findMany({
    where: { isActive: true, isVisible: true, ...siteScope(u) },
    orderBy: { name: "asc" },
    take: 500,
  });
  return NextResponse.json(sites);
}
