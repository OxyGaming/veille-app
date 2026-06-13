import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * Healthcheck minimal — destiné à un monitoring externe (uptime robot,
 * sonde k8s, etc.).
 *
 * - 200 + status="ok" : app + DB répondent.
 * - 503 + status="degraded" : DB injoignable.
 *
 * Pas d'auth (volontaire, pour permettre une sonde externe).
 * Aucun détail sensible exposé (pas de version, pas de path interne).
 *
 * Cf. AUDIT.md §MT-09 / BACKLOG-V2.md US-1.10.
 */
export async function GET() {
  const checks: Record<string, "ok" | "down"> = { app: "ok" };

  try {
    // Requête triviale pour vérifier que Prisma + SQLite répondent.
    await prisma.$queryRaw`SELECT 1`;
    checks.db = "ok";
  } catch {
    checks.db = "down";
  }

  const overall = Object.values(checks).every((v) => v === "ok")
    ? "ok"
    : "degraded";

  return NextResponse.json(
    {
      status: overall,
      uptime: Math.round(process.uptime()),
      checks,
      timestamp: new Date().toISOString(),
    },
    { status: overall === "ok" ? 200 : 503 }
  );
}
