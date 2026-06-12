import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { setAuthCookie, verifyPassword } from "@/lib/auth";
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

  const user = await prisma.user.findUnique({
    where: { email: email.toLowerCase() },
  });
  if (!user || !user.isActive) {
    return NextResponse.json({ error: "Identifiants invalides" }, { status: 401 });
  }
  if (!verifyPassword(password, user.password)) {
    return NextResponse.json({ error: "Identifiants invalides" }, { status: 401 });
  }
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
