import ProcedureEditClient from "../[id]/ProcedureEditClient";

export const dynamic = "force-dynamic";

/**
 * Création d'une procédure — réutilise `ProcedureEditClient` en mode "création"
 * en lui passant un proc avec `id: null`. À la sauvegarde, le client POSTe sur
 * `/api/procedures` puis redirige vers `/admin/procedures/{newId}` pour la
 * suite du paramétrage (points de checklist, aides réglementaires, etc.).
 *
 * Cf. AUDIT.md §C6 / DECISIONS-SPRINT1.md commit 2.
 */
export default function NewProcedurePage() {
  return (
    <ProcedureEditClient
      proc={{
        id: null,
        domain: "",
        theme: null,
        title: "",
        gravity: 3,
        documents: [],
        risk: null,
        requireGeneralComment: false,
        items: [],
      }}
    />
  );
}
