import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  canActOnTeam,
  effectiveTeamIds,
  hashPassword,
  requireRole,
} from "@/lib/auth";

/**
 * Import historique des pointages (CSV) — version admin.
 *
 * Colonnes attendues (avec BOM UTF-8 toléré) :
 *   ID, Titre, Horodatage, Commentaire, Utilisateur, Veille, Saisie Icare,
 *   Pièces jointes, REX
 *
 * Le `Titre` est soit un agent ("NOM Prénom") soit un site
 * ("GIVORS CANAL", "BADAN P1"…). On résout automatiquement.
 *
 * La colonne « Veille » est **ignorée** (cf. demande utilisateur).
 *
 * Idempotent : chaque ligne crée un Sighting avec `externalRef = "pointage-{ID}"`.
 * Une nouvelle exécution n'ajoute pas de doublons.
 *
 * Body : { csv: string } (texte UTF-8 brut)
 * Réponse :
 *   {
 *     totalLines, created, skipped, agentSightings, siteSightings,
 *     icareMarked, usersCreated[], agentMissing[], siteMissing[],
 *     errors[]
 *   }
 */
export async function POST(req: Request) {
  let u;
  try {
    u = await requireRole(["ADMIN", "EDITOR"]);
  } catch (r) {
    return r as Response;
  }
  let body: { csv?: string; teamId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Requête invalide" }, { status: 400 });
  }
  const csv = body.csv ?? "";
  if (!csv.trim())
    return NextResponse.json({ error: "CSV vide" }, { status: 400 });

  // Équipe cible : explicite, sinon déduite si l'acteur n'a qu'une équipe.
  // Tout l'historique importé (sightings + users créés) est rattaché à elle.
  const eff = effectiveTeamIds(u);
  let targetTeamId =
    typeof body.teamId === "string" && body.teamId ? body.teamId : null;
  if (!targetTeamId) {
    if (eff !== null && eff.length === 1) {
      targetTeamId = eff[0];
    } else {
      return NextResponse.json(
        { error: "Sélectionnez l'équipe cible de l'import.", code: "TEAM_REQUIRED" },
        { status: 400 }
      );
    }
  }
  if (!canActOnTeam(u, targetTeamId)) {
    return NextResponse.json(
      { error: "Équipe cible hors de votre périmètre." },
      { status: 403 }
    );
  }

  const rows = parseCSV(csv);
  if (rows.length < 2)
    return NextResponse.json(
      { error: "CSV sans donnée (en-tête seule)" },
      { status: 400 }
    );

  const headers = rows[0].map((h) => h.trim());
  const col = (name: string) => {
    const i = headers.findIndex((h) => normalize(h) === normalize(name));
    return i;
  };
  const I_ID = col("ID");
  const I_TITRE = col("Titre");
  const I_HORODATAGE = col("Horodatage");
  const I_COMMENT = col("Commentaire");
  const I_USER = col("Utilisateur");
  const I_ICARE = col("Saisie Icare");
  if (
    I_ID < 0 ||
    I_TITRE < 0 ||
    I_HORODATAGE < 0 ||
    I_COMMENT < 0 ||
    I_USER < 0
  ) {
    return NextResponse.json(
      {
        error:
          "Colonnes manquantes — attendu : ID, Titre, Horodatage, Commentaire, Utilisateur (et optionnel : Saisie Icare).",
      },
      { status: 400 }
    );
  }

  // Préchargement pour éviter N requêtes.
  const [agents, sites, users, teams, existing] = await Promise.all([
    prisma.agent.findMany({
      select: {
        id: true,
        firstName: true,
        lastName: true,
        teamId: true,
        memberships: { select: { teamId: true } },
      },
    }),
    prisma.site.findMany({
      select: {
        id: true,
        name: true,
        code: true,
        teamId: true,
        memberships: { select: { teamId: true } },
      },
    }),
    prisma.user.findMany({ select: { id: true, name: true, email: true } }),
    prisma.team.findMany({ select: { id: true, name: true } }),
    prisma.agentSighting.findMany({
      where: { externalRef: { startsWith: "pointage-" } },
      select: { externalRef: true },
    }),
  ]);

  // L'équipe cible doit exister (canActOnTeam ne valide pas l'existence pour un
  // ADMIN GLOBAL).
  if (!teams.some((t) => t.id === targetTeamId)) {
    return NextResponse.json(
      { error: "Équipe cible inconnue." },
      { status: 400 }
    );
  }

  /** Un agent/site n'est traité que s'il appartient à l'équipe cible. */
  const inTargetTeam = (e: {
    teamId: string | null;
    memberships: { teamId: string }[];
  }) =>
    e.teamId === targetTeamId ||
    e.memberships.some((m) => m.teamId === targetTeamId);

  const agentByKey = new Map<string, (typeof agents)[number]>();
  for (const a of agents) {
    const k = normalize(`${a.lastName} ${a.firstName}`);
    agentByKey.set(k, a);
  }
  const siteByKey = new Map<string, (typeof sites)[number]>();
  for (const s of sites) {
    siteByKey.set(normalize(s.name), s);
    if (s.code) siteByKey.set(normalize(s.code), s);
  }
  const userByName = new Map<string, (typeof users)[number]>();
  for (const us of users) {
    userByName.set(normalize(us.name), us);
  }
  const existingRefs = new Set(
    existing.map((e) => e.externalRef).filter(Boolean) as string[]
  );

  const siteSightingExisting = await prisma.siteSighting.findMany({
    where: { externalRef: { startsWith: "pointage-" } },
    select: { externalRef: true },
  });
  const existingSiteRefs = new Set(
    siteSightingExisting.map((e) => e.externalRef).filter(Boolean) as string[]
  );

  const report = {
    totalLines: rows.length - 1,
    created: 0,
    skipped: 0,
    agentSightings: 0,
    siteSightings: 0,
    icareMarked: 0,
    /** Lignes dont l'agent/site existe mais hors de l'équipe cible (ignorées). */
    outOfScope: 0,
    usersCreated: [] as string[],
    agentMissing: [] as string[],
    siteMissing: [] as string[],
    errors: [] as string[],
  };

  // Pour traçabilité Icare on a besoin d'un user.id (celui qui a fait
  // l'import sert d'auteur de la coche).
  const importerId = u.id;

  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    try {
      const id = (row[I_ID] ?? "").trim();
      const rawTitre = (row[I_TITRE] ?? "").replace(/[\r\n]+/g, " ").trim();
      const horodatage = (row[I_HORODATAGE] ?? "").trim();
      const comment = (row[I_COMMENT] ?? "").trim();
      const userName = (row[I_USER] ?? "").trim();
      const icare = I_ICARE >= 0 ? (row[I_ICARE] ?? "").trim() : "";

      if (!id) continue;
      const externalRef = `pointage-${id}`;

      // Idempotence sur le couple (agent ou site).
      if (existingRefs.has(externalRef) || existingSiteRefs.has(externalRef)) {
        report.skipped++;
        continue;
      }

      const sightedAt = parseFrenchDate(horodatage);
      if (!sightedAt) {
        report.errors.push(
          `Ligne ${r + 1} (ID ${id}) : horodatage invalide « ${horodatage} »`
        );
        continue;
      }

      // Observer : trouve ou crée.
      let observer = userName
        ? userByName.get(normalize(userName))
        : undefined;
      if (!observer && userName) {
        // Crée un user import (USER) rattaché à l'ÉQUIPE CIBLE uniquement
        // (jamais hors périmètre) — teamId legacy + membership UserTeam.
        const email = `${slug(userName)}@import.local`;
        const created = await prisma.user.create({
          data: {
            email,
            name: userName,
            role: "USER",
            password: hashPassword(
              "imported-" + Math.random().toString(36).slice(2)
            ),
            teamId: targetTeamId,
            memberships: { create: { teamId: targetTeamId } },
          },
          select: { id: true, name: true, email: true },
        });
        userByName.set(normalize(userName), created);
        observer = created;
        report.usersCreated.push(userName);
      }
      if (!observer) {
        // Fallback : l'importeur en cours.
        observer = { id: importerId, name: u.name, email: "" };
      }

      const key = normalize(rawTitre);
      const matchedAgent = agentByKey.get(key);
      const matchedSite =
        !matchedAgent &&
        (siteByKey.get(key) ?? fuzzySiteMatch(siteByKey, key));

      // Cloisonnement : on n'injecte un sighting que si l'agent/site appartient
      // à l'équipe cible. Sinon la ligne est ignorée (comptée hors périmètre).
      const agent =
        matchedAgent && inTargetTeam(matchedAgent) ? matchedAgent : null;
      const site =
        matchedSite && inTargetTeam(matchedSite) ? matchedSite : null;
      if ((matchedAgent && !agent) || (matchedSite && !site)) {
        report.outOfScope++;
        continue;
      }

      const isShort = isShortComment(comment);
      const kind = isShort ? "SIGHT" : "NOTE";

      if (agent) {
        await prisma.agentSighting.create({
          data: {
            agentId: agent.id,
            teamId: targetTeamId,
            observerId: observer.id,
            kind,
            comment: comment || null,
            sightedAt,
            externalRef,
          },
        });
        existingRefs.add(externalRef);
        report.agentSightings++;
        report.created++;
        if (isIcareTrue(icare)) {
          await ensureIcareMark(
            externalRef,
            kind === "NOTE" ? "note" : "sighting",
            importerId
          );
          report.icareMarked++;
        }
      } else if (site) {
        await prisma.siteSighting.create({
          data: {
            siteId: site.id,
            teamId: targetTeamId,
            observerId: observer.id,
            kind,
            comment: comment || null,
            sightedAt,
            externalRef,
          },
        });
        existingSiteRefs.add(externalRef);
        report.siteSightings++;
        report.created++;
        if (isIcareTrue(icare)) {
          await ensureIcareMark(
            externalRef,
            kind === "NOTE" ? "site-note" : "site-sighting",
            importerId
          );
          report.icareMarked++;
        }
      } else {
        if (looksLikeAgent(rawTitre)) {
          if (!report.agentMissing.includes(rawTitre))
            report.agentMissing.push(rawTitre);
        } else {
          if (!report.siteMissing.includes(rawTitre))
            report.siteMissing.push(rawTitre);
        }
      }
    } catch (e: unknown) {
      report.errors.push(
        `Ligne ${r + 1} : ${e instanceof Error ? e.message : String(e)}`
      );
    }
  }

  return NextResponse.json(report);
}

/* ============================================================================
 *  Helpers
 * ========================================================================== */

/** Parseur CSV minimal — gère BOM, guillemets, quotes échappées, multi-ligne. */
function parseCSV(text: string): string[][] {
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
    } else {
      if (c === '"') {
        inQuotes = true;
      } else if (c === ",") {
        row.push(field);
        field = "";
      } else if (c === "\n" || c === "\r") {
        if (c === "\r" && text[i + 1] === "\n") i++;
        row.push(field);
        field = "";
        if (row.length > 1 || row[0] !== "") rows.push(row);
        row = [];
      } else {
        field += c;
      }
    }
  }
  if (field !== "" || row.length) {
    row.push(field);
    if (row.length > 1 || row[0] !== "") rows.push(row);
  }
  return rows;
}

function normalize(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function slug(s: string): string {
  return normalize(s).replace(/[^a-z0-9]+/g, ".").replace(/^\.+|\.+$/g, "");
}

/** Parse "DD/MM/YYYY HH:MM" → Date | null. */
function parseFrenchDate(s: string): Date | null {
  const m = s.match(
    /^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2}))?$/
  );
  if (!m) return null;
  const d = new Date(
    Number(m[3]),
    Number(m[2]) - 1,
    Number(m[1]),
    m[4] ? Number(m[4]) : 0,
    m[5] ? Number(m[5]) : 0
  );
  if (isNaN(d.getTime())) return null;
  return d;
}

/** Heuristique : "Vu", "RAS", "OK"... → SIGHT ; sinon NOTE. */
function isShortComment(c: string): boolean {
  const n = normalize(c);
  if (n.length === 0) return true;
  if (n.length <= 3) return true;
  return ["vu", "ras", "ok", "vu en poste", "vu en relève"].includes(n);
}

function isIcareTrue(v: string): boolean {
  const n = normalize(v);
  return n === "true" || n === "1" || n === "vrai" || n === "oui";
}

/** Titre qui ressemble à "NOM Prenom" : tout en MAJ pour le premier mot. */
function looksLikeAgent(t: string): boolean {
  const parts = t.trim().split(/\s+/);
  if (parts.length < 2) return false;
  // Premier mot >=2 lettres majuscules (apostrophes/tirets autorisés).
  return /^[A-ZÉÈÊÀÂÔÛÇ'’\-]{2,}$/.test(parts[0]);
}

/** Recherche site approximative : contient ou est contenu (sur la clé normalisée). */
function fuzzySiteMatch(
  byKey: Map<string, { id: string; name: string; code: string | null; teamId: string | null; memberships: { teamId: string }[] }>,
  key: string
):
  | { id: string; name: string; code: string | null; teamId: string | null; memberships: { teamId: string }[] }
  | undefined {
  for (const [k, v] of byKey) {
    if (k.includes(key) || key.includes(k)) return v;
  }
  return undefined;
}

/**
 * Crée la marque Icare pour le sighting tout juste créé. On la branche après
 * coup via `findFirst` sur externalRef → permet de garder la logique IcareEntry
 * indépendante (clé sur (refType, refId)).
 */
async function ensureIcareMark(
  externalRef: string,
  refType: "sighting" | "note" | "site-sighting" | "site-note",
  doneById: string
) {
  let refId: string | null = null;
  if (refType === "sighting" || refType === "note") {
    const s = await prisma.agentSighting.findUnique({
      where: { externalRef },
      select: { id: true },
    });
    refId = s?.id ?? null;
  } else {
    const s = await prisma.siteSighting.findUnique({
      where: { externalRef },
      select: { id: true },
    });
    refId = s?.id ?? null;
  }
  if (!refId) return;
  await prisma.icareEntry.upsert({
    where: { refType_refId: { refType, refId } },
    update: {},
    create: { refType, refId, doneById },
  });
}
