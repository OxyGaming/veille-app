"use client";

/**
 * Champs de formulaire contact — mutualisés entre la modale back-office
 * (`admin/contacts/ContactsClient.tsx`) et la modale front-office
 * (`ContactCreateModal.tsx`). Le modèle Prisma `Contact` n'a que ces champs
 * (`name` = nom complet, pas de split prénom/nom ; pas de champ `site`).
 */
export type ContactFormValues = {
  name: string;
  role: string;
  phone: string;
  email: string;
  notes: string;
  teamId: string | null;
};

export function blankContactForm(
  defaultTeamId: string | null = null,
): ContactFormValues {
  return {
    name: "",
    role: "",
    phone: "",
    email: "",
    notes: "",
    teamId: defaultTeamId,
  };
}

export function isContactFormValid(v: ContactFormValues): boolean {
  return v.name.trim().length > 0;
}

export function ContactForm({
  value,
  onChange,
  teams,
  showNoTeamOption = true,
  lockedTeamId,
}: {
  value: ContactFormValues;
  onChange: (v: ContactFormValues) => void;
  teams: { id: string; name: string }[];
  /** Autorise "— Aucune —" (contact commun) — ADMIN/EDITOR uniquement. */
  showNoTeamOption?: boolean;
  /** Mono-équipe : équipe imposée et masquée (pas de sélecteur affiché). */
  lockedTeamId?: string | null;
}) {
  const lockedTeamName = lockedTeamId
    ? teams.find((t) => t.id === lockedTeamId)?.name
    : undefined;

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-xs font-semibold text-slate-700 mb-1">
          Nom <span className="text-rose-600">*</span>
        </label>
        <input
          autoFocus
          value={value.name}
          onChange={(e) => onChange({ ...value, name: e.target.value })}
          placeholder="Prénom Nom"
          className="w-full border-2 border-indigo-200 focus:border-indigo-500 rounded-lg px-3 py-2 text-sm outline-none"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            Rôle
          </label>
          <input
            value={value.role}
            onChange={(e) => onChange({ ...value, role: e.target.value })}
            placeholder="DPX, RSST, COSEC…"
            className="w-full border border-slate-200 focus:border-indigo-500 rounded-lg px-3 py-2 text-sm outline-none"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            Équipe
          </label>
          {lockedTeamId ? (
            <div className="w-full border border-slate-100 bg-slate-50 rounded-lg px-3 py-2 text-sm text-slate-600">
              {lockedTeamName ?? "—"}
            </div>
          ) : (
            <select
              value={value.teamId ?? ""}
              onChange={(e) =>
                onChange({ ...value, teamId: e.target.value || null })
              }
              className="w-full border border-slate-200 focus:border-indigo-500 rounded-lg px-3 py-2 text-sm outline-none"
            >
              {showNoTeamOption && <option value="">— Aucune —</option>}
              {teams.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          )}
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            Téléphone
          </label>
          <input
            value={value.phone}
            onChange={(e) => onChange({ ...value, phone: e.target.value })}
            placeholder="06 12 34 56 78"
            className="w-full border border-slate-200 focus:border-indigo-500 rounded-lg px-3 py-2 text-sm outline-none font-mono"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            Email
          </label>
          <input
            type="email"
            value={value.email}
            onChange={(e) => onChange({ ...value, email: e.target.value })}
            placeholder="prenom.nom@sncf.fr"
            className="w-full border border-slate-200 focus:border-indigo-500 rounded-lg px-3 py-2 text-sm outline-none font-mono"
          />
        </div>
      </div>

      <div>
        <label className="block text-xs font-semibold text-slate-700 mb-1">
          Notes
        </label>
        <textarea
          value={value.notes}
          onChange={(e) => onChange({ ...value, notes: e.target.value })}
          placeholder="Astreinte semaine impaire, joindre sur Mattermost…"
          className="w-full border border-slate-200 focus:border-indigo-500 rounded-lg px-3 py-2 text-sm outline-none min-h-[80px] resize-y"
        />
      </div>
    </div>
  );
}
