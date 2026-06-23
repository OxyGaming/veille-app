"use client";

import { TextField, CheckField, TernaryField, FieldSet } from "../fields-ui";
import type { StepProps } from "../types";

export default function Step4Mobiles({ payload, patch, readOnly }: StepProps) {
  return (
    <div className="space-y-4">
      <FieldSet title="Installations" hint="Signal / équipement / PN concerné">
        <TextField
          label="Appareil de voie (type, n°)"
          value={payload.appareil_voie}
          disabled={readOnly}
          onChange={(v) => patch({ appareil_voie: v })}
        />
        <TextField
          label="Signal / repère n° / EOA Km"
          value={payload.signal_repere}
          disabled={readOnly}
          onChange={(v) => patch({ signal_repere: v })}
        />
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <CheckField
              label="KVB / KCVP / KVBP"
              value={payload.inst_kvb}
              onChange={(v) => patch({ inst_kvb: v })}
              disabled={readOnly}
            />
            {payload.inst_kvb && (
              <TernaryField
                label="En service ?"
                value={payload.inst_kvb_en_service}
                onChange={(v) => patch({ inst_kvb_en_service: v })}
                disabled={readOnly}
              />
            )}
          </div>
          <div className="flex flex-col gap-2">
            <CheckField
              label="DAAT"
              value={payload.inst_daat}
              onChange={(v) => patch({ inst_daat: v })}
              disabled={readOnly}
            />
            {payload.inst_daat && (
              <TernaryField
                label="En service ?"
                value={payload.inst_daat_en_service}
                onChange={(v) => patch({ inst_daat_en_service: v })}
                disabled={readOnly}
              />
            )}
          </div>
          <div className="flex flex-col gap-2">
            <CheckField
              label="TVM"
              value={payload.inst_tvm}
              onChange={(v) => patch({ inst_tvm: v })}
              disabled={readOnly}
            />
            {payload.inst_tvm && (
              <div className="flex flex-col gap-1">
                <div className="flex gap-3">
                  <CheckField
                    label="300"
                    value={payload.inst_tvm_300}
                    onChange={(v) => patch({ inst_tvm_300: v })}
                    disabled={readOnly}
                  />
                  <CheckField
                    label="430"
                    value={payload.inst_tvm_430}
                    onChange={(v) => patch({ inst_tvm_430: v })}
                    disabled={readOnly}
                  />
                </div>
                <TernaryField
                  label="En service ?"
                  value={payload.inst_tvm_en_service}
                  onChange={(v) => patch({ inst_tvm_en_service: v })}
                  disabled={readOnly}
                />
              </div>
            )}
          </div>
          <div className="flex flex-col gap-2">
            <CheckField
              label="ETCS"
              value={payload.inst_etcs}
              onChange={(v) => patch({ inst_etcs: v })}
              disabled={readOnly}
            />
            {payload.inst_etcs && (
              <div className="flex flex-col gap-1">
                <div className="flex gap-3">
                  <CheckField
                    label="1"
                    value={payload.inst_etcs_1}
                    onChange={(v) => patch({ inst_etcs_1: v })}
                    disabled={readOnly}
                  />
                  <CheckField
                    label="2"
                    value={payload.inst_etcs_2}
                    onChange={(v) => patch({ inst_etcs_2: v })}
                    disabled={readOnly}
                  />
                </div>
                <TernaryField
                  label="En service ?"
                  value={payload.inst_etcs_en_service}
                  onChange={(v) => patch({ inst_etcs_en_service: v })}
                  disabled={readOnly}
                />
              </div>
            )}
          </div>
          <CheckField
            label="Crocodile"
            value={payload.inst_crocodile}
            onChange={(v) => patch({ inst_crocodile: v })}
            disabled={readOnly}
          />
          <TernaryField
            label="Équipé d'un détonateur"
            value={payload.inst_detonateur}
            onChange={(v) => patch({ inst_detonateur: v })}
            disabled={readOnly}
          />
          <TernaryField
            label="Cartouche percutée"
            value={payload.inst_cartouche_percutee}
            onChange={(v) => patch({ inst_cartouche_percutee: v })}
            disabled={readOnly}
          />
        </div>
        <TextField
          label="Autres installations"
          value={payload.autres_installations}
          disabled={readOnly}
          multiline
          rows={2}
          onChange={(v) => patch({ autres_installations: v })}
        />
      </FieldSet>

      <FieldSet title="Passage à niveau" hint="(si applicable)">
        <div className="grid gap-3 sm:grid-cols-3">
          <TextField
            label="PN n°"
            value={payload.pn_numero}
            placeholder="337"
            disabled={readOnly}
            onChange={(v) => patch({ pn_numero: v })}
          />
          <div className="flex gap-3 items-end">
            <CheckField
              label="SAL 2"
              value={payload.pn_sal2}
              onChange={(v) => patch({ pn_sal2: v })}
              disabled={readOnly}
            />
            <CheckField
              label="SAL 4"
              value={payload.pn_sal4}
              onChange={(v) => patch({ pn_sal4: v })}
              disabled={readOnly}
            />
            <CheckField
              label="Autres"
              value={payload.pn_autres}
              onChange={(v) => patch({ pn_autres: v })}
              disabled={readOnly}
            />
          </div>
          <TernaryField
            label="Feux routiers fonctionnent ?"
            value={payload.pn_feux_routiers}
            onChange={(v) => patch({ pn_feux_routiers: v })}
            disabled={readOnly}
          />
        </div>
      </FieldSet>

      <FieldSet title="Train principal">
        <div className="grid gap-3 sm:grid-cols-2">
          <TextField
            label="N° de train"
            value={payload.train_numero}
            disabled={readOnly}
            onChange={(v) => patch({ train_numero: v })}
          />
          <TextField
            label="Entreprise ferroviaire"
            value={payload.train_ef}
            disabled={readOnly}
            onChange={(v) => patch({ train_ef: v })}
          />
          <TextField
            label="Locomotive / Automoteur n°"
            value={payload.train_locomotive_numero}
            disabled={readOnly}
            onChange={(v) => patch({ train_locomotive_numero: v })}
          />
          <TextField
            label="Rame n°"
            value={payload.train_rame_numero}
            disabled={readOnly}
            onChange={(v) => patch({ train_rame_numero: v })}
          />
        </div>
        <div className="flex gap-4 flex-wrap">
          <CheckField
            label="US"
            value={payload.train_us}
            onChange={(v) => patch({ train_us: v })}
            disabled={readOnly}
          />
          <CheckField
            label="UM"
            value={payload.train_um}
            onChange={(v) => patch({ train_um: v })}
            disabled={readOnly}
          />
          <CheckField
            label="Sous-traitant"
            value={payload.train_sous_traitant}
            onChange={(v) => patch({ train_sous_traitant: v })}
            disabled={readOnly}
          />
          <CheckField
            label="Double traction"
            value={payload.train_double_traction}
            onChange={(v) => patch({ train_double_traction: v })}
            disabled={readOnly}
          />
          <CheckField
            label="Pousse"
            value={payload.train_pousse}
            onChange={(v) => patch({ train_pousse: v })}
            disabled={readOnly}
          />
        </div>
        <TernaryField
          label="Conduite depuis engin moteur en tête"
          value={payload.train_conduite_em_en_tete}
          onChange={(v) => patch({ train_conduite_em_en_tete: v })}
          disabled={readOnly}
        />
      </FieldSet>

      <FieldSet title="Composition" hint="(masses en tonnes, longueur en mètres)">
        <div className="grid gap-3 sm:grid-cols-3">
          <TextField
            label="Code/indice compo"
            value={payload.compo_code}
            disabled={readOnly}
            onChange={(v) => patch({ compo_code: v })}
          />
          <TextField
            label="Nb véhicules"
            value={payload.compo_nb_vehicules}
            disabled={readOnly}
            onChange={(v) => patch({ compo_nb_vehicules: v })}
          />
          <TextField
            label="Longueur (m)"
            value={payload.compo_longueur}
            disabled={readOnly}
            onChange={(v) => patch({ compo_longueur: v })}
          />
          <TextField
            label="Masse (T)"
            value={payload.compo_masse}
            disabled={readOnly}
            onChange={(v) => patch({ compo_masse: v })}
          />
          <TextField
            label="Masse freinée réalisée"
            value={payload.compo_masse_freinee_realisee}
            disabled={readOnly}
            onChange={(v) => patch({ compo_masse_freinee_realisee: v })}
          />
          <TextField
            label="Masse freinée nécessaire"
            value={payload.compo_masse_freinee_necessaire}
            disabled={readOnly}
            onChange={(v) => patch({ compo_masse_freinee_necessaire: v })}
          />
        </div>
      </FieldSet>

      <FieldSet title="Parcours">
        <div className="grid gap-3 sm:grid-cols-3">
          <TextField
            label="De"
            value={payload.parcours_de}
            placeholder="St Etienne Chateaucreux"
            disabled={readOnly}
            onChange={(v) => patch({ parcours_de: v })}
          />
          <TextField
            label="À"
            value={payload.parcours_a}
            placeholder="Paris Gare de Lyon"
            disabled={readOnly}
            onChange={(v) => patch({ parcours_a: v })}
          />
          <TextField
            label="Vitesse au moment (km/h)"
            value={payload.vitesse_evenement}
            placeholder="50"
            disabled={readOnly}
            onChange={(v) => patch({ vitesse_evenement: v })}
          />
        </div>
      </FieldSet>
    </div>
  );
}
