"use client";

import { useMemo, useState } from "react";
import { Icon } from "@/components/icons";
import { matchesQuery } from "@/components/SearchInput";
import ContactCreateModal from "@/components/ContactCreateModal";

type Contact = {
  id: string;
  name: string;
  role: string | null;
  phone: string | null;
  email: string | null;
  notes: string | null;
  teamId: string | null;
  teamName: string | null;
};

/**
 * Palette stable pour les avatars : on hash le nom et on prend une couleur du
 * lot — deux personnes du même nom ont la même couleur, et la palette reste
 * cohérente d'un rechargement à l'autre.
 */
const AVATAR_PALETTE = [
  { bg: "from-indigo-500 to-indigo-700", text: "text-white" },
  { bg: "from-emerald-500 to-emerald-700", text: "text-white" },
  { bg: "from-amber-500 to-amber-700", text: "text-white" },
  { bg: "from-violet-500 to-violet-700", text: "text-white" },
  { bg: "from-sky-500 to-sky-700", text: "text-white" },
  { bg: "from-rose-500 to-rose-700", text: "text-white" },
  { bg: "from-cyan-500 to-cyan-700", text: "text-white" },
];

function paletteFor(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) {
    h = (h * 31 + name.charCodeAt(i)) | 0;
  }
  return AVATAR_PALETTE[Math.abs(h) % AVATAR_PALETTE.length];
}

function initialsOf(name: string): string {
  const parts = name
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (!parts.length) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export default function ContactsListClient({
  contacts: initialContacts,
  myTeams,
  lockedTeamId,
}: {
  contacts: Contact[];
  /** Équipes de l'utilisateur — proposées dans la modale "Ajouter un contact". */
  myTeams: { id: string; name: string }[];
  /** Mono-équipe : équipe imposée (pas de sélecteur dans la modale). */
  lockedTeamId: string | null;
}) {
  const [contacts, setContacts] = useState(initialContacts);
  const [q, setQ] = useState("");
  const [showCreate, setShowCreate] = useState(false);

  const teamById = useMemo(
    () => new Map(myTeams.map((t) => [t.id, t.name])),
    [myTeams],
  );

  const filtered = useMemo(() => {
    if (!q.trim()) return contacts;
    return contacts.filter((c) =>
      matchesQuery(
        q,
        `${c.name} ${c.role ?? ""} ${c.phone ?? ""} ${c.email ?? ""} ${c.teamName ?? ""}`
      )
    );
  }, [contacts, q]);

  // Groupage par équipe (les "sans équipe" tombent en dernier).
  const grouped = useMemo(() => {
    const groups = new Map<string, { name: string; items: Contact[] }>();
    for (const c of filtered) {
      const key = c.teamName ?? "__none__";
      const label = c.teamName ?? "Sans équipe";
      const g = groups.get(key) ?? { name: label, items: [] };
      g.items.push(c);
      groups.set(key, g);
    }
    return [...groups.entries()]
      .map(([key, g]) => ({ key, ...g }))
      .sort((a, b) => {
        if (a.key === "__none__") return 1;
        if (b.key === "__none__") return -1;
        return a.name.localeCompare(b.name);
      });
  }, [filtered]);

  return (
    <div className="pb-12">
      {/* Bannière hero — même langage que /links */}
      <header className="bg-gradient-to-br from-slate-900 to-indigo-900 text-white px-4 lg:px-8 py-6 lg:py-8 rounded-xl mx-4 lg:mx-8 mt-4 lg:mt-6">
        <div className="max-w-5xl mx-auto">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <h1 className="text-xl lg:text-2xl font-bold tracking-tight">
                Contacts
              </h1>
              <p className="text-sm text-indigo-200 mt-1">
                Carnet d&apos;adresses — DPX, RSST, COSEC, astreintes et utiles.
              </p>
            </div>
            {myTeams.length > 0 && (
              <button
                onClick={() => setShowCreate(true)}
                className="inline-flex items-center gap-1.5 text-sm font-semibold bg-white text-indigo-900 hover:bg-indigo-50 px-3 py-2 rounded-lg shrink-0"
              >
                <Icon.Plus className="w-4 h-4" />
                Ajouter un contact
              </button>
            )}
          </div>
          <div className="mt-4 relative">
            <Icon.Search className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Rechercher un contact (nom, rôle, équipe…)"
              className="w-full bg-white text-slate-900 placeholder-slate-400 rounded-lg pl-11 pr-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-white/30"
            />
            {q.trim() && (
              <div className="text-[11px] font-mono text-indigo-200 mt-2">
                {filtered.length} / {contacts.length} contacts
              </div>
            )}
          </div>
        </div>
      </header>

      <div className="px-4 lg:px-8 py-6 max-w-5xl mx-auto">
        {grouped.map((group) => (
          <section key={group.key} className="mb-7">
            <div className="flex items-center gap-3 mb-3">
              <div
                className={`w-9 h-9 rounded-lg grid place-items-center shrink-0 ${
                  group.key === "__none__"
                    ? "bg-slate-100 text-slate-500"
                    : "bg-indigo-100 text-indigo-700"
                }`}
              >
                <Icon.Users className="w-5 h-5" />
              </div>
              <h2 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-700">
                {group.name}
              </h2>
              <span className="ml-auto text-[10px] font-mono text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
                {group.items.length}
              </span>
            </div>
            <ul className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
              {group.items.map((c) => {
                const p = paletteFor(c.name);
                return (
                  <li key={c.id}>
                    <div className="bg-white border border-slate-200 rounded-xl p-4 hover:shadow-md transition-all">
                      <div className="flex items-start gap-3">
                        <div
                          className={`w-12 h-12 rounded-full bg-gradient-to-br ${p.bg} ${p.text} font-semibold grid place-items-center shrink-0 shadow-sm`}
                        >
                          {initialsOf(c.name)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-bold leading-tight truncate">
                            {c.name}
                          </div>
                          {c.role && (
                            <div className="text-[11px] text-slate-500 mt-0.5 truncate">
                              {c.role}
                            </div>
                          )}
                          {c.teamName && (
                            <div className="text-[10px] font-mono mt-1 inline-block bg-indigo-50 text-indigo-700 border border-indigo-100 px-1.5 py-0.5 rounded">
                              {c.teamName}
                            </div>
                          )}
                        </div>
                      </div>

                      {c.notes && (
                        <div className="text-[11px] text-slate-500 mt-3 italic line-clamp-2">
                          {c.notes}
                        </div>
                      )}

                      <div className="flex gap-2 mt-3">
                        {c.phone && (
                          <a
                            href={`tel:${c.phone}`}
                            className="flex-1 inline-flex items-center justify-center gap-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs font-semibold px-2.5 py-2 rounded-lg border border-emerald-200 transition-colors"
                            title={c.phone}
                          >
                            <Icon.Phone className="w-3.5 h-3.5" />
                            <span className="truncate">{c.phone}</span>
                          </a>
                        )}
                        {c.email && (
                          <a
                            href={`mailto:${c.email}`}
                            className="flex-1 inline-flex items-center justify-center gap-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-800 text-xs font-semibold px-2.5 py-2 rounded-lg border border-indigo-200 transition-colors overflow-hidden"
                            title={c.email}
                          >
                            <Icon.MessageSquare className="w-3.5 h-3.5 shrink-0" />
                            <span className="truncate">Email</span>
                          </a>
                        )}
                        {!c.phone && !c.email && (
                          <div className="flex-1 text-center text-[10px] text-slate-400 italic py-1.5">
                            Pas de coordonnées
                          </div>
                        )}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
        {!grouped.length && (
          <div className="text-center py-16 text-slate-500 text-sm">
            {contacts.length === 0
              ? "Aucun contact. Cliquez « Ajouter un contact »."
              : "Aucun contact ne correspond à votre recherche."}
          </div>
        )}
      </div>

      {showCreate && (
        <ContactCreateModal
          teams={myTeams}
          lockedTeamId={lockedTeamId}
          onClose={() => setShowCreate(false)}
          onCreated={(created) => {
            setContacts((prev) =>
              [
                ...prev,
                {
                  ...created,
                  teamName: created.teamId
                    ? teamById.get(created.teamId) ?? null
                    : null,
                },
              ].sort((a, b) => a.name.localeCompare(b.name)),
            );
            setShowCreate(false);
          }}
        />
      )}
    </div>
  );
}
