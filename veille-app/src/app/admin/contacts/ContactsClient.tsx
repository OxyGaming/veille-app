"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Icon } from "@/components/icons";
import { matchesQuery } from "@/components/SearchInput";
import { useConfirmDialog } from "@/components/ConfirmDialog";
import {
  ContactForm,
  isContactFormValid,
  type ContactFormValues,
} from "@/components/ContactForm";

type Contact = {
  id: string;
  name: string;
  role: string | null;
  phone: string | null;
  email: string | null;
  notes: string | null;
  teamId: string | null;
};

function blank(): Contact {
  return {
    id: "",
    name: "",
    role: "",
    phone: "",
    email: "",
    notes: "",
    teamId: null,
  };
}

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export default function ContactsClient({
  initial,
  teams,
}: {
  initial: Contact[];
  teams: { id: string; name: string }[];
}) {
  const { dialog, ask } = useConfirmDialog();
  const [contacts, setContacts] = useState(initial);
  const [editing, setEditing] = useState<Contact | null>(null);
  const [q, setQ] = useState("");

  const teamById = useMemo(
    () => new Map(teams.map((t) => [t.id, t.name])),
    [teams]
  );

  const filtered = useMemo(() => {
    if (!q.trim()) return contacts;
    return contacts.filter((c) =>
      matchesQuery(
        q,
        `${c.name} ${c.role ?? ""} ${c.phone ?? ""} ${c.email ?? ""} ${
          teamById.get(c.teamId ?? "") ?? ""
        }`
      )
    );
  }, [contacts, q, teamById]);

  async function save(c: Contact) {
    const res = await fetch("/api/admin/contacts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...c, id: c.id || undefined }),
    });
    if (!res.ok) return;
    const saved = await res.json();
    setContacts((arr) => {
      const i = arr.findIndex((x) => x.id === saved.id);
      if (i >= 0) {
        const copy = [...arr];
        copy[i] = saved;
        return copy;
      }
      return [...arr, saved].sort((a, b) => a.name.localeCompare(b.name));
    });
    setEditing(null);
  }

  async function remove(c: Contact) {
    const ok = await ask({
      title: `Supprimer le contact « ${c.name} » ?`,
      description: "Cette action est irréversible.",
      confirmLabel: "Supprimer",
      tone: "danger",
    });
    if (!ok) return;
    const res = await fetch(`/api/admin/contacts?id=${c.id}`, {
      method: "DELETE",
    });
    if (res.ok) {
      setContacts((arr) => arr.filter((x) => x.id !== c.id));
      toast.success("Contact supprimé");
    } else {
      toast.error("Impossible de supprimer le contact");
    }
  }

  return (
    <div>
      {dialog}
      <div className="mb-4">
        <h1 className="text-2xl font-bold">Contacts</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Carnet d&apos;adresses partagé — DPX, RSST, COSEC, astreintes…
        </p>
      </div>

      <section className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        <header className="px-5 py-4 border-b border-slate-100 flex items-center gap-3 flex-wrap">
          <div>
            <h2 className="font-bold">Carnet</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {contacts.length} contact{contacts.length > 1 ? "s" : ""}
              {q.trim() && contacts.length !== filtered.length && (
                <> · {filtered.length} affiché(s)</>
              )}
            </p>
          </div>
          <div className="relative flex-1 max-w-sm ml-auto order-3 md:order-2 w-full md:w-auto">
            <Icon.Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Rechercher…"
              className="w-full border border-slate-200 focus:border-indigo-500 rounded-lg pl-9 pr-3 py-2 text-sm outline-none"
            />
          </div>
          <button
            onClick={() => setEditing(blank())}
            className="inline-flex items-center gap-1.5 text-sm font-semibold bg-slate-900 hover:bg-slate-800 text-white px-3 py-2 rounded-lg order-2 md:order-3"
          >
            <Icon.Plus className="w-4 h-4" /> Ajouter
          </button>
        </header>

        <ul className="divide-y divide-slate-100">
          {filtered.map((c) => (
            <li
              key={c.id}
              className="px-5 py-3 flex items-center gap-3 hover:bg-slate-50/60"
            >
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-indigo-700 text-white font-semibold grid place-items-center shrink-0 shadow-sm">
                {initialsOf(c.name)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-slate-900 truncate">
                  {c.name}
                </div>
                <div className="text-[11px] text-slate-500 truncate">
                  {c.role}
                  {c.role && c.teamId && " · "}
                  {c.teamId && (
                    <span className="font-mono">
                      {teamById.get(c.teamId) ?? "—"}
                    </span>
                  )}
                </div>
              </div>
              <div className="hidden md:flex flex-col items-end text-[11px] font-mono text-slate-500 max-w-[200px]">
                {c.phone && (
                  <a
                    href={`tel:${c.phone}`}
                    className="hover:text-emerald-700 truncate"
                  >
                    {c.phone}
                  </a>
                )}
                {c.email && (
                  <a
                    href={`mailto:${c.email}`}
                    className="hover:text-indigo-700 truncate"
                  >
                    {c.email}
                  </a>
                )}
              </div>
              <button
                onClick={() => setEditing(c)}
                className="text-xs text-slate-500 hover:text-indigo-700 px-2 py-1 rounded hover:bg-indigo-50"
              >
                Modifier
              </button>
              <button
                onClick={() => remove(c)}
                className="text-rose-500 hover:text-rose-700 p-1 rounded hover:bg-rose-50"
                title="Supprimer"
              >
                <Icon.Trash className="w-4 h-4" />
              </button>
            </li>
          ))}
          {!filtered.length && (
            <li className="px-5 py-10 text-center text-sm text-slate-500">
              {contacts.length === 0
                ? "Aucun contact — cliquez « Ajouter »."
                : "Aucun contact ne correspond à votre recherche."}
            </li>
          )}
        </ul>
      </section>

      {editing && (
        <ContactModal
          initial={editing}
          teams={teams}
          onCancel={() => setEditing(null)}
          onSave={save}
        />
      )}
    </div>
  );
}

/* ============================================================================
 *  Modale contact
 * ========================================================================== */

function toFormValues(c: Contact): ContactFormValues {
  return {
    name: c.name,
    role: c.role ?? "",
    phone: c.phone ?? "",
    email: c.email ?? "",
    notes: c.notes ?? "",
    teamId: c.teamId,
  };
}

function ContactModal({
  initial,
  teams,
  onCancel,
  onSave,
}: {
  initial: Contact;
  teams: { id: string; name: string }[];
  onCancel: () => void;
  onSave: (c: Contact) => void;
}) {
  const [form, setForm] = useState<ContactFormValues>(toFormValues(initial));
  const valid = isContactFormValid(form);
  return (
    <>
      <div
        className="fixed inset-0 bg-slate-900/50 z-40"
        onClick={onCancel}
      />
      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg max-h-[90vh] overflow-auto">
        <header className="px-5 py-4 border-b border-slate-100 flex items-center">
          <h3 className="font-bold">
            {initial.id ? "Modifier le contact" : "Nouveau contact"}
          </h3>
          <button
            onClick={onCancel}
            className="ml-auto text-slate-400 hover:text-slate-700"
          >
            <Icon.X className="w-5 h-5" />
          </button>
        </header>

        <div className="p-5 space-y-4">
          {/* Aperçu */}
          <div className="flex items-center gap-3 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5">
            <div className="w-11 h-11 rounded-full bg-gradient-to-br from-indigo-500 to-indigo-700 text-white font-semibold grid place-items-center shrink-0 shadow-sm">
              {initialsOf(form.name || "?")}
            </div>
            <div className="min-w-0">
              <div className="text-sm font-bold truncate">
                {form.name || "Nouveau contact"}
              </div>
              <div className="text-[11px] text-slate-500 truncate">
                {form.role || "—"}
              </div>
            </div>
          </div>

          <ContactForm value={form} onChange={setForm} teams={teams} />
        </div>

        <footer className="px-5 py-3 border-t border-slate-100 flex justify-end gap-2">
          <button
            onClick={onCancel}
            className="text-sm px-3 py-2 rounded-lg border border-slate-200 hover:bg-slate-50"
          >
            Annuler
          </button>
          <button
            onClick={() =>
              valid &&
              onSave({
                id: initial.id,
                name: form.name,
                role: form.role || null,
                phone: form.phone || null,
                email: form.email || null,
                notes: form.notes || null,
                teamId: form.teamId,
              })
            }
            disabled={!valid}
            className="text-sm font-semibold bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg"
          >
            {initial.id ? "Enregistrer" : "Créer"}
          </button>
        </footer>
      </div>
    </>
  );
}
