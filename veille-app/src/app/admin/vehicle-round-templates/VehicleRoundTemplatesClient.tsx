"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Icon } from "@/components/icons";
import { useConfirmDialog } from "@/components/ConfirmDialog";
import {
  RESPONSE_FORMATS,
  RESPONSE_FORMAT_LABELS,
  VEHICLE_TYPES,
  VEHICLE_TYPE_LABELS,
  VEHICLE_TYPE_LIST,
  type ResponseFormat,
  type VehicleType,
} from "@/lib/vehicle-types";

type Item = {
  id: string;
  label: string;
  applicableTypes: string[];
  responseFormat: string;
  sortOrder: number;
  isActive: boolean;
};
type Section = {
  id: string;
  title: string;
  icon: string | null;
  items: Item[];
};
type Template = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  expectedFrequencyDays: number | null;
  sections: Section[];
};

const RESPONSE_FORMAT_LIST: ResponseFormat[] = [
  RESPONSE_FORMATS.BON_MAUVAIS,
  RESPONSE_FORMATS.PRESENT_ABSENT,
  RESPONSE_FORMATS.PRESENT_ABSENT_OR_NA,
];

function formatLabel(rf: string): string {
  if (rf in RESPONSE_FORMAT_LABELS) {
    const f = RESPONSE_FORMAT_LABELS[rf as ResponseFormat];
    return `${f.oui} / ${f.non}${f.sansObjet ? ` / ${f.sansObjet}` : ""}`;
  }
  return rf;
}

export default function VehicleRoundTemplatesClient({
  templates,
}: {
  templates: Template[];
}) {
  const { dialog, ask } = useConfirmDialog();
  const [state, setState] = useState(templates);
  const [adding, setAdding] = useState<{
    templateId: string;
    sectionId: string;
  } | null>(null);
  const [newItem, setNewItem] = useState({
    label: "",
    responseFormat: RESPONSE_FORMATS.PRESENT_ABSENT as ResponseFormat,
    applicableTypes: VEHICLE_TYPE_LIST as VehicleType[],
  });

  function updateItemLocal(
    templateId: string,
    sectionId: string,
    itemId: string,
    patch: Partial<Item>
  ) {
    setState((arr) =>
      arr.map((t) =>
        t.id !== templateId
          ? t
          : {
              ...t,
              sections: t.sections.map((s) =>
                s.id !== sectionId
                  ? s
                  : {
                      ...s,
                      items: s.items.map((i) =>
                        i.id === itemId ? { ...i, ...patch } : i
                      ),
                    }
              ),
            }
      )
    );
  }

  async function saveItem(
    templateId: string,
    sectionId: string,
    item: Item,
    patch: Partial<Item>
  ) {
    const res = await fetch(
      `/api/admin/vehicle-round-templates/${templateId}/items/${item.id}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      }
    );
    if (res.ok) {
      updateItemLocal(templateId, sectionId, item.id, patch);
      toast.success("Item mis à jour");
    } else {
      const j = await res.json().catch(() => ({}));
      toast.error(j.error || "Sauvegarde refusée");
    }
  }

  async function toggleType(
    templateId: string,
    sectionId: string,
    item: Item,
    type: VehicleType
  ) {
    const next = item.applicableTypes.includes(type)
      ? item.applicableTypes.filter((t) => t !== type)
      : [...item.applicableTypes, type];
    await saveItem(templateId, sectionId, item, { applicableTypes: next });
  }

  async function addItem(templateId: string, sectionId: string) {
    if (!newItem.label.trim()) {
      toast.error("Libellé requis");
      return;
    }
    const res = await fetch(
      `/api/admin/vehicle-round-templates/${templateId}/items`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sectionId,
          label: newItem.label,
          responseFormat: newItem.responseFormat,
          applicableTypes: newItem.applicableTypes,
        }),
      }
    );
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      toast.error(j.error || "Création refusée");
      return;
    }
    const created = await res.json();
    setState((arr) =>
      arr.map((t) =>
        t.id !== templateId
          ? t
          : {
              ...t,
              sections: t.sections.map((s) =>
                s.id !== sectionId
                  ? s
                  : {
                      ...s,
                      items: [
                        ...s.items,
                        {
                          id: created.id,
                          label: created.label,
                          applicableTypes: JSON.parse(created.applicableTypes),
                          responseFormat: created.responseFormat,
                          sortOrder: created.sortOrder,
                          isActive: created.isActive,
                        },
                      ],
                    }
              ),
            }
      )
    );
    setAdding(null);
    setNewItem({
      label: "",
      responseFormat: RESPONSE_FORMATS.PRESENT_ABSENT,
      applicableTypes: VEHICLE_TYPE_LIST as VehicleType[],
    });
    toast.success("Item ajouté");
  }

  async function deactivate(
    templateId: string,
    sectionId: string,
    item: Item
  ) {
    const ok = await ask({
      title: `Désactiver « ${item.label} » ?`,
      description:
        "L'item ne sera plus inclus dans les nouvelles tournées. Les tournées passées sont conservées.",
      confirmLabel: "Désactiver",
    });
    if (!ok) return;
    await saveItem(templateId, sectionId, item, { isActive: false });
  }

  async function reactivate(
    templateId: string,
    sectionId: string,
    item: Item
  ) {
    await saveItem(templateId, sectionId, item, { isActive: true });
  }

  return (
    <div className="space-y-6">
      {dialog}
      <header>
        <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
          <Icon.FileText className="w-5 h-5" /> Grilles de tournée VS
        </h1>
        <p className="text-sm text-slate-600 mt-1">
          Édition des items à vérifier. Chaque item peut s'appliquer à un ou
          plusieurs types de véhicules (basique, EIS, DPx/ADPx/Astreinte).
        </p>
      </header>

      {state.map((t) => (
        <section
          key={t.id}
          className="bg-white border border-slate-200 rounded-xl overflow-hidden"
        >
          <header className="px-4 py-3 border-b border-slate-100 bg-slate-50">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div>
                <h2 className="text-base font-bold">{t.name}</h2>
                <div className="text-[11px] text-slate-500 mt-0.5 font-mono">
                  {t.slug} · cadence{" "}
                  {t.expectedFrequencyDays
                    ? `${t.expectedFrequencyDays} j`
                    : "libre"}
                </div>
              </div>
            </div>
            {t.description && (
              <p className="text-xs text-slate-600 mt-2">{t.description}</p>
            )}
          </header>

          <div className="divide-y divide-slate-100">
            {t.sections.map((s) => (
              <div key={s.id} className="px-4 py-3">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                    <span>{s.icon ?? "📋"}</span>
                    {s.title}
                    <span className="text-xs text-slate-400 font-normal">
                      ({s.items.filter((i) => i.isActive).length} actifs /{" "}
                      {s.items.length})
                    </span>
                  </h3>
                  <button
                    onClick={() =>
                      setAdding({ templateId: t.id, sectionId: s.id })
                    }
                    className="text-xs inline-flex items-center gap-1 px-2 py-1 rounded-md bg-slate-100 text-slate-700 hover:bg-slate-200"
                  >
                    <Icon.Plus className="w-3 h-3" /> Item
                  </button>
                </div>

                <ul className="space-y-2">
                  {s.items.map((item) => (
                    <li
                      key={item.id}
                      className={`border border-slate-200 rounded-lg p-3 ${item.isActive ? "" : "opacity-50 bg-slate-50"}`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <input
                          type="text"
                          defaultValue={item.label}
                          onBlur={(e) => {
                            if (e.target.value.trim() !== item.label) {
                              saveItem(t.id, s.id, item, {
                                label: e.target.value.trim(),
                              });
                            }
                          }}
                          className="flex-1 text-sm font-medium bg-transparent border-b border-transparent hover:border-slate-200 focus:border-slate-400 focus:outline-none px-1"
                        />
                        {item.isActive ? (
                          <button
                            onClick={() => deactivate(t.id, s.id, item)}
                            className="text-xs text-rose-600 hover:bg-rose-50 px-2 py-1 rounded shrink-0"
                          >
                            Désactiver
                          </button>
                        ) : (
                          <button
                            onClick={() => reactivate(t.id, s.id, item)}
                            className="text-xs text-emerald-600 hover:bg-emerald-50 px-2 py-1 rounded shrink-0"
                          >
                            Réactiver
                          </button>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-2 flex-wrap">
                        <label className="text-xs">
                          <span className="text-slate-500 mr-1">Format :</span>
                          <select
                            value={item.responseFormat}
                            onChange={(e) =>
                              saveItem(t.id, s.id, item, {
                                responseFormat: e.target.value,
                              })
                            }
                            className="rounded border border-slate-200 px-2 py-0.5 text-xs bg-white"
                          >
                            {RESPONSE_FORMAT_LIST.map((rf) => (
                              <option key={rf} value={rf}>
                                {formatLabel(rf)}
                              </option>
                            ))}
                          </select>
                        </label>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-slate-500">
                            Types :
                          </span>
                          {VEHICLE_TYPE_LIST.map((type) => {
                            const active = item.applicableTypes.includes(type);
                            return (
                              <button
                                key={type}
                                onClick={() => toggleType(t.id, s.id, item, type)}
                                className={`text-[10px] font-mono px-2 py-0.5 rounded border transition-colors ${
                                  active
                                    ? "bg-indigo-50 border-indigo-200 text-indigo-700"
                                    : "bg-white border-slate-200 text-slate-400 hover:border-slate-400"
                                }`}
                              >
                                {VEHICLE_TYPE_LABELS[type]}
                              </button>
                            );
                          })}
                          {item.applicableTypes.length === 0 && (
                            <span className="text-[10px] text-amber-700 italic">
                              (aucun type — masqué partout)
                            </span>
                          )}
                          {item.applicableTypes.length === 3 && (
                            <span className="text-[10px] text-emerald-700 italic">
                              (tous les types)
                            </span>
                          )}
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>

                {adding?.templateId === t.id && adding.sectionId === s.id && (
                  <div className="mt-3 border-2 border-dashed border-slate-300 rounded-lg p-3 space-y-2">
                    <input
                      type="text"
                      placeholder="Libellé de l'item…"
                      value={newItem.label}
                      onChange={(e) =>
                        setNewItem({ ...newItem, label: e.target.value })
                      }
                      autoFocus
                      className="w-full text-sm rounded border border-slate-300 px-2 py-1.5"
                    />
                    <div className="flex flex-wrap items-center gap-2">
                      <label className="text-xs">
                        <span className="text-slate-500 mr-1">Format :</span>
                        <select
                          value={newItem.responseFormat}
                          onChange={(e) =>
                            setNewItem({
                              ...newItem,
                              responseFormat: e.target.value as ResponseFormat,
                            })
                          }
                          className="rounded border border-slate-200 px-2 py-0.5 text-xs bg-white"
                        >
                          {RESPONSE_FORMAT_LIST.map((rf) => (
                            <option key={rf} value={rf}>
                              {formatLabel(rf)}
                            </option>
                          ))}
                        </select>
                      </label>
                      {VEHICLE_TYPE_LIST.map((type) => {
                        const active = newItem.applicableTypes.includes(type);
                        return (
                          <button
                            key={type}
                            type="button"
                            onClick={() =>
                              setNewItem({
                                ...newItem,
                                applicableTypes: active
                                  ? newItem.applicableTypes.filter(
                                      (x) => x !== type
                                    )
                                  : [...newItem.applicableTypes, type],
                              })
                            }
                            className={`text-[10px] font-mono px-2 py-0.5 rounded border ${active ? "bg-indigo-50 border-indigo-200 text-indigo-700" : "bg-white border-slate-200 text-slate-400"}`}
                          >
                            {VEHICLE_TYPE_LABELS[type]}
                          </button>
                        );
                      })}
                    </div>
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => setAdding(null)}
                        className="text-xs px-2 py-1 rounded text-slate-600 hover:bg-slate-100"
                      >
                        Annuler
                      </button>
                      <button
                        onClick={() => addItem(t.id, s.id)}
                        className="text-xs px-3 py-1 rounded bg-slate-900 text-white font-medium hover:bg-slate-800"
                      >
                        Ajouter
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
