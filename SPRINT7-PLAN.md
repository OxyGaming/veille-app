# Sprint 7 — Gestion des actions : suppression logique unitaire + batch

> Date : 2026-06-14
> Auteur du plan : Claude Code (Opus 4.7)
> Branche : `main` — état au commit `438b19a` (Sprint 6 C10)
> Périmètre : C1 → C6 (C6 optionnel) — 6 commits prévus

## 1. Objectif

Retirer des actions importées du flux opérationnel **sans suppression physique**.

Règle métier : `localStatus = OBSOLETE`. Les actions OBSOLETE restent en base pour traçabilité mais disparaissent de Today / Hub Échéances / Dashboard / fiches agent et site / notifications futures.

## 2. État de l'existant

| Élément | État | Référence |
|---|---|---|
| Modèle `ImportedAction.localStatus` | `ACTIVE` \| `REPLACED` \| `OBSOLETE` \| `VALIDATED_LOCAL` | `prisma/schema.prisma:867` |
| Index composite `(localStatus, dueAt)` | présent | `schema.prisma:926` |
| Route `DELETE /api/actions/[id]?mode=soft` | existe déjà → `localStatus="OBSOLETE"` | `actions/[id]/route.ts:92` |
| Validation action | helper `assertTeamAccess(u, action.teamId)` | `actions/[id]/validate/route.ts:48` |
| Filtre actions dans Hub Échéances | `localStatus = "ACTIVE"` | `echeances/sources.ts` |
| Filtre Today / Dashboard | `localStatus = "ACTIVE"` | `today/sources.ts`, `dashboard-aggregator.ts` |
| `AuditLog` write pattern | `tx.auditLog.create({...})` dans transaction | `actions/validations/[id]/route.ts:139` |
| Pas de page `/admin/actions` | à créer en C3 | — |

**Conséquence importante** : la route legacy `DELETE ?mode=soft` fait déjà l'opération, **mais sans AuditLog**. Sprint 7 ajoute la traçabilité et un endpoint dédié plus explicite.

## 3. Arbitrages PO (D1 → D8) — à valider

| # | Décision | Recommandation | Justification |
|---|---|---|---|
| D1 | Nouvelle route `POST /api/actions/[id]/obsolete` vs réutiliser `DELETE ?mode=soft` | **Nouvelle route + conservation de la legacy** | Nom explicite, audit cohérent. Legacy conservé pour rétro-compat (1 ligne d'audit ajoutée). À déprécier Sprint 8. |
| D2 | Action `VALIDATED_LOCAL` → tentative obsolete | **Refus 409** avec message clair | « Action déjà validée — annulez la validation avant. » Évite confusion sémantique. |
| D3 | Action déjà `OBSOLETE` → tentative obsolete | **Idempotent 200** (no-op explicite) | `previousStatus === newStatus === "OBSOLETE"`, audit NON créé (pas d'événement réel). |
| D4 | Action `REPLACED` → tentative obsolete | **Autorisé** (transition vers OBSOLETE) | `REPLACED` est un statut transitoire d'import. Autoriser le marquage OBSOLETE explicite par utilisateur. |
| D5 | Scope ADMIN Sprint 6 | **Hérité automatiquement** via `actionScope(u)` (C5) | Aucun code spécifique à écrire. ADMIN MY_TEAMS / TEAM voit ses propres scopes appliqués. |
| D6 | C3 `/admin/actions` — accès | **ADMIN-only** (cohérent avec `/admin/audit`) | EDITOR a déjà la fiche agent + Hub Échéances pour son périmètre. Évite multiplier les surfaces. |
| D7 | Champ `obsoletedAt` ou `obsoletedById` sur `ImportedAction` | **Non — pas de nouveau champ** | `updatedAt` + `AuditLog ACTION_OBSOLETE` suffisent (PO refusé migration en V2). |
| D8 | Batch comportement partiel (skip non-éligibles) vs tout-ou-rien | **Partiel** : on traite ce qu'on peut, on rapporte le détail | Cohérent avec UX (sélection multiple souvent imparfaite). Réponse détaillée `{requested, updated, skipped, forbidden, alreadyObsolete}`. |

## 4. Découpage technique

### C1 — API unitaire `POST /api/actions/[id]/obsolete`

- **Route** : nouveau handler.
- **Sécurité** : `requireRole(['ADMIN','EDITOR'])` + `actionScope(u)` (404 si hors scope — pas de fuite d'existence).
- **Statuts** :
  - `ACTIVE` ou `REPLACED` → update → AuditLog → 200 `{ok:true, previousStatus, newStatus:"OBSOLETE"}`.
  - `OBSOLETE` → idempotent → 200 `{ok:true, previousStatus:"OBSOLETE", newStatus:"OBSOLETE", noop:true}`. Pas d'AuditLog.
  - `VALIDATED_LOCAL` → 409 `{error, code:"ACTION_VALIDATED"}`.
- **AuditLog** : `action: "ACTION_OBSOLETE"`, `entity: "ImportedAction"`, `entityId: id`, `details: { previousStatus, agentId, siteId, teamId, label }`.
- **Tests Vitest** (≥ 7) : USER 403, EDITOR hors scope 404, EDITOR scope 200, ADMIN GLOBAL 200, ADMIN MY_TEAMS hors scope 404, OBSOLETE idempotent, VALIDATED_LOCAL 409, AuditLog créé.
- **Legacy DELETE ?mode=soft** : ajout AuditLog pour cohérence.

### C2 — Bouton « Retirer » dans fiche agent

- **Composant** : `<ActionObsoleteButton actionId>`.
- **Visibilité** : EDITOR + ADMIN uniquement (props `canManage` calculé côté Server Component).
- **UX** : dialog de confirmation native ou modal cohérent avec dashboards existants. Message : « Cette action sera retirée du suivi opérationnel, mais restera conservée dans l'historique. »
- **Action client** : `POST /api/actions/[id]/obsolete` → toast succès → `router.refresh()`.
- **Erreurs** : 409 (validée) affiche un toast d'erreur explicite.
- **Responsive** : 320 / 375 / 768 / desktop vérifiés en preview MCP.

### C3 — Page `/admin/actions` (ADMIN-only, lecture seule)

- **Server Component** + table dense desktop / cards mobile (pattern `/admin/audit`).
- **Filtres URL** : `status` (ACTIVE / OBSOLETE / VALIDATED_LOCAL / all), `teamId`, `agentId`, `siteId`, `late` (boolean), `q` (recherche fulltext sur `keyPoint`/`comment`).
- **Scope ADMIN** : hérité via `actionScope(u)` Sprint 6.
- **Pagination** : cursor par `id` (cohérent /admin/audit).
- **Pas de batch encore** — UI prête en C4.

### C4 — Sélection multiple + `POST /api/actions/batch-obsolete`

- **Route batch** :
  - Payload : `{ actionIds: string[] }` (max 500).
  - Sécurité : `requireRole(['ADMIN','EDITOR'])`.
  - Pour chaque actionId :
    - hors scope → `forbidden`
    - inconnu → `forbidden` (404 par actionScope)
    - VALIDATED_LOCAL → `skipped`
    - OBSOLETE → `alreadyObsolete`
    - sinon → `updated` (`UPDATE` + AuditLog batch)
  - Réponse : `{ ok, requested, updated, skipped, forbidden, alreadyObsolete, total }`.
- **UI** : checkboxes par ligne + « tout sélectionner page » + compteur sticky + bouton « Marquer obsolètes » avec dialog confirmation montrant le nombre.

### C5 — AuditLog batch + recette sécurité

- **AuditLog par batch** : `action: "ACTION_BATCH_OBSOLETE"` avec `details: { count, actionIds, skipped, forbidden, alreadyObsolete }`.
- **Une seule entrée** par batch (pas N entrées), cohérent avec l'esprit « événement de masse ».
- **Recette** : matrice 7 scénarios listés en consigne PO + perf.

### C6 — Optionnel (UX)

- `?dryRun=1` sur batch-obsolete (n'écrit pas, retourne `{would: ...}`).
- Bouton « Export CSV » des actions filtrées sur `/admin/actions`.
- Filtre rapide « Voir obsolètes » (`status=OBSOLETE`).
- Pastille spéciale dans `/admin/audit` pour les entrées `ACTION_OBSOLETE` / `ACTION_BATCH_OBSOLETE`.

## 5. Estimation

| Commit | Charge | Notes |
|---|---|---|
| C1 | 2–3 h | route + 7 tests + audit + legacy patch |
| C2 | 1–2 h | bouton + dialog + responsive preview |
| C3 | 2–3 h | page Server + filtres + table responsive |
| C4 | 2 h | batch route + UI sélection |
| C5 | 1 h | audit batch + recette |
| C6 | 1–2 h | optionnel |

**Total estimé** : ~9–13 h.

## 6. Risques et contraintes

| Risque | Mitigation |
|---|---|
| Régression sur imports (un import recrée une action OBSOLETE) | Vérifier que l'import ne réinitialise pas `localStatus` si déjà OBSOLETE. À tester en C1 (ou laisser à un sprint dédié si non couvert). |
| Confusion utilisateur entre validation et obsolescence | Message clair sur le bouton + sur le refus 409. |
| Batch trop large → timeout transaction | Plafond 500 actions par batch. Pagination UI pour > 500. |
| Surface ADMIN supplémentaire en MY_TEAMS / TEAM | `/admin/actions` hérite du scope C5 ; aucun risque de fuite. |
| AuditLog volume (batch sur 500 → 1 ligne, OK) | Conception batch limite l'impact. Single-action garde 1 entrée par event. |

## 7. Contraintes générales

- ❌ Jamais de `DELETE` physique côté code (sauf legacy `?mode=hard` déjà en place).
- ❌ Pas de modification du Scope Engine (Sprint 6 figé).
- ❌ Pas de modification des règles d'échéances (filtres `localStatus=ACTIVE` suffisent).
- ✅ TypeScript strict + Vitest vert à chaque commit.
- ✅ Preview MCP obligatoire pour toute UI (C2, C3, C4).
- ✅ Responsive 320 / 375 / 768 / desktop.

## 8. Livrables à chaque commit

- fichiers modifiés ;
- comportement ;
- sécurité ;
- tests ;
- limites connues ;
- SHA Git.

## 9. Validation attendue

Confirmation PO sur D1 → D8 puis go pour C1.
