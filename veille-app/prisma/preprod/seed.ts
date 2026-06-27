/**
 * Seed de PRÉPRODUCTION / TEST — jeu de données complet et reproductible
 * pour le plan de test (docs/PLAN-TEST-PREPROD.md).
 *
 * ⚠️ DONNÉES DE TEST. Ne pas exécuter sur une base de production.
 *
 * Caractéristiques :
 *  - **idempotent** : ré-exécutable sans doublon (upsert par `id` stable) ;
 *  - **identifiable** : tout est préfixé/marqué (cf. constants.ts) ;
 *  - **réversible** : `cleanup.ts` supprime tout (seed + données générées
 *    pendant les tests).
 *
 * Usage :
 *   npm run db:seed:preprod            # crée / met à jour le jeu de test
 *   npm run db:seed:preprod -- --force # ignore le garde-fou NODE_ENV=production
 *
 * Ne modifie AUCUN code applicatif : importe `prisma` et `hashPassword`
 * existants en lecture seule.
 */
import "dotenv/config";
import { prisma } from "../../src/lib/prisma";
import { hashPassword } from "../../src/lib/auth";
import {
  AGENTS,
  AUTOVAL_PROCEDURE_TITLE,
  DEFAULT_PASSWORD,
  HASH,
  PP,
  SITES,
  TEAM_IDS,
  TEAMS,
  UNKNOWN_MATRICULE,
  USERS,
  VEHICLE,
  assertSafeEnvironment,
  hasFlag,
} from "./constants";

/** Jours → Date (midi UTC pour éviter les effets de bord minuit/fuseau). */
function daysFromNow(n: number): Date {
  const d = new Date();
  d.setUTCHours(12, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() + n);
  return d;
}

const teamId = (key: "A" | "B") => (key === "A" ? TEAM_IDS.A : TEAM_IDS.B);

async function seedTeams() {
  for (const t of TEAMS) {
    await prisma.team.upsert({
      where: { id: t.id },
      create: { id: t.id, name: t.name, code: t.code, isActive: true },
      update: { name: t.name, code: t.code, isActive: true },
    });
  }
}

async function seedUsers() {
  const password = hashPassword(DEFAULT_PASSWORD);
  for (const u of USERS) {
    const primaryTeamId = teamId(u.teams[0] as "A" | "B");
    await prisma.user.upsert({
      where: { id: u.id },
      create: {
        id: u.id,
        email: u.email,
        name: u.name,
        password,
        role: u.role,
        isActive: true,
        teamId: primaryTeamId,
        viewAllTeams: u.viewAllTeams,
        adminScopeMode: u.adminScopeMode,
        adminTeamId: u.adminTeamId,
      },
      update: {
        email: u.email,
        name: u.name,
        password,
        role: u.role,
        isActive: true,
        teamId: primaryTeamId,
        viewAllTeams: u.viewAllTeams,
        adminScopeMode: u.adminScopeMode,
        adminTeamId: u.adminTeamId,
      },
    });
    for (const tk of u.teams) {
      const tid = teamId(tk as "A" | "B");
      await prisma.userTeam.upsert({
        where: { userId_teamId: { userId: u.id, teamId: tid } },
        create: { id: `${PP}ut-${u.id}-${tk}`, userId: u.id, teamId: tid },
        update: {},
      });
    }
  }
}

async function seedAgents() {
  for (const a of AGENTS) {
    const primaryTeamId = teamId(a.teams[0] as "A" | "B");
    await prisma.agent.upsert({
      where: { id: a.id },
      create: {
        id: a.id,
        matricule: a.matricule,
        firstName: a.firstName,
        lastName: a.lastName,
        teamId: primaryTeamId,
        isActive: true,
        isVisible: true,
      },
      update: {
        matricule: a.matricule,
        firstName: a.firstName,
        lastName: a.lastName,
        teamId: primaryTeamId,
        isActive: true,
        isVisible: true,
      },
    });
    for (const tk of a.teams) {
      const tid = teamId(tk as "A" | "B");
      await prisma.agentTeam.upsert({
        where: { agentId_teamId: { agentId: a.id, teamId: tid } },
        create: { id: `${PP}at-${a.id}-${tk}`, agentId: a.id, teamId: tid },
        update: {},
      });
    }
  }
}

async function seedSites() {
  for (const s of SITES) {
    const primaryTeamId = teamId(s.teams[0] as "A" | "B");
    await prisma.site.upsert({
      where: { id: s.id },
      create: {
        id: s.id,
        code: s.code,
        name: s.name,
        teamId: primaryTeamId,
        isActive: true,
        isVisible: true,
      },
      update: {
        code: s.code,
        name: s.name,
        teamId: primaryTeamId,
        isActive: true,
        isVisible: true,
      },
    });
    for (const tk of s.teams) {
      const tid = teamId(tk as "A" | "B");
      await prisma.siteTeam.upsert({
        where: { siteId_teamId: { siteId: s.id, teamId: tid } },
        create: { id: `${PP}st-${s.id}-${tk}`, siteId: s.id, teamId: tid },
        update: {},
      });
    }
  }
}

async function seedVehicle() {
  await prisma.vehicle.upsert({
    where: { id: VEHICLE.id },
    create: {
      id: VEHICLE.id,
      immatriculation: VEHICLE.immatriculation,
      type: VEHICLE.type,
      label: VEHICLE.label,
      teamId: teamId(VEHICLE.team),
      isActive: true,
    },
    update: {
      immatriculation: VEHICLE.immatriculation,
      type: VEHICLE.type,
      label: VEHICLE.label,
      teamId: teamId(VEHICLE.team),
      isActive: true,
    },
  });
}

type ActionSeed = {
  id: string;
  externalId: string;
  team: "A" | "B";
  agentId?: string;
  siteId?: string;
  localStatus: string;
  dueAt: Date | null;
  dedupHash: string | null;
  keyPoint?: string;
  comment?: string;
  realizedAt?: Date | null;
  originalStatus?: string;
  importId?: string;
};

function actionSeeds(): ActionSeed[] {
  const AG_A = `${PP}agent-a`;
  const AG_SHARED = `${PP}agent-shared`;
  const SITE_A = `${PP}site-a`;
  return [
    // — États d'échéance (agent A, équipe A) —
    { id: `${PP}act-noecheance`, externalId: "PP-ACT-NOECHEANCE", team: "A", agentId: AG_A, localStatus: "ACTIVE", dueAt: null, dedupHash: HASH.noEcheance, keyPoint: "PRÉPROD action sans échéance" },
    { id: `${PP}act-avenir`, externalId: "PP-ACT-AVENIR", team: "A", agentId: AG_A, localStatus: "ACTIVE", dueAt: daysFromNow(3), dedupHash: HASH.aVenir, keyPoint: "PRÉPROD action à venir" },
    { id: `${PP}act-planifiee`, externalId: "PP-ACT-PLANIFIEE", team: "A", agentId: AG_A, localStatus: "ACTIVE", dueAt: daysFromNow(30), dedupHash: HASH.planifiee, keyPoint: "PRÉPROD action planifiée" },
    { id: `${PP}act-retard`, externalId: "PP-ACT-RETARD", team: "A", agentId: AG_A, localStatus: "ACTIVE", dueAt: daysFromNow(-1), dedupHash: HASH.retard, keyPoint: "PRÉPROD action en retard" },
    { id: `${PP}act-critique`, externalId: "PP-ACT-CRITIQUE", team: "A", agentId: AG_A, localStatus: "ACTIVE", dueAt: daysFromNow(-30), dedupHash: HASH.critique, keyPoint: "PRÉPROD action en retard critique" },
    // — États du cycle de vie —
    { id: `${PP}act-validee`, externalId: "PP-ACT-VALIDEE", team: "A", agentId: AG_A, localStatus: "VALIDATED_LOCAL", dueAt: daysFromNow(-2), dedupHash: HASH.validee, keyPoint: "PRÉPROD action validée", realizedAt: daysFromNow(-2) },
    { id: `${PP}act-obsolete`, externalId: "PP-ACT-OBSOLETE", team: "A", agentId: AG_A, localStatus: "OBSOLETE", dueAt: daysFromNow(-3), dedupHash: HASH.obsolete, keyPoint: "PRÉPROD action obsolète" },
    { id: `${PP}act-remplacee`, externalId: "PP-ACT-REMPLACEE", team: "A", agentId: AG_A, localStatus: "REPLACED", dueAt: daysFromNow(-3), dedupHash: HASH.remplacee, keyPoint: "PRÉPROD action remplacée" },
    { id: `${PP}act-realisee`, externalId: "PP-ACT-REALISEE", team: "A", agentId: AG_A, localStatus: "OBSOLETE", dueAt: daysFromNow(-5), dedupHash: HASH.realisee, keyPoint: "PRÉPROD action réalisée via import", realizedAt: daysFromNow(-5), originalStatus: "réalisé", importId: `${PP}import-a` },
    // — Groupe de doublons (même dedupHash) → badge ×3 —
    { id: `${PP}act-dup-1`, externalId: "PP-ACT-DUP-1", team: "A", agentId: AG_A, localStatus: "ACTIVE", dueAt: daysFromNow(5), dedupHash: HASH.dup, keyPoint: "PRÉPROD action dupliquée (groupe)" },
    { id: `${PP}act-dup-2`, externalId: "PP-ACT-DUP-2", team: "A", agentId: AG_A, localStatus: "ACTIVE", dueAt: daysFromNow(5), dedupHash: HASH.dup, keyPoint: "PRÉPROD action dupliquée (groupe)" },
    { id: `${PP}act-dup-3`, externalId: "PP-ACT-DUP-3", team: "A", agentId: AG_A, localStatus: "ACTIVE", dueAt: daysFromNow(5), dedupHash: HASH.dup, keyPoint: "PRÉPROD action dupliquée (groupe)" },
    // — Sans dedupHash : ne doit JAMAIS être groupée —
    { id: `${PP}act-nodedup`, externalId: "PP-ACT-NODEDUP", team: "A", agentId: AG_A, localStatus: "ACTIVE", dueAt: daysFromNow(10), dedupHash: null, keyPoint: "PRÉPROD action sans dedupHash" },
    // — Même dedupHash, équipes différentes (agent partagé) : pas de fusion —
    { id: `${PP}act-sh-a`, externalId: "PP-ACT-SH-A", team: "A", agentId: AG_SHARED, localStatus: "ACTIVE", dueAt: daysFromNow(2), dedupHash: HASH.crossteam, keyPoint: "PRÉPROD action agent partagé (équipe A)" },
    { id: `${PP}act-sh-b`, externalId: "PP-ACT-SH-B", team: "B", agentId: AG_SHARED, localStatus: "ACTIVE", dueAt: daysFromNow(2), dedupHash: HASH.crossteam, keyPoint: "PRÉPROD action agent partagé (équipe B)" },
    // — Action sur site (équipe A) —
    { id: `${PP}act-site`, externalId: "PP-ACT-SITE", team: "A", siteId: SITE_A, localStatus: "ACTIVE", dueAt: daysFromNow(1), dedupHash: HASH.site, keyPoint: "PRÉPROD action sur site" },
    // — Auto-validation : keyPoint qui commence par le titre de procédure —
    { id: `${PP}act-autoval-a`, externalId: "PP-ACT-AUTOVAL-A", team: "A", agentId: AG_SHARED, localStatus: "ACTIVE", dueAt: daysFromNow(4), dedupHash: HASH.autoval, keyPoint: `${AUTOVAL_PROCEDURE_TITLE} — vérification mensuelle` },
    // Contrôle cloisonnement auto-val : même agent + même keyPoint mais équipe B.
    { id: `${PP}act-autoval-b`, externalId: "PP-ACT-AUTOVAL-B", team: "B", agentId: AG_SHARED, localStatus: "ACTIVE", dueAt: daysFromNow(4), dedupHash: HASH.autoval, keyPoint: `${AUTOVAL_PROCEDURE_TITLE} — vérification mensuelle` },
    // — Action liée à une NC de visite (validée → clôture la NC) —
    { id: `${PP}act-nc`, externalId: "PP-ACT-NC", team: "A", siteId: SITE_A, localStatus: "ACTIVE", dueAt: daysFromNow(7), dedupHash: HASH.nc, keyPoint: "PRÉPROD action générée par NC" },
  ];
}

async function seedActionImport() {
  await prisma.actionImport.upsert({
    where: { id: `${PP}import-a` },
    create: {
      id: `${PP}import-a`,
      teamId: TEAM_IDS.A,
      fileName: "PRÉPROD import actions A.xlsx",
      rowsTotal: 1,
      rowsCreated: 1,
    },
    update: { teamId: TEAM_IDS.A, fileName: "PRÉPROD import actions A.xlsx" },
  });
}

async function seedActions() {
  for (const a of actionSeeds()) {
    const data = {
      externalId: a.externalId,
      teamId: teamId(a.team),
      agentId: a.agentId ?? null,
      siteId: a.siteId ?? null,
      localStatus: a.localStatus,
      dueAt: a.dueAt,
      dedupHash: a.dedupHash,
      keyPoint: a.keyPoint ?? null,
      comment: a.comment ?? null,
      realizedAt: a.realizedAt ?? null,
      originalStatus: a.originalStatus ?? null,
      importId: a.importId ?? null,
    };
    await prisma.importedAction.upsert({
      where: { id: a.id },
      create: { id: a.id, ...data },
      update: data,
    });
  }
}

async function seedValidationForValidatedAction() {
  // L'action PP-ACT-VALIDEE possède une ActionValidation (la rend non
  // supprimable et non obsolétable — cf. scénarios P10/P12).
  await prisma.actionValidation.upsert({
    where: { id: `${PP}validation-validee` },
    create: {
      id: `${PP}validation-validee`,
      actionId: `${PP}act-validee`,
      agentId: `${PP}agent-a`,
      validatedById: `${PP}editor-mono`,
      teamId: TEAM_IDS.A,
      realizedAt: daysFromNow(-2),
      comment: "PRÉPROD validation initiale",
    },
    update: {},
  });
}

async function seedAutoValidationSession() {
  // Procédure + item de checklist dont le TITRE alimente l'auto-validation.
  await prisma.procedure.upsert({
    where: { id: `${PP}proc-autoval` },
    create: {
      id: `${PP}proc-autoval`,
      domain: "PRÉPROD",
      title: AUTOVAL_PROCEDURE_TITLE,
      gravity: 3,
      isActive: true,
    },
    update: { domain: "PRÉPROD", title: AUTOVAL_PROCEDURE_TITLE },
  });
  await prisma.checklistItem.upsert({
    where: { id: `${PP}chk-autoval` },
    create: {
      id: `${PP}chk-autoval`,
      procedureId: `${PP}proc-autoval`,
      label: `${AUTOVAL_PROCEDURE_TITLE} — état du balisage`,
      sortOrder: 1,
      isActive: true,
    },
    update: {},
  });
  // Session de veille équipe A sur l'agent partagé, en cours (à clôturer).
  await prisma.veilleSession.upsert({
    where: { id: `${PP}session-autoval` },
    create: {
      id: `${PP}session-autoval`,
      teamId: TEAM_IDS.A,
      observerId: `${PP}editor-mono`,
      agentId: `${PP}agent-shared`,
      status: "active",
      generalComment: "PRÉPROD session — clôture pour tester l'auto-validation",
    },
    update: {
      teamId: TEAM_IDS.A,
      observerId: `${PP}editor-mono`,
      agentId: `${PP}agent-shared`,
      status: "active",
    },
  });
  await prisma.procedureObservation.upsert({
    where: { id: `${PP}procobs-autoval` },
    create: {
      id: `${PP}procobs-autoval`,
      sessionId: `${PP}session-autoval`,
      procedureId: `${PP}proc-autoval`,
    },
    update: {},
  });
}

async function seedVisitWithNonConformity() {
  // Nécessite un template de visite (seedé par le seed principal). Si absent,
  // on saute la visite + NC : l'action PP-ACT-NC reste créée (validable seule).
  const template = await prisma.siteVisitTemplate.findFirst({
    select: { id: true },
  });
  if (!template) {
    console.warn(
      "⚠ Aucun SiteVisitTemplate en base : visite + NC non créées. " +
        "Lance `npm run db:seed` (seed principal) pour disposer des templates.",
    );
    return;
  }
  await prisma.siteVisit.upsert({
    where: { id: `${PP}visit-a` },
    create: {
      id: `${PP}visit-a`,
      templateId: template.id,
      siteId: `${PP}site-a`,
      teamId: TEAM_IDS.A,
      observerId: `${PP}editor-mono`,
      status: "completed",
      finishedAt: daysFromNow(-1),
      generalComment: "PRÉPROD visite avec non-conformité",
    },
    update: { templateId: template.id, teamId: TEAM_IDS.A },
  });
  await prisma.siteVisitNonConformity.upsert({
    where: { id: `${PP}nc-a` },
    create: {
      id: `${PP}nc-a`,
      visitId: `${PP}visit-a`,
      description: "PRÉPROD non-conformité (génère une action corrective)",
      generatedActionId: `${PP}act-nc`,
    },
    update: { generatedActionId: `${PP}act-nc` },
  });
}

async function seedPlanning() {
  const today6 = (() => {
    const d = new Date();
    d.setUTCHours(6, 0, 0, 0);
    return d;
  })();
  const today14 = (() => {
    const d = new Date();
    d.setUTCHours(14, 0, 0, 0);
    return d;
  })();

  const plans = [
    {
      id: `${PP}planning-a`,
      team: "A" as const,
      fileName: "PRÉPROD planning A.xlsx",
      shifts: [
        { id: `${PP}shift-a-1`, agentId: `${PP}agent-a`, js: "PP-A1" },
        { id: `${PP}shift-a-2`, agentId: `${PP}agent-shared`, js: "PP-A2" },
      ],
    },
    {
      id: `${PP}planning-b`,
      team: "B" as const,
      fileName: "PRÉPROD planning B.xlsx",
      shifts: [
        { id: `${PP}shift-b-1`, agentId: `${PP}agent-b`, js: "PP-B1" },
        { id: `${PP}shift-b-2`, agentId: `${PP}agent-shared`, js: "PP-B2" },
      ],
    },
  ];

  for (const p of plans) {
    const tid = teamId(p.team);
    await prisma.planningImport.upsert({
      where: { id: p.id },
      create: {
        id: p.id,
        teamId: tid,
        importedById: `${PP}editor-mono`,
        fileName: p.fileName,
        periodStart: today6,
        periodEnd: today14,
        rowsTotal: p.shifts.length,
        rowsImported: p.shifts.length,
      },
      update: { teamId: tid, fileName: p.fileName },
    });
    for (const s of p.shifts) {
      await prisma.planningShift.upsert({
        where: { id: s.id },
        create: {
          id: s.id,
          importId: p.id,
          teamId: tid,
          agentId: s.agentId,
          startsAt: today6,
          endsAt: today14,
          jsNumber: s.js,
          jsCode: "PRÉPROD",
        },
        update: {
          importId: p.id,
          teamId: tid,
          agentId: s.agentId,
          startsAt: today6,
          endsAt: today14,
        },
      });
    }
  }
}

async function seedPointages() {
  // « Pointages » = AgentSighting importés (cf. import pointages → AgentSighting).
  const sightings = [
    { id: `${PP}sighting-1`, agentId: `${PP}agent-a`, ref: "pointage-PP-001" },
    { id: `${PP}sighting-2`, agentId: `${PP}agent-shared`, ref: "pointage-PP-002" },
  ];
  for (const s of sightings) {
    await prisma.agentSighting.upsert({
      where: { id: s.id },
      create: {
        id: s.id,
        agentId: s.agentId,
        teamId: TEAM_IDS.A,
        observerId: `${PP}editor-mono`,
        kind: "SIGHT",
        comment: "PRÉPROD pointage",
        externalRef: s.ref,
      },
      update: { teamId: TEAM_IDS.A, externalRef: s.ref },
    });
  }
}

async function seedNotifications() {
  const notifs = [
    { id: `${PP}notif-1`, userId: `${PP}user-mono`, dedupKey: "PREPROD:welcome:mono" },
    { id: `${PP}notif-2`, userId: `${PP}user-multi`, dedupKey: "PREPROD:welcome:multi" },
  ];
  for (const n of notifs) {
    await prisma.notification.upsert({
      where: { id: n.id },
      create: {
        id: n.id,
        userId: n.userId,
        type: "TEAM_HISTORY_ADDED",
        title: "PRÉPROD notification de test",
        message: "Notification de test du jeu de données préprod.",
        dedupKey: n.dedupKey,
      },
      update: {},
    });
  }
}

async function main() {
  assertSafeEnvironment(hasFlag("--force"));
  console.log("→ Seed PRÉPROD : démarrage…");
  await seedTeams();
  await seedUsers();
  await seedAgents();
  await seedSites();
  await seedVehicle();
  await seedActionImport();
  await seedActions();
  await seedValidationForValidatedAction();
  await seedAutoValidationSession();
  await seedVisitWithNonConformity();
  await seedPlanning();
  await seedPointages();
  await seedNotifications();

  console.log("✓ Seed PRÉPROD terminé.");
  console.log(`  • 2 équipes (${TEAMS.map((t) => t.code).join(", ")})`);
  console.log(`  • ${USERS.length} comptes (mot de passe commun : ${DEFAULT_PASSWORD})`);
  USERS.forEach((u) => console.log(`     - ${u.email}  [${u.profile}]`));
  console.log(`  • ${AGENTS.length} agents, ${SITES.length} sites, 1 véhicule`);
  console.log(`  • ${actionSeeds().length} actions (états + doublons + cross-team)`);
  console.log("  • planning A & B, pointages, session auto-val, visite + NC, notifications");
  console.log(`  • matricule INCONNU à utiliser dans un fichier planning : ${UNKNOWN_MATRICULE}`);
}

main()
  .then(() => prisma.$disconnect())
  .then(() => process.exit(0))
  .catch(async (e) => {
    console.error("✗ Seed PRÉPROD échoué :", e);
    await prisma.$disconnect();
    process.exit(1);
  });
