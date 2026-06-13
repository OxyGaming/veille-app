import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { setAuthCookie, verifyPassword } from "@/lib/auth";
import {
  buildLoginKey,
  checkLoginRateLimit,
  extractClientIp,
  recordLoginFailure,
  resetLoginAttempts,
} from "@/lib/rateLimit";
import { z } from "zod";

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Requête invalide" }, { status: 400 });
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Identifiants invalides" }, { status: 400 });
  }
  const { email, password } = parsed.data;
  const ip = extractClientIp(req);
  const key = buildLoginKey(ip, email);

  // Rate-limit avant tout — pas de leak temporel sur l'existence de l'email.
  const decision = checkLoginRateLimit(key);
  if (!decision.ok) {
    const retryAfterSec = Math.max(1, Math.ceil(decision.retryAfterMs / 1000));
    return NextResponse.json(
      {
        error: `Trop de tentatives. Réessayez dans ${retryAfterSec} seconde${
          retryAfterSec > 1 ? "s" : ""
        }.`,
      },
      {
        status: 429,
        headers: { "Retry-After": String(retryAfterSec) },
      }
    );
  }

  const user = await prisma.user.findUnique({
    where: { email: email.toLowerCase() },
  });

  // Cas "utilisateur inconnu ou désactivé" — traité comme un échec pour ne
  // pas révéler la présence du compte par l'absence d'incrémentation.
  if (!user || !user.isActive) {
    recordLoginFailure(key);
    await prisma.auditLog
      .create({
        data: {
          userEmail: email.toLowerCase(),
          action: "LOGIN_FAILED",
          entity: "User",
          details: JSON.stringify({
            reason: user ? "inactive" : "unknown_user",
            ip,
          }),
        },
      })
      .catch(() => null);
    return NextResponse.json({ error: "Identifiants invalides" }, { status: 401 });
  }

  if (!verifyPassword(password, user.password)) {
    recordLoginFailure(key);
    await prisma.auditLog
      .create({
        data: {
          userId: user.id,
          userEmail: user.email,
          action: "LOGIN_FAILED",
          entity: "User",
          entityId: user.id,
          details: JSON.stringify({ reason: "bad_password", ip }),
        },
      })
      .catch(() => null);
    return NextResponse.json({ error: "Identifiants invalides" }, { status: 401 });
  }

  // Succès → on libère le compteur.
  resetLoginAttempts(key);
  await setAuthCookie(user.id);

  await prisma.auditLog
    .create({
      data: {
        userId: user.id,
        userEmail: user.email,
        action: "LOGIN",
        entity: "User",
        entityId: user.id,
      },
    })
    .catch(() => null);

  return NextResponse.json({
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    teamId: user.teamId,
  });
}
