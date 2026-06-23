"use client";

import { TextField, FieldSet } from "../fields-ui";
import type { StepProps } from "../types";

export default function Step2Nature({ payload, patch, readOnly }: StepProps) {
  return (
    <div className="space-y-4">
      <FieldSet
        title="Nature de l'événement"
        hint="Décrit en quelques mots ce qui s'est passé"
      >
        <TextField
          label="Quoi ?"
          hint="(déraillement, talonnage, franchissement, accident de personne, collision, PN…)"
          value={payload.nature}
          placeholder="Ex. Heurt d'un véhicule au PN 337 par le train 6693"
          disabled={readOnly}
          multiline
          rows={3}
          onChange={(v) => patch({ nature: v })}
        />
      </FieldSet>
    </div>
  );
}
