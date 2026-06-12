"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Item = {
  id?: string;
  label: string;
  gravity: number | null;
  requireCommentIfKO: boolean;
  requirePhotoIfKO: boolean;
};
type Proc = {
  id: string;
  domain: string;
  theme: string | null;
  title: string;
  gravity: number;
  documents: string[];
  risk: string | null;
  requireGeneralComment: boolean;
  items: Item[];
};

export default function ProcedureEditClient({ proc: initial }: { proc: Proc }) {
  const router = useRouter();
  const [proc, setProc] = useState(initial);
  const [saving, setSaving] = useState(false);

  function update(patch: Partial<Proc>) {
    setProc((p) => ({ ...p, ...patch }));
  }
  function updateItem(idx: number, patch: Partial<Item>) {
    setProc((p) => ({
      ...p,
      items: p.items.map((it, i) => (i === idx ? { ...it, ...patch } : it)),
    }));
  }
  function addItem() {
    setProc((p) => ({
      ...p,
      items: [
        ...p.items,
        {
          label: "Nouveau point",
          gravity: null,
          requireCommentIfKO: false,
          requirePhotoIfKO: false,
        },
      ],
    }));
  }
  function removeItem(idx: number) {
    setProc((p) => ({ ...p, items: p.items.filter((_, i) => i !== idx) }));
  }

  async function save() {
    setSaving(true);
    try {
      const res = await fetch(`/api/procedures/${proc.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          domain: proc.domain,
          theme: proc.theme,
          title: proc.title,
          gravity: proc.gravity,
          documents: proc.documents,
          risk: proc.risk,
          requireGeneralComment: proc.requireGeneralComment,
          items: proc.items,
        }),
      });
      if (!res.ok) {
        const j = await res.json();
        alert(j.error || "Erreur");
        return;
      }
      router.refresh();
      alert("Enregistré.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold">Modifier la procédure</h1>
        <button
          onClick={save}
          disabled={saving}
          className="bg-[var(--steel)] text-white font-semibold px-4 py-2 rounded-lg"
        >
          {saving ? "…" : "Enregistrer"}
        </button>
      </div>

      <div className="bg-white border border-[var(--line)] rounded-xl p-4 grid grid-cols-1 md:grid-cols-2 gap-3">
        <Field label="Domaine">
          <input
            value={proc.domain}
            onChange={(e) => update({ domain: e.target.value })}
            className="input"
          />
        </Field>
        <Field label="Thème">
          <input
            value={proc.theme ?? ""}
            onChange={(e) => update({ theme: e.target.value })}
            className="input"
          />
        </Field>
        <Field label="Titre" full>
          <input
            value={proc.title}
            onChange={(e) => update({ title: e.target.value })}
            className="input"
          />
        </Field>
        <Field label="Gravité (0..4)">
          <input
            type="number"
            min={0}
            max={4}
            value={proc.gravity}
            onChange={(e) => update({ gravity: Number(e.target.value) })}
            className="input"
          />
        </Field>
        <Field label="Documents (séparés par virgule)" full>
          <input
            value={proc.documents.join(", ")}
            onChange={(e) =>
              update({
                documents: e.target.value
                  .split(",")
                  .map((s) => s.trim())
                  .filter(Boolean),
              })
            }
            className="input"
          />
        </Field>
        <Field label="Risque associé" full>
          <textarea
            value={proc.risk ?? ""}
            onChange={(e) => update({ risk: e.target.value })}
            className="input min-h-[80px]"
          />
        </Field>
        <label className="flex items-center gap-2 col-span-full text-sm">
          <input
            type="checkbox"
            checked={proc.requireGeneralComment}
            onChange={(e) => update({ requireGeneralComment: e.target.checked })}
          />
          Commentaire général obligatoire à la clôture
        </label>
      </div>

      <h2 className="text-lg font-bold mt-6 mb-2">Points de checklist</h2>
      <ul className="grid gap-2">
        {proc.items.map((it, idx) => (
          <li
            key={it.id ?? `new-${idx}`}
            className="bg-white border border-[var(--line)] rounded-xl p-3"
          >
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs font-mono text-[var(--muted)]">
                #{idx + 1}
              </span>
              <button
                onClick={() => removeItem(idx)}
                className="ml-auto text-xs text-red-700"
              >
                Supprimer
              </button>
            </div>
            <input
              value={it.label}
              onChange={(e) => updateItem(idx, { label: e.target.value })}
              className="input w-full mb-2"
            />
            <div className="flex flex-wrap gap-3 items-center text-sm">
              <label className="flex items-center gap-1">
                Gravité
                <input
                  type="number"
                  min={0}
                  max={4}
                  value={it.gravity ?? ""}
                  onChange={(e) =>
                    updateItem(idx, {
                      gravity:
                        e.target.value === "" ? null : Number(e.target.value),
                    })
                  }
                  className="input w-16"
                />
              </label>
              <label className="flex items-center gap-1">
                <input
                  type="checkbox"
                  checked={it.requireCommentIfKO}
                  onChange={(e) =>
                    updateItem(idx, { requireCommentIfKO: e.target.checked })
                  }
                />
                Commentaire si NC
              </label>
              <label className="flex items-center gap-1">
                <input
                  type="checkbox"
                  checked={it.requirePhotoIfKO}
                  onChange={(e) =>
                    updateItem(idx, { requirePhotoIfKO: e.target.checked })
                  }
                />
                Photo si NC
              </label>
            </div>
          </li>
        ))}
      </ul>
      <button
        onClick={addItem}
        className="mt-3 text-sm text-[var(--steel)] border border-dashed border-[var(--line-d)] rounded-lg px-3 py-2"
      >
        + Ajouter un point
      </button>

      <style jsx>{`
        :global(.input) {
          width: 100%;
          border: 1px solid var(--line);
          border-radius: 8px;
          padding: 8px 10px;
          font-size: 14px;
        }
      `}</style>
    </div>
  );
}

function Field({
  label,
  children,
  full,
}: {
  label: string;
  children: React.ReactNode;
  full?: boolean;
}) {
  return (
    <div className={full ? "md:col-span-2" : ""}>
      <label className="block text-xs font-medium text-[var(--muted)] mb-1">
        {label}
      </label>
      {children}
    </div>
  );
}
