"use client";

import { TextField, CheckField, TernaryField, FieldSet } from "../fields-ui";
import type { StepProps } from "../types";

export default function Step3Ou({ payload, patch, readOnly }: StepProps) {
  return (
    <div className="space-y-4">
      <FieldSet title="Localisation" hint="Où l'événement s'est produit">
        <TextField
          label="Gare / gares encadrantes / poste / ITE / point remarquable"
          value={payload.gare_section}
          placeholder="Ex. PN 337 Km 532,572 — entre Givors et St Romain"
          disabled={readOnly}
          onChange={(v) => patch({ gare_section: v })}
        />
        <div className="grid gap-3 sm:grid-cols-4">
          <TextField
            label="Point kilométrique"
            value={payload.point_km}
            placeholder="435.700"
            disabled={readOnly}
            onChange={(v) => patch({ point_km: v })}
          />
          <TextField
            label="N° de voie"
            value={payload.numero_voie}
            placeholder="2"
            disabled={readOnly}
            onChange={(v) => patch({ numero_voie: v })}
          />
          <TextField
            label="N° de ligne"
            value={payload.numero_ligne}
            placeholder="750000"
            disabled={readOnly}
            onChange={(v) => patch({ numero_ligne: v })}
          />
          <TextField
            label="N° département"
            value={payload.numero_dpt}
            placeholder="69"
            disabled={readOnly}
            onChange={(v) => patch({ numero_dpt: v })}
          />
        </div>
      </FieldSet>

      <FieldSet title="Type de voie">
        <TextField
          label="Type de voie"
          hint="(libre : DV, VU, VPL, etc.)"
          value={payload.type_voie}
          placeholder="DV"
          disabled={readOnly}
          onChange={(v) => patch({ type_voie: v })}
        />
        <div className="flex gap-4 flex-wrap">
          <CheckField
            label="VP"
            value={payload.type_voie_vp}
            onChange={(v) => patch({ type_voie_vp: v })}
            disabled={readOnly}
          />
          <CheckField
            label="VS"
            value={payload.type_voie_vs}
            onChange={(v) => patch({ type_voie_vs: v })}
            disabled={readOnly}
          />
        </div>
        <TernaryField
          label="VP engagée ?"
          value={payload.vp_engagee}
          onChange={(v) => patch({ vp_engagee: v })}
          disabled={readOnly}
        />
      </FieldSet>
    </div>
  );
}
