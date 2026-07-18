"use client";

import { useMemo, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { Icon } from "@/components/icons";
import SignaturePad from "@/app/(app)/rci/[id]/wizard/SignaturePad";
import TimeField from "./TimeField";
import {
  DEPECHE_SUBTYPE_LABELS,
  INCIDENT_TYPE_LABELS,
  INTERVENANT_TYPES,
  INTERVENANT_TYPE_LABELS,
  type CilIncidentFull,
  type DepecheSubtype,
  type IncidentType,
  type IntervenantType,
} from "@/lib/cil/types";
import { getTemplateForSubtype, renderTemplateText } from "@/lib/cil/depeches/catalog";
import { randomAvailableNumber, randomNumberForSubtype, NUMBER_RANGES } from "@/lib/cil/numbering";
import { fmtDateTimeFr, localInputToIso, nowLocalInput } from "@/lib/cil/format";
import type { CilActionId } from "@/lib/cil/machine";

// ─── Wrapper modale (style cohérent NoteModal / ContactCreateModal) ───────────

function Modal({
  title,
  icon,
  onClose,
  children,
  footer,
}: {
  title: string;
  icon?: ReactNode;
  onClose: () => void;
  children: ReactNode;
  footer: ReactNode;
}) {
  return (
    <>
      <div className="fixed inset-0 bg-slate-900/40 z-50 backdrop-blur-[1px]" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="fixed inset-x-0 bottom-0 md:bottom-auto md:top-1/2 md:left-1/2 md:-translate-x-1/2 md:-translate-y-1/2 md:max-w-lg md:w-full z-50 bg-white rounded-t-2xl md:rounded-2xl shadow-2xl border border-slate-200 overflow-hidden max-h-[92vh] flex flex-col"
      >
        <header className="px-4 py-3 border-b border-slate-200 flex items-center gap-2 shrink-0">
          {icon}
          <h3 className="font-bold text-sm flex-1">{title}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600" aria-label="Fermer">
            <Icon.X className="w-5 h-5" />
          </button>
        </header>
        <div className="p-4 space-y-3 overflow-auto">{children}</div>
        <footer className="px-4 py-3 border-t border-slate-100 flex justify-end gap-2 shrink-0">
          {footer}
        </footer>
      </div>
    </>
  );
}

const inputCls = "input w-full";
const lblCls = "block text-xs font-semibold text-slate-700 mb-1";

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <label className={lblCls}>{label}</label>
      {children}
    </div>
  );
}

async function postJson(url: string, body: unknown): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (res.ok) return { ok: true };
    const j = await res.json().catch(() => ({}));
    return { ok: false, error: j.error || "Échec de l'enregistrement." };
  } catch {
    return { ok: false, error: "Erreur réseau." };
  }
}

async function patchJson(url: string, body: unknown): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(url, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (res.ok) return { ok: true };
    const j = await res.json().catch(() => ({}));
    return { ok: false, error: j.error || "Échec de l'enregistrement." };
  } catch {
    return { ok: false, error: "Erreur réseau." };
  }
}

// ─── Modale générique d'action ────────────────────────────────────────────────

export const ACTION_SUBTYPE: Partial<Record<CilActionId, DepecheSubtype>> = {
  ADD_PROTECTION_CIRCULATION: "PROTECTION_CIRCULATION",
  ADD_PROTECTION_ELECTRIQUE: "PROTECTION_ELECTRIQUE",
  ADD_REPRISE_PARTIELLE: "REPRISE_PARTIELLE",
  ADD_REPRISE_NORMALE: "REPRISE_NORMALE",
  ADD_RETABLISSEMENT_PARTIEL: "RETABLISSEMENT_PARTIEL",
  ADD_RETABLISSEMENT_NORMAL: "RETABLISSEMENT_NORMAL",
};

export function CilActionModal({
  action,
  incident,
  prefillTexte,
  onTransmettre,
  onClose,
  onDone,
}: {
  action: CilActionId;
  incident: CilIncidentFull;
  /** Texte pré-rempli pour une dépêche libre (transmission d'une dépêche passée). */
  prefillTexte?: string;
  /** Bascule vers une dépêche libre pré-remplie. */
  onTransmettre: (texte: string) => void;
  onClose: () => void;
  onDone: () => void;
}) {
  const id = incident.incident.id;
  const done = () => {
    onDone();
    onClose();
  };

  if (action === "DECLARE_ARRIVAL") {
    return <ArrivalModal incidentId={id} onClose={onClose} onDone={done} />;
  }
  if (action === "ADD_INTERVENANT") {
    return <IntervenantModal incidentId={id} onClose={onClose} onDone={done} />;
  }
  if (action === "ADD_DEPECHE_LIBRE") {
    return (
      <LibreModal
        incident={incident}
        prefillTexte={prefillTexte}
        onClose={onClose}
        onDone={done}
      />
    );
  }
  if (action === "CHANGE_CIL") {
    return <ChangementCilModal incidentId={id} onClose={onClose} onDone={done} />;
  }
  if (action === "ADD_NOTE") {
    return <NoteModal incidentId={id} onClose={onClose} onDone={done} />;
  }
  if (action === "CLOSE") {
    return <CloseModal incidentId={id} onClose={onClose} onDone={done} />;
  }
  const subtype = ACTION_SUBTYPE[action];
  if (subtype) {
    return (
      <DepecheModal
        incident={incident}
        subtype={subtype}
        onClose={onClose}
        onDone={done}
        onRefresh={onDone}
        onTransmettre={onTransmettre}
      />
    );
  }
  return null;
}

// ─── Arrivée sur site ─────────────────────────────────────────────────────────

function ArrivalModal({ incidentId, onClose, onDone }: { incidentId: string; onClose: () => void; onDone: () => void }) {
  const [at, setAt] = useState(nowLocalInput());
  const [busy, setBusy] = useState(false);
  async function submit() {
    setBusy(true);
    const r = await patchJson(`/api/cil/${incidentId}`, { action: "arrival", at: localInputToIso(at) });
    setBusy(false);
    if (r.ok) {
      toast.success("Arrivée sur site enregistrée");
      onDone();
    } else toast.error(r.error!);
  }
  return (
    <Modal
      title="Je suis arrivé sur place"
      icon={<Icon.Shield className="w-4 h-4 text-rose-600" />}
      onClose={onClose}
      footer={
        <>
          <BtnCancel onClose={onClose} />
          <BtnPrimary busy={busy} onClick={submit} label="Confirmer l'arrivée" />
        </>
      }
    >
      <p className="text-xs text-slate-500">
        La responsabilité des protections est transférée du CRC au CIL à cette heure.
      </p>
      <TimeField label="Heure d'arrivée" value={at} onChange={setAt} />
    </Modal>
  );
}

// ─── Dépêche standard (protection / reprise / rétablissement) ────────────────

function DepecheModal({
  incident,
  subtype,
  onClose,
  onDone,
  onRefresh,
  onTransmettre,
}: {
  incident: CilIncidentFull;
  subtype: DepecheSubtype;
  onClose: () => void;
  onDone: () => void;
  /** Recharge l'incident SANS fermer (enchaînement des deux dépêches). */
  onRefresh: () => void;
  /** Ouvre une dépêche libre pré-remplie (retransmission à un AC encadrant). */
  onTransmettre: (texte: string) => void;
}) {
  const incidentId = incident.incident.id;
  const isCirculation = subtype === "PROTECTION_CIRCULATION";
  const isReprise = subtype === "REPRISE_PARTIELLE" || subtype === "REPRISE_NORMALE";
  const isRetab = subtype === "RETABLISSEMENT_PARTIEL" || subtype === "RETABLISSEMENT_NORMAL";
  const needsSignature = isReprise || isRetab;

  const usedNums = useMemo(
    () => incident.depeches.map((d) => d.numeroDonne),
    [incident.depeches],
  );
  const isProtection = subtype === "PROTECTION_CIRCULATION" || subtype === "PROTECTION_ELECTRIQUE";
  // Numéros TIRÉS AU HASARD dans la plage, une seule fois à l'ouverture : le n°
  // annoncé ici est celui envoyé au serveur (et retenu, sauf collision).
  // Reprise/rétablissement : 1 numéro. Protection : 2 numéros (CRC + RSS/AC).
  const [nextNum, setNextNum] = useState<number | null>(() =>
    isProtection
      ? randomAvailableNumber(NUMBER_RANGES.PROTECTION, usedNums)
      : randomNumberForSubtype(subtype, usedNums),
  );
  const secondInterlocutor = isCirculation ? "AC" : "RSS";
  const secondLabelFixed = isCirculation ? "AC" : "RSS de Lyon";
  /**
   * Une protection se transmet en DEUX envois successifs, chacun avec son heure
   * et son n° reçu. On traite d'abord le CRC, puis le RSS/AC ; l'étape courante
   * est déduite de ce qui a déjà été transmis (on peut fermer entre les deux).
   */
  const dejaTransmis = (interlocutor: string) =>
    incident.depeches.some(
      (dd) => dd.subtype === subtype && dd.interlocutor === interlocutor,
    );
  const [cible, setCible] = useState<"CRC" | "RSS" | "AC">(() =>
    dejaTransmis("CRC") ? (secondInterlocutor as "RSS" | "AC") : "CRC",
  );
  const cibleLabel = cible === "CRC" ? "CRC de Lyon" : secondLabelFixed;
  const resteASuivre = isProtection && !dejaTransmis(cible === "CRC" ? secondInterlocutor : "CRC");
  const cilName = [incident.incident.cilNom, incident.incident.cilPrenom].filter(Boolean).join(" ");
  const evenement =
    incident.incident.type === "AUTRE" && incident.incident.typeLibre
      ? incident.incident.typeLibre
      : INCIDENT_TYPE_LABELS[incident.incident.type as IncidentType];

  const hasRetab = isRetab;
  // Géométrie saisie UNE fois sur l'incident et reprise par défaut ici ; le
  // crayon permet de s'en écarter ponctuellement pour cette dépêche.
  const inc = incident.incident;
  // Repli sur ce que l'incident sait déjà : la voie et le poste ont été saisis
  // à la création, le motif est la nature de l'événement. Rien n'est redemandé
  // à blanc — tout arrive pré-rédigé et reste modifiable.
  const [voies, setVoies] = useState(inc.voies ?? inc.voie ?? "");
  const [km, setKm] = useState(inc.km ?? "");
  const [ac, setAc] = useState(inc.acLabel ?? inc.poste ?? ""); // « à AC de … »
  const [motif, setMotif] = useState(inc.motif ?? evenement);
  /** Champs hérités dépliés pour modification (sinon affichés en rappel). */
  const [editGeom, setEditGeom] = useState(false);
  /**
   * Rappel compact seulement si TOUT ce qui est utile à cette dépêche est déjà
   * connu ; sinon on présente les champs pré-remplis pour compléter ce qui
   * manque (typiquement le kilomètre, jamais saisi ailleurs).
   */
  const needsAc = isReprise || (isProtection && isCirculation);
  /**
   * Décision prise UNE FOIS à l'ouverture, sur ce que l'incident sait déjà :
   * si on la recalculait à chaque frappe, le bloc se replierait au moment même
   * où l'utilisateur saisit le kilomètre.
   */
  const [geomComplete] = useState(
    () =>
      !!(inc.voies ?? inc.voie) &&
      !!inc.km &&
      // Le motif retombe toujours sur la nature de l'incident : il est donc
      // considéré comme connu (mêmes replis que l'initialisation des champs).
      (!isProtection || !!(inc.motif ?? evenement)) &&
      (!needsAc || !!(inc.acLabel ?? inc.poste)),
  );
  // Localisation : choisie UNE fois à la création de l'incident, jamais
  // redemandée ici (rappel en lecture seule).
  const localisation =
    inc.gareMode === "BETWEEN"
      ? `entre les gares de ${inc.gareA ?? "…"} et de ${inc.gareB ?? "…"}`
      : inc.gareMode === "UNIQUE"
        ? `en gare de ${inc.gareUnique ?? "…"}`
        : null;
  const [voiesInterdites, setVoiesInterdites] = useState("");
  const [voiesPrudente, setVoiesPrudente] = useState("");
  const [voiesNormale, setVoiesNormale] = useState("");
  const [occurredAt, setOccurredAt] = useState(nowLocalInput());
  const [numeroRecu, setNumeroRecu] = useState(""); // reprise/rétab (CRC)
  // Protection circulation : destinataire de la 2ᵉ dépêche (« AC de … »).
  const [acLabel, setAcLabel] = useState(inc.acLabel ?? inc.poste ?? "");
  // Autorisations reprise/rétablissement : pour chaque COS/OPJ présent.
  // « Avis (obligatoire) » : au CRC (reprise) / aux autorités (protection).
  const [avisCrcAt, setAvisCrcAt] = useState("");
  const [avisCosAt, setAvisCosAt] = useState("");
  const [avisOpjAt, setAvisOpjAt] = useState("");
  const [busy, setBusy] = useState(false);
  /**
   * Une dépêche transmise à un AC doit souvent être retransmise à l'AC
   * encadrant : on pose systématiquement la question après l'envoi, plutôt que
   * de compter sur la mémoire du CIL.
   */
  const [demandeRetransmission, setDemandeRetransmission] = useState<string | null>(null);

  const cosPresent = incident.intervenants.some(
    (i) => i.type === "COS" && i.arrivedAt && !i.departedAt,
  );
  const opjPresent = incident.intervenants.some(
    (i) => i.type === "OPJ" && i.arrivedAt && !i.departedAt,
  );
  // Une reprise exige, pour chaque autorité présente, l'autorisation ET sa
  // signature. Elles sont recueillies en amont (écran dédié) : on vérifie ici
  // qu'elles existent bien, même règle que le serveur (cf. repriseAllowed).
  const autorisationFor = (role: "COS" | "OPJ") =>
    incident.autorisations.find((a) => a.subtype === subtype && a.role === role);
  const manque: string[] = [];
  if (isReprise || hasRetab) {
    if (cosPresent && !autorisationFor("COS")) manque.push("autorisation du COS");
    if (opjPresent && !autorisationFor("OPJ")) manque.push("autorisation de l'OPJ");
  }
  const authOk = manque.length === 0;

  /** Libellé imprimé en tête pour un interlocuteur donné. */
  const labelDestinataire = (pour: "CRC" | "RSS" | "AC") =>
    pour === "CRC"
      ? "CRC de Lyon"
      : pour === "RSS"
        ? "RSS de Lyon"
        : `AC de ${(isReprise ? ac : acLabel) || inc.acLabel || inc.poste || "…"}`;

  // `pour` permet de régénérer le texte pour le PROCHAIN interlocuteur avant
  // que l'état `cible` ne soit rafraîchi par React.
  const buildTextPour = (pour: "CRC" | "RSS" | "AC") => {
    const tpl = getTemplateForSubtype(subtype);
    if (!tpl) return "";
    return renderTemplateText(tpl.text, {
      cil: cilName,
      evenement,
      // La localisation vient de l'incident : elle doit figurer dans le texte
      // relu (« Dépêches passées »), pas seulement dans les cases du livret.
      localisation: localisation ?? "",
      destinataire: labelDestinataire(pour),
      voies,
      km,
      motif,
      ac,
      voiesInterdites,
      voiesPrudente,
      voiesNormale,
    });
  };
  const buildText = () => buildTextPour(cible);
  const [texte, setTexte] = useState(buildText);

  function collectGeometry(): Record<string, string> {
    const g: Record<string, string> = {};
    if (voies) g.voies = voies;
    if (km) g.km = km;
    if (ac) g.ac = ac;
    if (motif) g.motif = motif;
    if (voiesInterdites) g.marcheInterdite = voiesInterdites;
    if (voiesPrudente) g.marchePrudente = voiesPrudente;
    if (voiesNormale) g.marcheNormale = voiesNormale;
    return g;
  }

  /**
   * Mémorise sur l'incident les éléments qui n'y étaient pas encore (typiquement
   * le kilomètre) : ils seront pré-remplis dans les dépêches suivantes.
   */
  async function rememberGeometry() {
    const patch: Record<string, string> = {};
    if (voies && voies !== inc.voies) patch.voies = voies;
    if (km && km !== inc.km) patch.km = km;
    if (ac && ac !== inc.acLabel) patch.acLabel = ac;
    if (motif && motif !== inc.motif) patch.motif = motif;
    if (Object.keys(patch).length === 0) return;
    await patchJson(`/api/cil/${incidentId}`, patch);
  }

  async function submit() {
    setBusy(true);
    await rememberGeometry();
    let r;
    if (isProtection) {
      r = await postJson(`/api/cil/${incidentId}/protections`, {
        kind: isCirculation ? "CIRCULATION" : "ELECTRIQUE",
        interlocutor: cible,
        occurredAt: localInputToIso(occurredAt),
        texte,
        geometry: collectGeometry(),
        numeroRecu: numeroRecu.trim(),
        acLabel: isCirculation ? acLabel || null : null,
        // « Avis à (obligatoire) » aux autorités présentes — portés par le CRC.
        avisCosAt: cosPresent && avisCosAt ? localInputToIso(avisCosAt) : null,
        avisOpjAt: opjPresent && avisOpjAt ? localInputToIso(avisOpjAt) : null,
        numeroDonne: nextNum ?? undefined,
      });
    } else {
      r = await postJson(`/api/cil/${incidentId}/depeches`, {
        subtype,
        occurredAt: localInputToIso(occurredAt),
        texte,
        numeroRecu: numeroRecu || null,
        // Les heures et signatures d'autorisation sont reprises côté serveur
        // depuis les autorisations recueillies en amont.
        avisCrcAt: avisCrcAt ? localInputToIso(avisCrcAt) : null,
        geometry: collectGeometry(),
        numeroDonne: nextNum ?? undefined,
      });
    }
    setBusy(false);
    if (!r.ok) {
      toast.error(r.error!);
      return;
    }
    // Envoi à un AC : proposer la retransmission à l'AC encadrant. Cela vaut
    // pour la 2ᵉ dépêche d'une protection circulation ET pour les reprises,
    // qui s'adressent elles aussi à un AC (les rétablissements vont au RSS).
    if ((isProtection && cible === "AC") || isReprise) {
      setDemandeRetransmission(texte);
      return;
    }
    // Protection : s'il reste le second interlocuteur, on enchaîne dans la même
    // modale avec une heure et un numéro neufs, au lieu de refermer.
    if (isProtection && resteASuivre) {
      const suivant = cible === "CRC" ? (secondInterlocutor as "RSS" | "AC") : "CRC";
      toast.success(`Dépêche au ${cibleLabel} enregistrée — à transmettre au ${suivant === "CRC" ? "CRC de Lyon" : secondLabelFixed}`);
      setCible(suivant);
      setNumeroRecu("");
      setOccurredAt(nowLocalInput());
      // Le texte s'adresse au NOUVEL interlocuteur : on le régénère.
      setTexte(buildTextPour(suivant));
      setNextNum(
        randomAvailableNumber(NUMBER_RANGES.PROTECTION, [
          ...usedNums,
          ...(nextNum != null ? [nextNum] : []),
        ]),
      );
      onRefresh();
      return;
    }
    toast.success(isProtection ? `Dépêche au ${cibleLabel} enregistrée` : "Dépêche enregistrée");
    onDone();
  }

  const reserveOk = nextNum !== null;
  // Une dépêche sans n° reçu n'est pas collationnée : on ne la valide pas.
  const numeroRecuOk = numeroRecu.trim().length > 0;
  const canSubmit = reserveOk && authOk && numeroRecuOk;

  if (demandeRetransmission !== null) {
    const suivant = cible === "CRC" ? (secondInterlocutor as "RSS" | "AC") : "CRC";
    const continuerProtection = isProtection && resteASuivre;
    const poursuivre = () => {
      setDemandeRetransmission(null);
      if (!continuerProtection) {
        onDone();
        return;
      }
      setCible(suivant);
      setNumeroRecu("");
      setOccurredAt(nowLocalInput());
      setTexte(buildTextPour(suivant));
      setNextNum(
        randomAvailableNumber(NUMBER_RANGES.PROTECTION, [
          ...usedNums,
          ...(nextNum != null ? [nextNum] : []),
        ]),
      );
      onRefresh();
    };
    return (
      <Modal
        title="Retransmettre à un AC encadrant ?"
        icon={<Icon.MessageSquare className="w-4 h-4 text-rose-600" />}
        onClose={onClose}
        footer={
          <>
            <button
              onClick={poursuivre}
              className="text-sm text-slate-600 px-4 py-2 rounded-lg hover:bg-slate-100"
            >
              Non
            </button>
            <BtnPrimary
              onClick={() => {
                const t = demandeRetransmission;
                setDemandeRetransmission(null);
                onTransmettre(t);
              }}
              label="Oui, retransmettre"
            />
          </>
        }
      >
        <p className="text-xs text-slate-600">
          La dépêche a été transmise à l&apos;
          <span className="font-semibold">{labelDestinataire("AC")}</span>.
          Doit-elle être retransmise à un AC encadrant ?
        </p>
        <p className="text-[11px] text-slate-500">
          « Oui » ouvre une dépêche libre avec ce texte pré-rempli : elle prendra
          un n° de la plage 50-69 et apparaîtra au carnet d&apos;enregistrement.
        </p>
        {continuerProtection && (
          <p className="text-[11px] text-amber-800 bg-amber-50 border border-amber-200 rounded px-2 py-1">
            Il restera ensuite à transmettre au{" "}
            {suivant === "CRC" ? "CRC de Lyon" : secondLabelFixed}.
          </p>
        )}
      </Modal>
    );
  }

  return (
    <Modal
      title={DEPECHE_SUBTYPE_LABELS[subtype]}
      icon={<Icon.MessageSquare className="w-4 h-4 text-rose-600" />}
      onClose={onClose}
      footer={
        <>
          <BtnCancel onClose={onClose} />
          <BtnPrimary busy={busy} disabled={!canSubmit} onClick={submit} label={isProtection ? "Enregistrer la protection" : "Enregistrer la dépêche"} />
        </>
      }
    >
      <div className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
        {nextNum === null ? (
          <span className="text-rose-600 font-semibold">plage épuisée</span>
        ) : (
          <>
            {isProtection ? (
              <>
                Envoi au{" "}
                <span className="font-semibold text-slate-700">{cibleLabel}</span> —
                numéro réservé :{" "}
              </>
            ) : (
              "Numéro réservé : "
            )}
            <span className="font-mono font-bold text-rose-700">n° {nextNum}</span>
          </>
        )}
      </div>
      {isProtection && resteASuivre && (
        <p className="text-[11px] text-amber-800 bg-amber-50 border border-amber-200 rounded px-2 py-1">
          Cette protection se transmet en deux dépêches. Après celle-ci, il
          restera à transmettre au{" "}
          {cible === "CRC" ? secondLabelFixed : "CRC de Lyon"}.
        </p>
      )}

      {/* Éléments déjà saisis sur l'incident : rappelés, pas redemandés.
          Le crayon les déplie pour s'en écarter sur cette dépêche seulement. */}
      {geomComplete && !editGeom ? (
        <div className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 flex items-start gap-2">
          <div className="flex-1 space-y-0.5">
            {localisation && (
              <div>
                Localisation : <span className="font-semibold text-slate-700">{localisation}</span>
              </div>
            )}
            {voies && (
              <div>
                Voie(s) : <span className="font-semibold text-slate-700">{voies}</span>
                {km && (
                  <>
                    {" "}· km <span className="font-semibold text-slate-700">{km}</span>
                  </>
                )}
              </div>
            )}
            {ac && (
              <div>
                AC : <span className="font-semibold text-slate-700">{ac}</span>
              </div>
            )}
            {motif && (
              <div>
                Motif : <span className="font-semibold text-slate-700">{motif}</span>
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={() => setEditGeom(true)}
            className="text-slate-400 hover:text-rose-600 shrink-0"
            aria-label="Modifier ces éléments pour cette dépêche"
            title="Modifier pour cette dépêche"
          >
            <Icon.FileEdit className="w-4 h-4" />
          </button>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Voie(s)">
              <input value={voies} onChange={(e) => setVoies(e.target.value)} className={inputCls} />
            </Field>
            <Field label="Kilomètre">
              <input value={km} onChange={(e) => setKm(e.target.value)} className={inputCls} />
            </Field>
          </div>
          {isProtection && isCirculation && (
            <Field label="AC de (2ᵉ dépêche circulation)">
              <input value={acLabel} onChange={(e) => setAcLabel(e.target.value)} placeholder="Ex. AC de Givors" className={inputCls} />
            </Field>
          )}
          {isReprise && (
            <Field label="AC de (interlocuteur)">
              <input value={ac} onChange={(e) => setAc(e.target.value)} placeholder="Ex. AC de Givors" className={inputCls} />
            </Field>
          )}
          {/* Localisation : choisie une fois pour tout le livret (en-tête incident). */}
          <div className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
            Localisation :{" "}
            {localisation ? (
              <span className="font-semibold text-slate-700">{localisation}</span>
            ) : (
              <span className="text-amber-700">
                non renseignée — à compléter dans la fiche de l&apos;incident.
              </span>
            )}
          </div>
        </>
      )}
      {isCirculation && (
        <div className="grid grid-cols-1 gap-2">
          <Field label="Voies interdites à la circulation">
            <input value={voiesInterdites} onChange={(e) => setVoiesInterdites(e.target.value)} className={inputCls} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Voies en marche prudente">
              <input value={voiesPrudente} onChange={(e) => setVoiesPrudente(e.target.value)} className={inputCls} />
            </Field>
            <Field label="Voies en marche normale">
              <input value={voiesNormale} onChange={(e) => setVoiesNormale(e.target.value)} className={inputCls} />
            </Field>
          </div>
        </div>
      )}
      {isProtection && (!geomComplete || editGeom) && (
        <Field label="Motif">
          <input value={motif} onChange={(e) => setMotif(e.target.value)} className={inputCls} />
        </Field>
      )}

      <div className="flex items-center justify-between gap-2 flex-wrap">
        <label className={`${lblCls} mb-0`}>Texte de la dépêche</label>
        <button
          type="button"
          onClick={() => setTexte(buildText())}
          className="text-[11px] text-rose-600 hover:text-rose-800 whitespace-nowrap"
        >
          Régénérer
        </button>
      </div>
      <textarea value={texte} onChange={(e) => setTexte(e.target.value)} rows={5} className="input w-full min-h-[110px] text-xs" />

      <div className="grid grid-cols-2 gap-3">
        <TimeField label="Heure de la dépêche" value={occurredAt} onChange={setOccurredAt} />
        <Field label={`N° reçu du ${isProtection ? cibleLabel : "correspondant"} *`}>
          <input
            value={numeroRecu}
            onChange={(e) => setNumeroRecu(e.target.value)}
            className={`${inputCls} font-mono`}
          />
        </Field>
      </div>
      {!numeroRecuOk && (
        <p className="text-[11px] text-rose-700">
          Le n° reçu est obligatoire : notez celui que vous donne votre
          correspondant au collationnement.
        </p>
      )}
      {(isReprise || isRetab) && (cosPresent || opjPresent) && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3">
          <p className="text-xs font-semibold text-emerald-900 mb-1">
            Autorisations recueillies
          </p>
          <ul className="text-[11px] text-emerald-800 space-y-0.5">
            {(["COS", "OPJ"] as const)
              .filter((r) => (r === "COS" ? cosPresent : opjPresent))
              .map((r) => {
                const a = incident.autorisations.find(
                  (x) => x.subtype === subtype && x.role === r,
                );
                return (
                  <li key={r}>
                    {r} :{" "}
                    {a ? (
                      <>accord du {fmtDateTimeFr(a.grantedAt)}, signé</>
                    ) : (
                      <span className="text-rose-700">manquante</span>
                    )}
                  </li>
                );
              })}
          </ul>
        </div>
      )}

      {needsSignature && (
        <TimeField
          label="Avis au CRC de Lyon"
          value={avisCrcAt}
          onChange={setAvisCrcAt}
        />
      )}
    </Modal>
  );
}

// ─── Dépêche libre ────────────────────────────────────────────────────────────

function LibreModal({
  incident,
  prefillTexte,
  onClose,
  onDone,
}: {
  incident: CilIncidentFull;
  /** Texte repris d'une dépêche déjà passée (« Transmettre »), modifiable. */
  prefillTexte?: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const incidentId = incident.incident.id;
  const usedNums = incident.depeches.map((d) => d.numeroDonne);
  // Numéro tiré une fois à l'ouverture, puis envoyé au serveur.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const nextNum = useMemo(() => randomNumberForSubtype("LIBRE", usedNums), []);
  const [sens, setSens] = useState<"RECU" | "EXPEDIE">("EXPEDIE");
  const [occurredAt, setOccurredAt] = useState(nowLocalInput());
  const [texte, setTexte] = useState(prefillTexte ?? "");
  const [numeroRecu, setNumeroRecu] = useState("");
  const [dests, setDests] = useState<{ label: string; numeroRecu: string }[]>([{ label: "", numeroRecu: "" }]);
  const [busy, setBusy] = useState(false);
  /**
   * L'en-tête (« M. … CIL, à <destinataires> : ») suit les destinataires saisis
   * TANT QUE l'utilisateur ne l'a pas retouché : une dépêche libre reste un
   * texte libre, on ne veut pas écraser une correction volontaire.
   */
  const [enteteAuto, setEnteteAuto] = useState(true);
  const cilName = [incident.incident.cilNom, incident.incident.cilPrenom]
    .filter(Boolean)
    .join(" ");

  /** Remplace la 1ʳᵉ ligne par l'en-tête correspondant aux destinataires. */
  function texteAvecEntete(
    base: string,
    labels: string[],
    sensCourant: "RECU" | "EXPEDIE",
  ): string {
    // « Reçu de » : c'est l'interlocuteur qui s'adresse au CIL, pas l'inverse.
    if (sensCourant !== "EXPEDIE") return base;
    const cibles = labels.map((l) => l.trim()).filter(Boolean);
    if (!cibles.length) return base;
    const entete = `M. ${cilName}, CIL, à ${cibles.join(", ")} :`;
    const lignes = base.split("\n");
    if (lignes.length && /^M\..*CIL,.*:\s*$/.test(lignes[0])) {
      lignes[0] = entete;
      return lignes.join("\n");
    }
    return [entete, ...lignes].join("\n");
  }

  /** Applique l'en-tête après modification des destinataires ou du sens. */
  function majEntete(
    nouveauxDests: { label: string; numeroRecu: string }[],
    sensCourant: "RECU" | "EXPEDIE" = sens,
  ) {
    if (!enteteAuto) return;
    setTexte((t) => texteAvecEntete(t, nouveauxDests.map((d) => d.label), sensCourant));
  }

  async function submit() {
    setBusy(true);
    const destinataires = dests
      .filter((d) => d.label.trim())
      .map((d) => ({ label: d.label.trim(), numeroRecu: d.numeroRecu || null }));
    const r = await postJson(`/api/cil/${incidentId}/depeches`, {
      subtype: "LIBRE",
      sens,
      occurredAt: localInputToIso(occurredAt),
      texte,
      numeroRecu: numeroRecu || null,
      destinataires: destinataires.length ? destinataires : undefined,
      numeroDonne: nextNum ?? undefined,
    });
    setBusy(false);
    if (r.ok) {
      toast.success(`Dépêche libre n° ${nextNum} enregistrée`);
      onDone();
    } else toast.error(r.error!);
  }

  return (
    <Modal
      title="Dépêche libre"
      icon={<Icon.Book className="w-4 h-4 text-rose-600" />}
      onClose={onClose}
      footer={
        <>
          <BtnCancel onClose={onClose} />
          <BtnPrimary busy={busy} disabled={nextNum === null} onClick={submit} label="Enregistrer" />
        </>
      }
    >
      <div className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
        Numéro réservé :{" "}
        {nextNum === null ? (
          <span className="text-rose-600 font-semibold">plage épuisée</span>
        ) : (
          <span className="font-mono font-bold text-rose-700">n° {nextNum}</span>
        )}
      </div>
      <Field label="Sens">
        <div className="flex gap-2">
          {(["EXPEDIE", "RECU"] as const).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => {
                setSens(s);
                majEntete(dests, s);
              }}
              className={`text-sm px-3 py-1.5 rounded-lg border ${
                sens === s ? "bg-rose-600 text-white border-rose-600" : "bg-white text-slate-600 border-slate-200"
              }`}
            >
              {s === "EXPEDIE" ? "Expédié à" : "Reçu de"}
            </button>
          ))}
        </div>
      </Field>
      <TimeField label="Heure" value={occurredAt} onChange={setOccurredAt} />
      <Field label="Texte">
        <textarea
          value={texte}
          onChange={(e) => {
            setEnteteAuto(false);
            setTexte(e.target.value);
          }}
          rows={3}
          className="input w-full min-h-[80px] text-xs"
        />
      </Field>
      <div>
        <label className={lblCls}>{sens === "EXPEDIE" ? "Destinataires" : "Expéditeur(s)"}</label>
        <div className="space-y-2">
          {dests.map((dst, i) => (
            // Grille explicite : en flex, le `w-full` de `.input` écrasait le
            // champ interlocuteur (devenu illisible) au profit du n° reçu.
            <div
              key={i}
              className="grid grid-cols-[minmax(0,1fr)_5.5rem_auto] gap-2 items-center"
            >
              <input
                value={dst.label}
                onChange={(e) =>
                  setDests((a) => {
                    const suite = a.map((x, j) =>
                      j === i ? { ...x, label: e.target.value } : x,
                    );
                    majEntete(suite);
                    return suite;
                  })
                }
                placeholder={sens === "EXPEDIE" ? "CCR, EF, Infrapôle…" : "Émetteur"}
                className="input w-full min-w-0"
              />
              <input
                value={dst.numeroRecu}
                onChange={(e) =>
                  setDests((a) => a.map((x, j) => (j === i ? { ...x, numeroRecu: e.target.value } : x)))
                }
                placeholder="N° reçu"
                className="input w-full min-w-0 font-mono"
              />
              {dests.length > 1 ? (
                <button
                  onClick={() =>
                    setDests((a) => {
                      const suite = a.filter((_, j) => j !== i);
                      majEntete(suite);
                      return suite;
                    })
                  }
                  className="text-slate-400 hover:text-rose-600 px-1"
                  aria-label="Retirer"
                >
                  <Icon.Trash className="w-4 h-4" />
                </button>
              ) : (
                <span />
              )}
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={() => setDests((a) => [...a, { label: "", numeroRecu: "" }])}
          className="mt-2 text-[11px] text-rose-600 hover:text-rose-800 inline-flex items-center gap-1"
        >
          <Icon.Plus className="w-3 h-3" /> Ajouter un destinataire
        </button>
        <p className="mt-1 text-[10px] text-slate-400">
          Le livret crée automatiquement une ligne par destinataire.
        </p>
      </div>
    </Modal>
  );
}

// ─── Intervenant ──────────────────────────────────────────────────────────────

function IntervenantModal({ incidentId, onClose, onDone }: { incidentId: string; onClose: () => void; onDone: () => void }) {
  const [type, setType] = useState<IntervenantType>("COS");
  const [typeLibre, setTypeLibre] = useState("");
  const [nom, setNom] = useState("");
  const [tel, setTel] = useState("");
  const [arrivedAt, setArrivedAt] = useState("");
  const [departedAt, setDepartedAt] = useState("");
  const [busy, setBusy] = useState(false);
  const pfDepartRequired = type === "POMPES_FUNEBRES";
  const valid = !pfDepartRequired || !!departedAt;

  async function submit() {
    if (!valid) return;
    setBusy(true);
    const r = await postJson(`/api/cil/${incidentId}/intervenants`, {
      type,
      typeLibre: type === "AUTRE" ? typeLibre || null : null,
      nom: nom || null,
      tel: tel || null,
      arrivedAt: arrivedAt ? localInputToIso(arrivedAt) : null,
      departedAt: departedAt ? localInputToIso(departedAt) : null,
    });
    setBusy(false);
    if (r.ok) {
      toast.success("Intervenant enregistré");
      onDone();
    } else toast.error(r.error!);
  }

  return (
    <Modal
      title="Ajouter un intervenant"
      icon={<Icon.Users className="w-4 h-4 text-rose-600" />}
      onClose={onClose}
      footer={
        <>
          <BtnCancel onClose={onClose} />
          <BtnPrimary busy={busy} disabled={!valid} onClick={submit} label="Enregistrer" />
        </>
      }
    >
      <Field label="Type">
        <select value={type} onChange={(e) => setType(e.target.value as IntervenantType)} className={inputCls}>
          {INTERVENANT_TYPES.map((t) => (
            <option key={t} value={t}>
              {INTERVENANT_TYPE_LABELS[t]}
            </option>
          ))}
        </select>
      </Field>
      {type === "AUTRE" && (
        <Field label="Préciser">
          <input value={typeLibre} onChange={(e) => setTypeLibre(e.target.value)} className={inputCls} />
        </Field>
      )}
      <div className="grid grid-cols-2 gap-3">
        <Field label="Nom">
          <input value={nom} onChange={(e) => setNom(e.target.value)} className={inputCls} />
        </Field>
        <Field label="Téléphone">
          <input value={tel} onChange={(e) => setTel(e.target.value)} className={`${inputCls} font-mono`} />
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <TimeField label="Heure d'arrivée" value={arrivedAt} onChange={setArrivedAt} />
        <Field label={`Heure de départ${pfDepartRequired ? " *" : ""}`}>
          <TimeField value={departedAt} onChange={setDepartedAt} />
        </Field>
      </div>
      {pfDepartRequired && (
        <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1">
          L&apos;heure de départ est obligatoire pour les Pompes Funèbres.
        </p>
      )}
    </Modal>
  );
}

// ─── Changement de CIL ────────────────────────────────────────────────────────

function ChangementCilModal({ incidentId, onClose, onDone }: { incidentId: string; onClose: () => void; onDone: () => void }) {
  const [remplacant, setRemplacant] = useState("");
  const [at, setAt] = useState(nowLocalInput());
  const [busy, setBusy] = useState(false);
  async function submit() {
    setBusy(true);
    const r = await postJson(`/api/cil/${incidentId}/events`, {
      type: "CHANGEMENT_CIL",
      occurredAt: localInputToIso(at),
      remplacant: remplacant || null,
    });
    setBusy(false);
    if (r.ok) {
      toast.success("Changement de CIL enregistré");
      onDone();
    } else toast.error(r.error!);
  }
  return (
    <Modal
      title="Changement de CIL"
      icon={<Icon.User className="w-4 h-4 text-rose-600" />}
      onClose={onClose}
      footer={
        <>
          <BtnCancel onClose={onClose} />
          <BtnPrimary busy={busy} onClick={submit} label="Enregistrer" />
        </>
      }
    >
      <Field label="Remplacé par">
        <input value={remplacant} onChange={(e) => setRemplacant(e.target.value)} placeholder="Nom du nouveau CIL" className={inputCls} />
      </Field>
      <TimeField label="Heure" value={at} onChange={setAt} />
    </Modal>
  );
}

// ─── Note ─────────────────────────────────────────────────────────────────────

function NoteModal({ incidentId, onClose, onDone }: { incidentId: string; onClose: () => void; onDone: () => void }) {
  const [note, setNote] = useState("");
  const [at, setAt] = useState(nowLocalInput());
  const [busy, setBusy] = useState(false);
  async function submit() {
    if (!note.trim()) return;
    setBusy(true);
    const r = await postJson(`/api/cil/${incidentId}/events`, {
      type: "NOTE",
      occurredAt: localInputToIso(at),
      label: note.trim().slice(0, 120),
      note: note.trim(),
    });
    setBusy(false);
    if (r.ok) {
      toast.success("Note ajoutée");
      onDone();
    } else toast.error(r.error!);
  }
  return (
    <Modal
      title="Ajouter une note"
      icon={<Icon.MessageSquare className="w-4 h-4 text-rose-600" />}
      onClose={onClose}
      footer={
        <>
          <BtnCancel onClose={onClose} />
          <BtnPrimary busy={busy} disabled={!note.trim()} onClick={submit} label="Ajouter" />
        </>
      }
    >
      <Field label="Note">
        <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} autoFocus className="input w-full min-h-[80px]" />
      </Field>
      <TimeField label="Heure" value={at} onChange={setAt} />
    </Modal>
  );
}

// ─── Clôture ──────────────────────────────────────────────────────────────────

function CloseModal({ incidentId, onClose, onDone }: { incidentId: string; onClose: () => void; onDone: () => void }) {
  const [at, setAt] = useState(nowLocalInput());
  const [busy, setBusy] = useState(false);
  async function submit() {
    setBusy(true);
    const r = await patchJson(`/api/cil/${incidentId}`, { action: "close", at: localInputToIso(at) });
    setBusy(false);
    if (r.ok) {
      toast.success("Incident clôturé");
      onDone();
    } else toast.error(r.error!);
  }
  return (
    <Modal
      title="Clôturer l'incident"
      icon={<Icon.Check className="w-4 h-4 text-emerald-600" />}
      onClose={onClose}
      footer={
        <>
          <BtnCancel onClose={onClose} />
          <button
            onClick={submit}
            disabled={busy}
            className="text-sm font-semibold bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg"
          >
            {busy ? "Clôture…" : "Clôturer"}
          </button>
        </>
      }
    >
      <p className="text-xs text-slate-600">
        La clôture verrouille l&apos;incident en lecture seule. Vous pourrez ensuite générer le livret PDF.
      </p>
      <TimeField label="Heure de clôture" value={at} onChange={setAt} />
    </Modal>
  );
}

// ─── Édition de l'heure d'un événement (frise) ────────────────────────────────

export function EditEventModal({
  incidentId,
  event,
  onClose,
  onDone,
}: {
  incidentId: string;
  event: { id: string; occurredAt: string; label: string; note: string | null; type: string };
  onClose: () => void;
  onDone: () => void;
}) {
  const [at, setAt] = useState(isoLocal(event.occurredAt));
  const [note, setNote] = useState(event.note ?? "");
  const [busy, setBusy] = useState(false);
  async function submit() {
    setBusy(true);
    const r = await patchJson(`/api/cil/${incidentId}/events/${event.id}`, {
      occurredAt: localInputToIso(at),
      note: note || null,
    });
    setBusy(false);
    if (r.ok) {
      toast.success("Événement corrigé");
      onDone();
      onClose();
    } else toast.error(r.error!);
  }
  return (
    <Modal
      title="Corriger l'événement"
      icon={<Icon.FileEdit className="w-4 h-4 text-rose-600" />}
      onClose={onClose}
      footer={
        <>
          <BtnCancel onClose={onClose} />
          <BtnPrimary busy={busy} onClick={submit} label="Enregistrer" />
        </>
      }
    >
      <p className="text-xs text-slate-500">{event.label}</p>
      <TimeField label="Heure" value={at} onChange={setAt} />
      <Field label="Note">
        <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} className="input w-full min-h-[60px]" />
      </Field>
    </Modal>
  );
}

function isoLocal(iso: string): string {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

// ─── Boutons partagés ─────────────────────────────────────────────────────────

function BtnCancel({ onClose }: { onClose: () => void }) {
  return (
    <button onClick={onClose} className="text-sm text-slate-600 px-4 py-2 rounded-lg hover:bg-slate-100">
      Annuler
    </button>
  );
}
function BtnPrimary({
  busy,
  disabled,
  onClick,
  label,
}: {
  /** Enregistrement en cours : le libellé devient « … ». */
  busy?: boolean;
  /** Formulaire incomplet : bouton grisé mais libellé CONSERVÉ (sinon on ne
   *  sait plus ce que fait le bouton). */
  disabled?: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      disabled={busy || disabled}
      className="text-sm font-semibold bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg"
    >
      {busy ? "…" : label}
    </button>
  );
}
