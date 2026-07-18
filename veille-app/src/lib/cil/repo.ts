/**
 * Helpers serveur du Livret CIL — chargement, sérialisation et primitives
 * transactionnelles partagées par les routes API. Server-only (importe Prisma).
 */
import { prisma } from "@/lib/prisma";
import type { Prisma, PrismaClient } from "@prisma/client";
import type {
  CilAutorisationDTO,
  CilDepecheDTO,
  CilEventDTO,
  CilEventType,
  CilIncidentDTO,
  CilIncidentFull,
  CilIntervenantDTO,
  CilSignatureDTO,
  DepecheGeometry,
  DepecheInterlocutor,
  DepecheSens,
  DepecheSubtype,
  Etablissement,
  GareMode,
  IncidentStatus,
  IncidentType,
  IntervenantType,
  RepriseAuthorization,
  SignatureOwnerType,
} from "./types";

type Tx = Prisma.TransactionClient | PrismaClient;

export const INCIDENT_INCLUDE = {
  events: { orderBy: [{ occurredAt: "asc" }, { seq: "asc" }] as const },
  depeches: { include: { destinataires: true } },
  intervenants: { orderBy: { createdAt: "asc" } as const },
  signatures: true,
  autorisations: true,
} satisfies Prisma.CilIncidentInclude;

type IncidentRow = Prisma.CilIncidentGetPayload<{ include: typeof INCIDENT_INCLUDE }>;

const iso = (d: Date | null): string | null => (d ? d.toISOString() : null);

function parseGeometry(metadata: string | null): DepecheGeometry {
  if (!metadata) return {};
  try {
    return JSON.parse(metadata) as DepecheGeometry;
  } catch {
    return {};
  }
}

function parseEventMetadata(
  metadata: string | null,
): Record<string, unknown> | null {
  if (!metadata) return null;
  try {
    const v = JSON.parse(metadata);
    return v && typeof v === "object" ? (v as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

export function serializeIncident(row: IncidentRow): CilIncidentFull {
  const eventTimeById = new Map<string, string>();
  for (const e of row.events) eventTimeById.set(e.id, e.occurredAt.toISOString());

  const incident: CilIncidentDTO = {
    id: row.id,
    status: row.status as IncidentStatus,
    reference: row.reference,
    type: row.type as IncidentType,
    typeLibre: row.typeLibre,
    occurredAt: row.occurredAt.toISOString(),
    lieu: row.lieu,
    poste: row.poste,
    voie: row.voie,
    observations: row.observations,
    gareMode: (row.gareMode as GareMode | null) ?? null,
    gareUnique: row.gareUnique,
    gareA: row.gareA,
    gareB: row.gareB,
    voies: row.voies,
    km: row.km,
    acLabel: row.acLabel,
    motif: row.motif,
    cilNom: row.cilNom,
    cilPrenom: row.cilPrenom,
    cilEtablissement: row.cilEtablissement as Etablissement | null,
    designatedAt: iso(row.designatedAt),
    arrivedOnSiteAt: iso(row.arrivedOnSiteAt),
    closedAt: iso(row.closedAt),
  };

  const events: CilEventDTO[] = row.events.map((e) => ({
    id: e.id,
    type: e.type as CilEventType,
    occurredAt: e.occurredAt.toISOString(),
    seq: e.seq,
    label: e.label,
    note: e.note,
    actorName: e.actorName,
    refType: e.refType,
    refId: e.refId,
    metadata: parseEventMetadata(e.metadata),
  }));

  const depeches: CilDepecheDTO[] = row.depeches.map((d) => ({
    id: d.id,
    subtype: d.subtype as DepecheSubtype,
    interlocutor: (d.interlocutor as DepecheInterlocutor | null) ?? null,
    sens: (d.sens as DepecheSens | null) ?? null,
    texte: d.texte,
    numeroDonne: d.numeroDonne,
    numeroRecu: d.numeroRecu,
    collationne: d.collationne,
    occurredAt: eventTimeById.get(d.eventId) ?? d.createdAt.toISOString(),
    avisCrcAt: iso(d.avisCrcAt),
    avisCosAt: iso(d.avisCosAt),
    avisOpjAt: iso(d.avisOpjAt),
    departEffectifAt: iso(d.departEffectifAt),
    repriseAuthorization: (d.repriseAuthorization as RepriseAuthorization | null) ?? null,
    geometry: parseGeometry(d.metadata),
    destinataires: d.destinataires.map((x) => ({
      id: x.id,
      label: x.label,
      numeroRecu: x.numeroRecu,
    })),
  }));

  const intervenants: CilIntervenantDTO[] = row.intervenants.map((i) => ({
    id: i.id,
    type: i.type as IntervenantType,
    typeLibre: i.typeLibre,
    nom: i.nom,
    tel: i.tel,
    arrivedAt: iso(i.arrivedAt),
    departedAt: iso(i.departedAt),
  }));

  const signatures: CilSignatureDTO[] = row.signatures.map((s) => ({
    id: s.id,
    ownerType: s.ownerType as SignatureOwnerType,
    ownerId: s.ownerId,
    signerName: s.signerName,
    signerRole: s.signerRole,
    imageB64: s.imageB64,
  }));

  const autorisations: CilAutorisationDTO[] = row.autorisations.map((a) => ({
    id: a.id,
    subtype: a.subtype as DepecheSubtype,
    role: a.role as "COS" | "OPJ",
    grantedAt: a.grantedAt.toISOString(),
    signerName: a.signerName,
    imageB64: a.imageB64,
  }));

  return { incident, events, depeches, intervenants, signatures, autorisations };
}

export async function loadIncidentFull(id: string): Promise<IncidentRow | null> {
  return prisma.cilIncident.findUnique({ where: { id }, include: INCIDENT_INCLUDE });
}

/** Prochain `seq` (ordre de saisie) pour un incident — tie-breaker de tri stable. */
export async function nextSeq(tx: Tx, incidentId: string): Promise<number> {
  const last = await tx.cilEvent.findFirst({
    where: { incidentId },
    orderBy: { seq: "desc" },
    select: { seq: true },
  });
  return (last?.seq ?? 0) + 1;
}

/** Crée un événement de frise (dans une transaction). */
export async function createEvent(
  tx: Tx,
  args: {
    incidentId: string;
    type: CilEventType;
    occurredAt: Date;
    label: string;
    note?: string | null;
    actorId?: string | null;
    actorName?: string | null;
    refType?: string | null;
    refId?: string | null;
    metadata?: Record<string, unknown> | null;
  },
) {
  const seq = await nextSeq(tx, args.incidentId);
  return tx.cilEvent.create({
    data: {
      incidentId: args.incidentId,
      type: args.type,
      occurredAt: args.occurredAt,
      seq,
      label: args.label,
      note: args.note ?? null,
      actorId: args.actorId ?? null,
      actorName: args.actorName ?? null,
      refType: args.refType ?? null,
      refId: args.refId ?? null,
      metadata: args.metadata ? JSON.stringify(args.metadata) : null,
    },
  });
}

/** Numéros de dépêche déjà réservés pour un incident. */
export async function usedNumbers(tx: Tx, incidentId: string): Promise<number[]> {
  const rows = await tx.cilDepeche.findMany({
    where: { incidentId },
    select: { numeroDonne: true },
  });
  return rows.map((r) => r.numeroDonne);
}
