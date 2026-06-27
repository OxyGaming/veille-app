/**
 * Constantes partagées du jeu de données de PRÉPRODUCTION / TEST.
 *
 * ⚠️ Données de test uniquement — voir prisma/preprod/README.md.
 *
 * Tous les enregistrements créés par le seed préprod sont identifiables :
 *  - `id` préfixé par {@link PP} (`"pp-…"`) pour les entités du seed ;
 *  - équipes : `code` préfixé par {@link TEAM_CODE_PREFIX} (`"PREPROD-"`) ;
 *  - utilisateurs : email se terminant par {@link USER_EMAIL_DOMAIN} ;
 *  - agents : `matricule` préfixé par {@link AGENT_MATRICULE_PREFIX} ;
 *  - sites : `code` préfixé par {@link SITE_CODE_PREFIX} ;
 *  - véhicule : `immatriculation` préfixée par {@link VEHICLE_IMMAT_PREFIX}.
 *
 * Le cleanup s'appuie sur ces marqueurs (+ le rattachement aux équipes
 * préprod) pour supprimer aussi les données générées par l'app pendant les
 * tests (validations, sightings, notifications, activités…), pas seulement
 * les lignes posées par le seed.
 */

/** Préfixe des `id` de toutes les entités créées explicitement par le seed. */
export const PP = "pp-";

export const TEAM_CODE_PREFIX = "PREPROD-";
export const USER_EMAIL_DOMAIN = "preprod.test";
export const AGENT_MATRICULE_PREFIX = "PP";
export const SITE_CODE_PREFIX = "PP-SITE-";
export const VEHICLE_IMMAT_PREFIX = "PP-VS-";
export const ACTION_EXTID_PREFIX = "PP-ACT-";

/** Mot de passe commun à tous les comptes de test (≥ 6 caractères requis). */
export const DEFAULT_PASSWORD = "Preprod2026!";

/** Identifiants stables des deux équipes. */
export const TEAM_IDS = {
  A: `${PP}team-a`,
  B: `${PP}team-b`,
} as const;

export const TEAMS = [
  { id: TEAM_IDS.A, name: "PRÉPROD — Équipe A", code: `${TEAM_CODE_PREFIX}A` },
  { id: TEAM_IDS.B, name: "PRÉPROD — Équipe B", code: `${TEAM_CODE_PREFIX}B` },
] as const;

/** Les 6 comptes de test, un par profil du plan de test préprod. */
export const USERS = [
  {
    id: `${PP}user-mono`,
    email: `preprod.user.mono@${USER_EMAIL_DOMAIN}`,
    name: "PRÉPROD User Mono",
    role: "USER",
    teams: ["A"],
    adminScopeMode: null as string | null,
    adminTeamId: null as string | null,
    viewAllTeams: false,
    profile: "USER mono-équipe",
  },
  {
    id: `${PP}user-multi`,
    email: `preprod.user.multi@${USER_EMAIL_DOMAIN}`,
    name: "PRÉPROD User Multi",
    role: "USER",
    teams: ["A", "B"],
    adminScopeMode: null,
    adminTeamId: null,
    viewAllTeams: false,
    profile: "USER multi-équipes",
  },
  {
    id: `${PP}editor-mono`,
    email: `preprod.editor.mono@${USER_EMAIL_DOMAIN}`,
    name: "PRÉPROD Editor Mono",
    role: "EDITOR",
    teams: ["A"],
    adminScopeMode: null,
    adminTeamId: null,
    viewAllTeams: false,
    profile: "EDITOR mono-équipe",
  },
  {
    id: `${PP}editor-multi`,
    email: `preprod.editor.multi@${USER_EMAIL_DOMAIN}`,
    name: "PRÉPROD Editor Multi",
    role: "EDITOR",
    teams: ["A", "B"],
    adminScopeMode: null,
    adminTeamId: null,
    viewAllTeams: false,
    profile: "EDITOR multi-équipes",
  },
  {
    id: `${PP}admin-team`,
    email: `preprod.admin.team@${USER_EMAIL_DOMAIN}`,
    name: "PRÉPROD Admin Équipe",
    role: "ADMIN",
    teams: ["A"],
    adminScopeMode: "TEAM",
    adminTeamId: TEAM_IDS.A,
    viewAllTeams: false,
    profile: "ADMIN vue équipe (A)",
  },
  {
    id: `${PP}admin-global`,
    email: `preprod.admin.global@${USER_EMAIL_DOMAIN}`,
    name: "PRÉPROD Admin Global",
    role: "ADMIN",
    teams: ["A"],
    adminScopeMode: "GLOBAL",
    adminTeamId: null,
    viewAllTeams: true,
    profile: "ADMIN vue globale",
  },
] as const;

/** Agents : un par équipe + un partagé A+B. */
export const AGENTS = [
  {
    id: `${PP}agent-a`,
    matricule: `${AGENT_MATRICULE_PREFIX}000001`,
    firstName: "Alice",
    lastName: "PRÉPROD-A",
    teams: ["A"],
  },
  {
    id: `${PP}agent-b`,
    matricule: `${AGENT_MATRICULE_PREFIX}000002`,
    firstName: "Bob",
    lastName: "PRÉPROD-B",
    teams: ["B"],
  },
  {
    id: `${PP}agent-shared`,
    matricule: `${AGENT_MATRICULE_PREFIX}000003`,
    firstName: "Sam",
    lastName: "PRÉPROD-SHARED",
    teams: ["A", "B"],
  },
] as const;

/**
 * Matricule volontairement ABSENT de la base — à mettre dans le fichier de
 * planning pour tester « agent inconnu ignoré ». Ne PAS créer cet agent.
 */
export const UNKNOWN_MATRICULE = `${AGENT_MATRICULE_PREFIX}999999`;

/** Sites : un par équipe + un partagé A+B. */
export const SITES = [
  {
    id: `${PP}site-a`,
    code: `${SITE_CODE_PREFIX}A`,
    name: "PRÉPROD Site A",
    teams: ["A"],
  },
  {
    id: `${PP}site-b`,
    code: `${SITE_CODE_PREFIX}B`,
    name: "PRÉPROD Site B",
    teams: ["B"],
  },
  {
    id: `${PP}site-shared`,
    code: `${SITE_CODE_PREFIX}SHARED`,
    name: "PRÉPROD Site Partagé",
    teams: ["A", "B"],
  },
] as const;

export const VEHICLE = {
  id: `${PP}vehicle-a`,
  immatriculation: `${VEHICLE_IMMAT_PREFIX}A`,
  type: "VS",
  label: "PRÉPROD Véhicule A",
  team: "A",
} as const;

/**
 * dedupHash explicites (l'app calcule un SHA1 ; ici on contrôle la valeur, la
 * logique de groupe ne compare que l'égalité). `pp-h-*` = identifiable.
 */
export const HASH = {
  noEcheance: "pp-h-noecheance",
  aVenir: "pp-h-avenir",
  planifiee: "pp-h-planifiee",
  retard: "pp-h-retard",
  critique: "pp-h-critique",
  validee: "pp-h-validee",
  obsolete: "pp-h-obsolete",
  remplacee: "pp-h-remplacee",
  realisee: "pp-h-realisee",
  dup: "pp-h-dup", // groupe de 3 occurrences
  crossteam: "pp-h-crossteam", // même hash, équipes A ≠ B → pas de fusion
  site: "pp-h-site",
  nc: "pp-h-nc",
  autoval: "pp-h-autoval",
} as const;

/** Titre de procédure utilisé pour tester l'auto-validation (`startsWith`). */
export const AUTOVAL_PROCEDURE_TITLE = "PRÉPROD Éclairage de sécurité";

/**
 * Garde-fou : empêche d'exécuter seed/cleanup sur un environnement marqué
 * production sans `--force`. Affiche toujours la cible DATABASE_URL (masquée).
 */
export function assertSafeEnvironment(force: boolean): void {
  const url = process.env.DATABASE_URL ?? "(non défini)";
  const masked = url.replace(/:\/\/([^:@/]+):[^@]*@/, "://$1:***@");
  // eslint-disable-next-line no-console
  console.log(`→ Cible DATABASE_URL : ${masked}`);
  const isProd = process.env.NODE_ENV === "production";
  if (isProd && !force) {
    throw new Error(
      "NODE_ENV=production détecté. Refus par sécurité. Relance avec --force " +
        "UNIQUEMENT si cette base est bien une préproduction jetable.",
    );
  }
}

export function hasFlag(name: string): boolean {
  return process.argv.slice(2).includes(name);
}
