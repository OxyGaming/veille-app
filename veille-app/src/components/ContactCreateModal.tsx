"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Icon } from "@/components/icons";
import {
  ContactForm,
  blankContactForm,
  isContactFormValid,
  type ContactFormValues,
} from "@/components/ContactForm";

type CreatedContact = {
  id: string;
  name: string;
  role: string | null;
  phone: string | null;
  email: string | null;
  notes: string | null;
  teamId: string | null;
};

/**
 * Modale "Ajouter un contact" — front-office. POST `/api/contacts` (création
 * seule, restreinte aux équipes de l'utilisateur — cf. src/lib/contacts.ts).
 * Style cohérent avec les autres modales de saisie rapide (`NoteModal`).
 */
export default function ContactCreateModal({
  teams,
  lockedTeamId,
  onClose,
  onCreated,
}: {
  teams: { id: string; name: string }[];
  lockedTeamId: string | null;
  onClose: () => void;
  onCreated: (contact: CreatedContact) => void;
}) {
  const [form, setForm] = useState<ContactFormValues>(
    blankContactForm(lockedTeamId ?? teams[0]?.id ?? null),
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const valid = isContactFormValid(form) && !!form.teamId;

  async function submit() {
    if (!valid || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/contacts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          role: form.role || null,
          phone: form.phone || null,
          email: form.email || null,
          notes: form.notes || null,
          teamId: form.teamId,
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setError(j.error || "Impossible de créer le contact.");
        return;
      }
      const contact: CreatedContact = await res.json();
      toast.success("Contact ajouté");
      onCreated(contact);
    } catch {
      setError("Erreur réseau — réessayez.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div
        className="fixed inset-0 bg-slate-900/40 z-50 backdrop-blur-[1px]"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Ajouter un contact"
        className="fixed inset-x-0 bottom-0 md:bottom-auto md:top-1/2 md:left-1/2 md:-translate-x-1/2 md:-translate-y-1/2 md:max-w-lg md:w-full z-50 bg-white rounded-t-2xl md:rounded-2xl shadow-2xl border border-slate-200 overflow-hidden max-h-[90vh] flex flex-col"
      >
        <header className="px-4 py-3 border-b border-slate-200 flex items-center gap-2 shrink-0">
          <Icon.Users className="w-4 h-4 text-indigo-600" />
          <h3 className="font-bold text-sm flex-1">Ajouter un contact</h3>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600"
            aria-label="Fermer"
          >
            <Icon.X className="w-5 h-5" />
          </button>
        </header>

        <div className="p-4 space-y-3 overflow-auto">
          <ContactForm
            value={form}
            onChange={setForm}
            teams={teams}
            showNoTeamOption={false}
            lockedTeamId={lockedTeamId}
          />

          {error && (
            <div className="text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2 flex items-start gap-2">
              <Icon.AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              {error}
            </div>
          )}
        </div>

        <footer className="px-4 py-3 border-t border-slate-100 flex justify-end gap-2 shrink-0">
          <button
            onClick={onClose}
            className="text-sm text-slate-600 px-4 py-2 rounded-lg hover:bg-slate-100"
          >
            Annuler
          </button>
          <button
            onClick={submit}
            disabled={!valid || busy}
            className="btn btn-primary"
          >
            {busy ? "Création…" : "Créer"}
          </button>
        </footer>
      </div>
    </>
  );
}
