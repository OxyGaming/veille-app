import { NextResponse } from "next/server";
import { createHash } from "crypto";
import { prisma } from "@/lib/prisma";
import { effectiveTeamIds, requireRole } from "@/lib/auth";
import { parseRow, readWorkbook, type ParsedActionRow } from "@/lib/actionImport";

/**
 * Calcule une empreinte logique pour grouper les doublons d'un même agent :
 * actions distinctes côté ID Action mais identiques en contenu fonctionnel.
 * Normalise espaces + casse pour ne pas être sensible aux variations cosmétiques.
 */
function dedupHashFor(r: ParsedActionRow): string {
  const norm = (s: string | null | undefined) =>
    (s ?? "").replace(/\s+/g, " ").trim().toLowerCase();
  const sig = [
    norm(r.keyPoint),
    norm(r.comment),
    norm(r.actionPlan),
    r.dueAt?.toISOString().slice(0, 10) ?? "",
    norm(r.type),
    norm(r.subType),
  ].join("|");
  return createHash("sha1").update(sig).digest("hex");
}

export const maxDuration = 300;

/**
 * Import Excel d'actions agent — version optimisée pour ~20k lignes.
 *
 * Stratégie :
 *  1. Lecture/parse du fichier (CPU)
 *  2. Pré-fetch en deux requêtes : agents par matricule + actions existantes par externalId (pour cette équipe)
 *  3. Création des nouveaux agents en createMany
 *  4. Refetch des agents pour récupérer leurs ids
 *  5. Création des nouvelles actions en createMany (par chunks de 500)
 *  6. Mise à jour des existantes via UPDATE ... CASE (raw SQL) en chunks
 *  7. Marquage OBSOLETE des ACTIVE non vues (UPDATE WHERE NOT IN)
 *
 * Sur SQLite + 17k lignes : doit passer sous 5 secondes.
 */
export async function POST(req: Request) {
  let u;
  try {
    u = await requireRole(["ADMIN", "EDITOR"]);
  } catch (r) {
    return r as Response;
  }
  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof Blob)) {
    return NextResponse.json({ error: "Fichier manquant" }, { status: 400 });
  }

  // Équipe cible explicite (sélecteur UI) ; à défaut, équipe principale de
  // l'utilisateur. Doit appartenir à son périmètre agissable — le batch entier
  // est rattaché à cette équipe (cloisonnement).
  const requestedTeamId = form.get("teamId");
  const teamId =
    (typeof requestedTeamId === "string" && requestedTeamId) || u.teamId;
  if (!teamId) {
    return NextResponse.json(
      { error: "Sélectionnez une équipe cible avant l'import." },
      { status: 400 }
    );
  }
  const eff = effectiveTeamIds(u);
  if (eff !== null && !eff.includes(teamId)) {
    return NextResponse.json(
      { error: "Équipe non autorisée pour cet import." },
      { status: 403 }
    );
  }

  const t0 = Date.now();
  const buffer = Buffer.from(await file.arrayBuffer());
  const rows = readWorkbook(buffer);
  const parsed = rows
    .map(parseRow)
    .filter((r): r is NonNullable<typeof r> => !!r);

  // Dédupliquer par (externalId, agentMatricule). Un même ID Action peut
  // être affecté à plusieurs agents — chacun reçoit sa propre ligne d'action.
  // Pour les actions sans agent (autres types de veille), on garde la ligne
  // avec une clé null.
  //
  // Stratégie pour le tri ACTIVE/OBSOLETE : on garde l'occurrence "la plus
  // à faire" (realizedAt = null prime sur une date remplie). Sinon dernière
  // occurrence. Évite qu'une ligne historique "fait le 30/06" écrase une
  // ligne "à faire" plus récente du même couple.
  const dedupKeyByMat = (r: ParsedActionRow) =>
    `${r.externalId}|${r.parsedAgent?.matricule ?? "__none__"}`;
  const byKey = new Map<string, ParsedActionRow>();
  for (const r of parsed) {
    const k = dedupKeyByMat(r);
    const prev = byKey.get(k);
    if (!prev) byKey.set(k, r);
    else if (prev.realizedAt != null && r.realizedAt == null) byKey.set(k, r);
    // sinon on garde prev (priorité au "à faire")
  }
  const uniqueRows = [...byKey.values()];

  // 1. Pré-fetch des agents par matricule.
  const matricules = [
    ...new Set(
      uniqueRows
        .map((r) => r.parsedAgent?.matricule)
        .filter((m): m is string => !!m)
    ),
  ];
  // Cloisonnement (Priorité 3) : le lookup matricule est global (matricule =
  // clé unique), mais on ne LIE une action qu'à un agent appartenant à l'équipe
  // cible. On charge donc l'appartenance pour décider :
  //  - agent déjà dans l'équipe cible (AgentTeam ou teamId legacy) → liable ;
  //  - agent orphelin (aucune équipe) → adopté dans l'équipe cible (AgentTeam) ;
  //  - agent appartenant à une AUTRE équipe → JAMAIS lié ni modifié (compté).
  const existingAgents = await prisma.agent.findMany({
    where: { matricule: { in: matricules } },
    select: {
      id: true,
      matricule: true,
      teamId: true,
      memberships: { select: { teamId: true } },
    },
  });
  // agentByMat : matricule → { id, inTeam } ; inTeam=false ⇒ agent d'une autre
  // équipe, l'action sera créée sans agentId (rattachée à l'équipe cible seule).
  const agentByMat = new Map<string, { id: string; inTeam: boolean }>();
  const orphansToAdopt: string[] = [];
  for (const a of existingAgents) {
    const memTeams = a.memberships.map((m) => m.teamId);
    const inTarget = a.teamId === teamId || memTeams.includes(teamId);
    const isOrphan = !a.teamId && memTeams.length === 0;
    if (inTarget) {
      agentByMat.set(a.matricule, { id: a.id, inTeam: true });
    } else if (isOrphan) {
      orphansToAdopt.push(a.id);
      agentByMat.set(a.matricule, { id: a.id, inTeam: true });
    } else {
      // Agent d'une autre équipe : on ne le lie pas et on ne le modifie pas.
      agentByMat.set(a.matricule, { id: a.id, inTeam: false });
    }
  }
  // Adoption des orphelins (rattachement additif à l'équipe cible uniquement).
  if (orphansToAdopt.length) {
    await prisma.agentTeam.createMany({
      data: orphansToAdopt.map((agentId) => ({ agentId, teamId })),
    });
  }

  // Agents nouveaux à créer (matricule inconnu en base).
  const newAgents: {
    matricule: string;
    firstName: string;
    lastName: string;
    rawLabel: string;
    teamId: string;
  }[] = [];
  const seenNewMat = new Set<string>();
  for (const r of uniqueRows) {
    const pa = r.parsedAgent;
    if (!pa) continue;
    if (agentByMat.has(pa.matricule)) continue;
    if (seenNewMat.has(pa.matricule)) continue;
    seenNewMat.add(pa.matricule);
    newAgents.push({
      matricule: pa.matricule,
      firstName: pa.firstName,
      lastName: pa.lastName,
      rawLabel: pa.raw,
      teamId,
    });
  }

  if (newAgents.length) {
    await prisma.agent.createMany({ data: newAgents });
    const refetched = await prisma.agent.findMany({
      where: { matricule: { in: newAgents.map((a) => a.matricule) } },
      select: { id: true, matricule: true },
    });
    // Rattachement AgentTeam à l'équipe cible — le scope effectif passe par
    // AgentTeam (sans ça les agents importés seraient invisibles via agentScope).
    await prisma.agentTeam.createMany({
      data: refetched.map((a) => ({ agentId: a.id, teamId })),
    });
    for (const a of refetched) {
      agentByMat.set(a.matricule, { id: a.id, inTeam: true });
    }
  }

  // 2. Création de l'enregistrement d'import (sera mis à jour à la fin).
  const importLog = await prisma.actionImport.create({
    data: {
      teamId,
      importedById: u.id,
      fileName: (file as File).name ?? null,
      rowsTotal: rows.length,
    },
  });

  // 3. Pré-fetch des actions existantes pour cette équipe (par externalId,
  // puis indexées par (externalId, agentId)).
  const allExtIds = uniqueRows.map((r) => r.externalId);
  const existingActions = await prisma.importedAction.findMany({
    where: { externalId: { in: allExtIds }, teamId },
    select: { id: true, externalId: true, agentId: true, localStatus: true },
  });
  const existingByKey = new Map(
    existingActions.map((a) => [`${a.externalId}|${a.agentId ?? "__none__"}`, a])
  );

  // 4. Split rows en "à créer" vs "à mettre à jour" + actions déjà réalisées à archiver.
  //
  // Règle métier : une action est "à faire" si "Date de réalisation" est vide.
  // Si la date est renseignée, l'action a été réalisée → OBSOLETE (mais conservée
  // pour l'historique de l'agent).
  const toCreate: ParsedActionRow[] = [];
  const toUpdate: { row: ParsedActionRow; existing: typeof existingActions[number] }[] = [];
  let unknownAgents = 0;
  // Compteur des lignes dont le matricule pointe un agent d'une AUTRE équipe :
  // l'action est créée dans l'équipe cible mais SANS agentId (cloisonnement).
  let crossTeamAgents = 0;
  // dedupKey via agentId (résolu via agentByMat) pour matcher l'index BDD.
  // Un agent hors équipe cible (inTeam=false) n'est jamais lié → agentId null.
  const resolveAgentId = (r: ParsedActionRow): string | null => {
    const pa = r.parsedAgent;
    if (!pa) return null;
    const a = agentByMat.get(pa.matricule);
    return a && a.inTeam ? a.id : null;
  };
  const dedupKey = (r: ParsedActionRow) =>
    `${r.externalId}|${resolveAgentId(r) ?? "__none__"}`;
  // seenKeys = ensemble des (externalId|agentId) vus dans ce fichier.
  const seenKeys = new Set<string>();

  for (const row of uniqueRows) {
    seenKeys.add(dedupKey(row));
    const isDone = row.realizedAt != null;

    if (!row.parsedAgent && row.observedElement) {
      unknownAgents++;
    }
    // Matricule connu mais agent d'une autre équipe → non lié (compté).
    if (row.parsedAgent) {
      const a = agentByMat.get(row.parsedAgent.matricule);
      if (a && !a.inTeam) crossTeamAgents++;
    }

    const existing = existingByKey.get(dedupKey(row));

    if (isDone) {
      // Action déjà réalisée : on l'enregistre (créée ou mise à jour) en OBSOLETE
      // pour conserver l'historique côté agent. Une action validée localement
      // reste VALIDATED_LOCAL.
      if (existing) {
        toUpdate.push({ row, existing });
      } else {
        toCreate.push(row);
      }
      continue;
    }

    if (existing) {
      toUpdate.push({ row, existing });
    } else {
      toCreate.push(row);
    }
  }

  // 5. Bulk insert des nouvelles actions par chunks de 500.
  const CHUNK = 500;
  let created = 0;
  for (let i = 0; i < toCreate.length; i += CHUNK) {
    const slice = toCreate.slice(i, i + CHUNK);
    await prisma.importedAction.createMany({
      data: slice.map((r) => ({
        externalId: r.externalId,
        teamId,
        agentId: resolveAgentId(r),
        localStatus: r.realizedAt != null ? "OBSOLETE" : "ACTIVE",
        dedupHash: dedupHashFor(r),
        originalStatus: r.originalStatus,
        type: r.type,
        subType: r.subType,
        establishment: r.establishment,
        unit: r.unit,
        secteur: r.secteur,
        veilleGroup: r.veilleGroup,
        space: r.space,
        domain: r.domain,
        theme: r.theme,
        keyPoint: r.keyPoint,
        observedElement: r.observedElement,
        veilleType: r.veilleType,
        realizedAt: r.realizedAt,
        dueAt: r.dueAt,
        closedAt: r.closedAt,
        comment: r.comment,
        initialOwner: r.initialOwner,
        sharedWith: r.sharedWith,
        transferredTo: r.transferredTo,
        actionPlan: r.actionPlan,
        importId: importLog.id,
      })),
    });
    created += slice.length;
  }

  // 6. Updates en batch via prisma.$transaction (un round-trip pour 500 entries).
  let updated = 0;
  const now = new Date();
  for (let i = 0; i < toUpdate.length; i += CHUNK) {
    const slice = toUpdate.slice(i, i + CHUNK);
    await prisma.$transaction(
      slice.map(({ row, existing }) => {
        const isDone = row.realizedAt != null;
        const nextLocal =
          existing.localStatus === "VALIDATED_LOCAL"
            ? "VALIDATED_LOCAL"
            : isDone
            ? "OBSOLETE"
            : "ACTIVE";
        const agentId = resolveAgentId(row);
        return prisma.importedAction.update({
          where: { id: existing.id },
          data: {
            // teamId ne change pas, on omet pour éviter checked-update strict.
            agentId: agentId ?? undefined,
            localStatus: nextLocal,
            dedupHash: dedupHashFor(row),
            originalStatus: row.originalStatus ?? undefined,
            type: row.type ?? undefined,
            subType: row.subType ?? undefined,
            establishment: row.establishment ?? undefined,
            unit: row.unit ?? undefined,
            secteur: row.secteur ?? undefined,
            veilleGroup: row.veilleGroup ?? undefined,
            space: row.space ?? undefined,
            domain: row.domain ?? undefined,
            theme: row.theme ?? undefined,
            keyPoint: row.keyPoint ?? undefined,
            observedElement: row.observedElement ?? undefined,
            veilleType: row.veilleType ?? undefined,
            realizedAt: row.realizedAt ?? undefined,
            dueAt: row.dueAt ?? undefined,
            closedAt: row.closedAt ?? undefined,
            comment: row.comment ?? undefined,
            initialOwner: row.initialOwner ?? undefined,
            sharedWith: row.sharedWith ?? undefined,
            transferredTo: row.transferredTo ?? undefined,
            actionPlan: row.actionPlan ?? undefined,
            lastSeenAt: now,
            importId: importLog.id,
          },
        });
      })
    );
    updated += slice.length;
  }

  // 7. Marquer OBSOLETE les ACTIVE (externalId, agentId) absents du fichier.
  let obsoleted = 0;
  if (seenKeys.size) {
    const activeRows = await prisma.importedAction.findMany({
      where: { teamId, localStatus: "ACTIVE" },
      select: { id: true, externalId: true, agentId: true },
    });
    const toObsIds = activeRows
      .filter(
        (a) =>
          !seenKeys.has(`${a.externalId}|${a.agentId ?? "__none__"}`)
      )
      .map((a) => a.id);
    if (toObsIds.length) {
      for (let i = 0; i < toObsIds.length; i += 1000) {
        const slice = toObsIds.slice(i, i + 1000);
        await prisma.importedAction.updateMany({
          where: { id: { in: slice } },
          data: { localStatus: "OBSOLETE" },
        });
      }
      obsoleted = toObsIds.length;
    }
  }

  const elapsed = Date.now() - t0;

  await prisma.actionImport.update({
    where: { id: importLog.id },
    data: {
      rowsCreated: created,
      rowsUpdated: updated,
      rowsObsoleted: obsoleted,
      rowsErrored: 0,
      agentsCreated: newAgents.length,
      unknownAgents,
      summary: JSON.stringify({
        elapsedMs: elapsed,
        uniqueRows: uniqueRows.length,
        crossTeamAgents,
        orphansAdopted: orphansToAdopt.length,
      }),
    },
  });

  return NextResponse.json({
    importId: importLog.id,
    rowsTotal: rows.length,
    uniqueRows: uniqueRows.length,
    created,
    updated,
    obsoleted,
    agentsCreated: newAgents.length,
    unknownAgents,
    crossTeamAgents,
    elapsedMs: elapsed,
  });
}
