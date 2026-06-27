# Audit technique — déduplication des actions (avant Lot 4B)

> Document d'analyse **figé**, aucune modification de code. Objectif : décider l'architecture de déduplication avant de l'implémenter, sans casser `admin/actions`.
> Règle d'or à préserver : **un compteur et la liste qu'il résume doivent être de même nature** (jamais total dédupliqué + liste paginée brute).

---

## 0. Rappel du mécanisme existant

- `ImportedAction.dedupHash` (`schema.prisma:955`, nullable) = empreinte SHA1 du contenu, posée à **toutes** les créations : import Excel (`actionImport`/`admin/actions/import`), création rapide (`admin/actions/quick:91`), création manuelle agent (`agents/[id]/actions:115`) et site (`sites/[id]/actions:93`), NC de visite (`visits/[id]/route:348`). Les formules diffèrent légèrement selon la source.
- Index actuel : `@@index([agentId, dedupHash])` (`schema.prisma:982`). Commentaire schéma : « doublons d'un même couple `(agentId, dedupHash)` collapsés dans la vue agent ; leur validation cascade sur tout le groupe ».
- Unicité : `@@unique([externalId, agentId])` → une ligne par couple (ID Action, agent). Le dédoublonnage ne fusionne donc PAS plusieurs agents ; il fusionne **plusieurs `externalId` de même contenu pour un même agent**.
- **Seule la fiche agent déduplique aujourd'hui** (+ le badge de la liste agents, aligné en Lot 2). Tous les autres écrans comptent des **occurrences brutes**.

---

## 1. Cartographie des compteurs actuels

| Écran | Compteur | Nature | Clé de dédup utilisée | Pagination | Filtres | Exports | Actions groupées |
|---|---|---|---|---|---|---|---|
| **Fiche agent** (`agents/[id]/page.tsx:87-142`, `AgentActionsClient`) | « Actions à traiter / En retard / À venir » | **DÉDUPLIQUÉ** | `${teamId}:${dedupHash}` à `agentId` fixe ⇒ effectivement `(agentId, teamId, dedupHash)` ; `dedupHash` null → 1 groupe par ligne | Aucune (charge tout l'ACTIF de l'agent, « voir plus » client) | Tags (client) | — (le PDF dev = conformité) | **Cascade client** sur `group.duplicates` : validate (`AgentActionsClient:224-226`), obsolete (`:265-268`) |
| **Fiche site** (`sites/[id]/page.tsx`) | « En retard / À venir » + liste | **BRUT** | aucune (`activeRaw`, chaque ligne `duplicateCount:1, duplicates:[self]`) | Aucune | — | — | Réutilise `AgentActionsClient` mais chaque action = groupe d'1 → cascade = action unique |
| **admin/actions** (`admin-actions-aggregator.ts`) | `total = count(where)` + liste | **BRUT** (les deux) | aucune | **Cursor serveur** (`id`, `take limit+1`) | status/team/agent/site/late/q sur lignes brutes | — | Multi-sélection → `batch-obsolete/replace/delete` sur les `ids[]` **sélectionnés** (occurrences, pas de groupe) |
| **Hub Échéances** (`echeances/sources.ts getActionEcheances`) | KPIs late/today/soon/later/future, critiques | **BRUT** (1 `EcheanceItem` par `ImportedAction`) | aucune | « voir 25 de plus » par groupe (client) | type/urgency/site/team | — | CTA par item (Valider → fiche, Reporter → 1 action). Pas de cascade groupe |
| **Stats/actions** (`stats/actions/route.ts`) | overdue / overdue.critical / soon / aging | **BRUT** (boucle sur occurrences) | aucune | — | from/to (période) + scope | — (graphes) | — |

**Conclusion** : deux conventions coexistent — *dédupliqué* (fiche agent + badge liste agents) vs *brut* (fiche site, admin/actions, Hub, stats). C'est la source des écarts de compteurs entre écrans.

---

## 2. Proposition de modèle de déduplication

### 2.1 Clé logique canonique

```
groupKey(action) =
  [ targetType, targetId, teamId, (dedupHash ?? `row:${id}`) ].join("|")

targetType:targetId =
    agentId   → `agent:${agentId}`
  | siteId    → `site:${siteId}`
  | vehicleId → `vehicle:${vehicleId}`
  | (aucun)   → `none:${id}`   // jamais collapsé
```

- **Pourquoi inclure la cible** : une même action affectée à l'agent A et à l'agent B sont **deux tâches distinctes** (chacun doit la traiter). On ne fusionne jamais entre cibles. Généralise la clé de la fiche agent (`agentId, teamId, dedupHash`) à tous les types de cible (site, véhicule).
- **Pourquoi inclure `teamId`** : deux actions de contenu identique mais d'équipes propriétaires différentes = deux cascades de validation séparées (déjà la règle de la fiche agent).
- **`dedupHash` null → 1 groupe par ligne** : pas de fusion des lignes legacy/sans empreinte.
- **Limite à documenter** : les formules de `dedupHash` diffèrent selon la création (import vs manuel) → seules les actions de **même source/formule** et même contenu collapsent. En pratique les vrais doublons viennent des imports Excel (même contenu, plusieurs ID Action) → couvert.

### 2.2 Helper central (pur, testable)

Un seul helper `dedupActions(rows)` (extrait de la logique actuelle de `agents/[id]/page.tsx:87-142`) renvoyant, par groupe : la ligne **représentante** (échéance la plus proche, tie-break `id`), `occurrenceCount`, et la liste des `memberIds`. Réutilisé par tous les écrans **sans pagination serveur**, et par l'expansion des actions groupées (§5).

### 2.3 Index

Ajouter `@@index([teamId, agentId, siteId, vehicleId, dedupHash])` pour les `COUNT(DISTINCT)` et l'éventuelle fenêtre SQL (§3, option A). Migration additive, sans risque.

---

## 3. Stratégie pagination

Deux familles d'écrans, deux traitements :

### 3.1 Écrans SANS pagination serveur (faible risque)
Fiche agent, fiche site, Hub Échéances, Stats/actions, compteurs Dashboard/Today.
- Ils chargent déjà un ensemble **borné** et scopé (fiche = tout l'actif d'un agent/site ; Hub = `ACTION_MAX=500` ; stats = actif scopé). → **Dédup en mémoire** via `dedupActions` **après** le fetch, **avant** le comptage/regroupement.
- Les **compteurs purs** (Dashboard/Today « actions en retard », stats KPI) peuvent passer par `COUNT(DISTINCT groupKey)` côté SQL (1 requête, pas de pagination). 

### 3.2 admin/actions (le cas dur — cursor serveur)
C'est ici que se joue l'avertissement « ne pas casser ». Deux options exclusives :

- **Option A — Liste par représentants (dédup réelle).** Requête SQL brute avec fenêtre :
  `ROW_NUMBER() OVER (PARTITION BY teamId, agentId, siteId, vehicleId, COALESCE(dedupHash,id) ORDER BY id)`, on pagine les lignes `rn=1`, `total = COUNT(DISTINCT groupKey)`, et on charge les `memberIds` de la page visible en 2ᵉ requête. → liste **et** total dédupliqués, cohérents. **Coût** : SQL brut (SQLite window OK), curseur plus délicat, dédup uniquement pertinente à statut figé (cf. §4).
- **Option B — Liste brute + compteur logique séparé (recommandé pour Lot 4B).** On **garde la liste paginée brute ET le total brut** (cohérents), et on **ajoute** un compteur informatif `« N occurrences · M actions logiques »` via un second `COUNT(DISTINCT groupKey)`. → **impossible** d'avoir total dédupliqué ≠ liste brute, puisque la liste reste brute ; la dédup n'est qu'une **information**. Minimal, sûr, et fidèle à la vocation back-office (gestion ligne à ligne).

**Recommandation** : **Option B** pour admin/actions (back-office = occurrences assumées + info logique). Réserver l'Option A à un éventuel « mode dédupliqué » futur si le besoin métier apparaît.

**Règle invariante** : sur un même écran, `total` et `liste` sont **toujours** de même nature. On ne déduplique le total que si on déduplique aussi la liste.

---

## 4. Stratégie filtres

- **Filtres commutant avec la dédup** (les membres d'un groupe les partagent) : `agentId`, `siteId`, `teamId`, `late` (même jour d'échéance car `dedupHash` intègre `dueAt` au jour), `q` (même contenu). → filtrer puis dédupliquer = dédupliquer puis filtrer. Aucun piège.
- **Exception `status`** : après une validation **partielle** (une occurrence validée, ses doublons restés ACTIVE), un groupe peut être **multi-statuts**. La dédup d'une vue `status=all` devient ambiguë (quelle est la « ligne représentante » d'un groupe mi-validé ?).
  - → **Règle** : ne dédupliquer **qu'à statut figé** (typiquement la vue `ACTIVE`, qui est l'usage réel des compteurs). Pour `status=all` (admin), rester en **brut** (Option B). C'est cohérent : l'admin inspecte les occurrences réelles.
- L'expansion des actions groupées (§5) **supprime** la cause des groupes multi-statuts (validation/obsolescence appliquées à tout le groupe), rendant la dédup ACTIVE robuste.

---

## 5. Stratégie actions groupées (validation / remplacement / obsolescence / suppression)

**Principe** : une action logique se traite **en bloc**. Valider/obsolète/remplacer/supprimer un groupe = appliquer l'opération à **tous** ses `memberIds`. Sinon les doublons restent ACTIVE et **réapparaissent**.

**État actuel** :
- Fiche agent : correct, mais via **cascade client** (`AgentActionsClient` boucle sur `duplicates`).
- Hors fiche (Hub « Valider », admin/actions batch sur 1 occurrence) : **résolution partielle possible** (latent) — on agit sur l'occurrence, pas sur le groupe.

**Proposition** : **expansion de groupe côté serveur**, dans `validate` + `batch-obsolete` + `batch-replace` + `batch-delete`. Donné un (ou des) `id`, le serveur étend l'ensemble aux **siblings** partageant `(targetType:targetId, teamId, dedupHash)` au **même `localStatus`** avant d'appliquer.
- Avantages : correct quel que soit l'écran appelant ; supprime la dépendance au cascade client ; corrige le bug latent hors-fiche ; idempotent.
- UI : afficher clairement « × N occurrences » et confirmer l'effet de bloc (l'admin doit savoir qu'il agit sur le groupe).
- Remplacement : le clone hérite déjà `teamId/target/dedupHash` ; l'expansion marque toutes les occurrences `REPLACED` et crée **un** clone (pas N).

---

## 6. Risques

| Gravité | Risque | Détail / mitigation |
|---|---|---|
| Élevé | **Incohérence total/liste** sur admin/actions | Respecter l'invariant §3 : Option B (tout brut + info logique) ou Option A (tout dédupliqué). Jamais de mélange. |
| Élevé | **Résolution partielle d'un groupe** (doublons ACTIVE résiduels) | Expansion serveur §5 dans validate + batch. Sans elle, valider hors fiche laisse des doublons. |
| Moyen | **Groupes multi-statuts** | Ne dédupliquer qu'à statut figé (ACTIVE). `status=all` reste brut. |
| Moyen | **Formules `dedupHash` divergentes** par source | Documenté ; les vrais doublons (imports) partagent leur formule. Pas de fusion cross-source — acceptable. |
| Moyen | **Performance** `COUNT(DISTINCT)` / window sur gros volume | Index `(teamId, agentId, siteId, vehicleId, dedupHash)`. Mesurer sur la plus grosse équipe. |
| Faible | **Cursor par représentants** (Option A) instable / off-by-one | Évité si Option B retenue. Si A : tests de pagination dédiés. |
| Faible | **Surprise UX** (batch agit sur plus que sélectionné) | Libellé « × N occurrences » + confirmation. |
| Faible | **Hub multi-entités** | La dédup ne concerne que les items `ACTION_OVERDUE` ; visites/équipements/tournées ne se dédupliquent pas (1 entité = 1 item). |

---

## 7. Plan d'implémentation en petits lots

- **Lot 4B-1 — Helper central (aucun écran touché).** `lib/actions/dedup.ts` : `groupKey(action)` + `dedupActions(rows)` (représentant + `occurrenceCount` + `memberIds`), extrait de la fiche agent. Tests purs. Risque nul.
- **Lot 4B-2 — Écrans sans pagination serveur.** Brancher `dedupActions` sur : fiche **site** (aligner sur la fiche agent), **Hub Échéances** (dédup avant grouping ; KPIs dédupliqués), **Stats/actions** (overdue/soon/aging dédupliqués). Compteurs Dashboard/Today via `COUNT(DISTINCT)`. Tests d'égalité fiche↔écrans.
- **Lot 4B-3 — Expansion de groupe serveur.** `validate` + `batch-obsolete/replace/delete` étendent aux siblings ACTIVE. Supprime la cascade client (devient redondante). Tests : valider 1 occurrence ⇒ tout le groupe VALIDATED_LOCAL ; aucun doublon ACTIVE résiduel.
- **Lot 4B-4 — admin/actions.** Option **B** : liste + total **brut** (inchangés) + compteur secondaire `« M actions logiques »` (un `COUNT(DISTINCT)`), et badge `× N` par ligne ayant des doublons. La sélection batch s'appuie sur l'expansion serveur (4B-3) pour agir sur le groupe entier. **Aucune** bascule du total en dédupliqué (respect de l'avertissement).
- **Lot 4B-5 — Index (migration additive).** `@@index([teamId, agentId, siteId, vehicleId, dedupHash])`. Optionnel selon mesures.

Chaque lot est livrable et testable indépendamment ; aucun big-bang ; `admin/actions` n'est touché qu'en 4B-4, après que l'expansion serveur (4B-3) garantit la correction des actions de groupe.

---

## 8. Décisions validées (2026-06-27) — figées pour le Lot 4B

1. ✅ **admin/actions = Option B** : liste + total **bruts** (occurrences), inchangés ; on **ajoute** un compteur secondaire « N occurrences · M actions logiques » (`COUNT(DISTINCT groupKey)`) + badge `× N` par ligne à doublons. **Jamais** de total dédupliqué sur une liste brute.
2. ✅ **Actions groupées = expansion côté serveur** : `validate` + `batch-obsolete/replace/delete` étendent l'opération aux siblings `(targetType:targetId, teamId, dedupHash)` au statut **ACTIVE**. La cascade client de la fiche devient redondante (à retirer ou neutraliser).
3. ✅ **Périmètre dédup = vue ACTIVE uniquement** : seul le backlog « à traiter » est dédupliqué (compteurs + listes ACTIVE). Les vues historiques (validées / obsolètes / remplacées) restent en **occurrences brutes** → pas d'ambiguïté multi-statuts.

> Ces choix éliminent par construction les deux risques majeurs (incohérence total/liste ; résolution partielle de groupe). Le Lot 4B peut démarrer sur cette base, dans l'ordre 4B-1 → 4B-5.
