import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { contactCreateSchema, createContact } from "@/lib/contacts";

/**
 * Création de contact depuis le FRONT-OFFICE — tout utilisateur authentifié,
 * restreint à ses propres équipes (jamais `teamId=null`/"commun" depuis ce
 * front). Le CRUD complet (édition, suppression, contact commun) reste
 * réservé au back-office via `/api/admin/contacts`. Les deux routes partagent
 * `createContact()` (cf. src/lib/contacts.ts) — même validation, même
 * contrôle de doublon, mêmes messages d'erreur.
 */
export async function POST(req: Request) {
  let u;
  try {
    u = await requireUser();
  } catch (r) {
    return r as Response;
  }
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Requête invalide" }, { status: 400 });
  }
  const parsed = contactCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Données invalides", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }
  // Cloisonnement front : jamais de contact commun depuis cet écran — une
  // équipe doit être choisie parmi celles de l'utilisateur.
  if (!parsed.data.teamId) {
    return NextResponse.json(
      { error: "Une équipe doit être sélectionnée." },
      { status: 400 },
    );
  }
  const result = await createContact(u, parsed.data);
  if (!result.ok) {
    return NextResponse.json({ error: result.message }, { status: result.status });
  }
  return NextResponse.json(result.contact);
}
