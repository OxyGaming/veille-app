import type { RciPayload, RciPhotos } from "@/lib/rci/fields";

export type StepProps = {
  payload: RciPayload;
  /** Patch partiel typed-safe — accepte n'importe quel sous-ensemble de RciPayload. */
  patch: (updates: Partial<RciPayload>) => void;
  photos: RciPhotos;
  patchPhotos: (updates: Partial<RciPhotos>) => void;
  /** Lecture seule si le RCI est FINAL. */
  readOnly: boolean;
};

export type StepDef = {
  key: string;
  label: string;
  short: string;
  component: React.ComponentType<StepProps>;
};
