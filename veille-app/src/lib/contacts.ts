/**
 * Logique de création de contact mutualisée entre le back-office
 * (`/api/admin/contacts`, ADMIN/EDITOR, CRUD complet) et le front-office
 * (`/api/contacts`, tout utilisateur authentifié, création seule).
 *
 * Un seul schéma de validation et une seule fonction serveur pour ne pas
 * dupliquer les contrôles d'autorisation ni les messages d'erreur.
 */
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { canActOnTeam, type SessionUser } from "@/lib/auth";
import type { Contact } from "@prisma/client";

export const contactCreateSchema = z.object({
  name: z.string().trim().min(1, "Le nom est obligatoire."),
  role: z.string().trim().nullable().optional(),
  phone: z.string().trim().nullable().optional(),
  email: z.string().trim().email().nullable().optional().or(z.literal("")),
  notes: z.string().trim().nullable().optional(),
  teamId: z.string().nullable().optional(),
});

export type ContactCreateInput = z.infer<typeof contactCreateSchema>;

export type CreateContactResult =
  | { ok: true; contact: Contact }
  | { ok: false; status: 403 | 409; message: string };

/** Normalise un nom pour la comparaison de doublon (casse + espaces). */
function normalizeName(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, " ");
}

/**
 * Crée un contact après vérification du périmètre équipe (`canActOnTeam` —
 * honore le scope ADMIN restreint, contrairement à `requireRole` seul) et
 * un contrôle de doublon raisonnable : même nom (normalisé) + même équipe
 * + téléphone OU e-mail identique. Deux homonymes avec des coordonnées
 * différentes ne sont jamais bloqués.
 */
export async function createContact(
  user: SessionUser,
  input: ContactCreateInput,
): Promise<CreateContactResult> {
  const teamId = input.teamId ?? null;
  if (!canActOnTeam(user, teamId)) {
    return {
      ok: false,
      status: 403,
      message: "Équipe hors de votre périmètre.",
    };
  }

  const phone = input.phone?.trim() || null;
  const email = input.email ? input.email.trim() : null;
  const normalizedName = normalizeName(input.name);

  if (phone || email) {
    const candidates = await prisma.contact.findMany({
      where: {
        teamId,
        OR: [...(phone ? [{ phone }] : []), ...(email ? [{ email }] : [])],
      },
      select: { id: true, name: true },
    });
    const isDuplicate = candidates.some(
      (c) => normalizeName(c.name) === normalizedName,
    );
    if (isDuplicate) {
      return {
        ok: false,
        status: 409,
        message:
          "Un contact similaire existe déjà (nom, équipe et téléphone ou e-mail identiques).",
      };
    }
  }

  const contact = await prisma.contact.create({
    data: {
      name: input.name.trim(),
      role: input.role?.trim() || null,
      phone,
      email,
      notes: input.notes?.trim() || null,
      teamId,
    },
  });
  return { ok: true, contact };
}
