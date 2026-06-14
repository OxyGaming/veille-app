# SPRINT4-PLAN.md — Plan d'exécution Sprint 4

> **Périmètre** : livrer le **Hub Échéances** — vue centralisée des visites en retard ou à venir, équipements expirants et actions à échoir, sur tout le périmètre de l'utilisateur.
> **Date** : 2026-06-14.
> **Sprint** : Sprint 4 (~75 h de capacité solo + IA).
> **Documents amont** : [memory/business-rules.md](memory/business-rules.md), [memory/decisions.md](memory/decisions.md), [SPRINT3-RECETTE.md](SPRINT3-RECETTE.md), [TODAY-V1.md](TODAY-V1.md).

---

## 0. Décisions PO à valider avant C1

Le Hub Échéances touche à l'UX globale et à la frontière entre `/today` (tournée du jour) et la nouvelle vue stratégique. Je propose les choix ci-dessous ; chaque ligne se valide ou s'arbitre indépendamment.

| # | Sujet | Recommandation | Alternative | Argument |
|---|---|---|---|---|
| D1 | URL du Hub | **Route séparée `/echeances`** | Onglet dans `/today` | `/today` reste *tournée du jour*. Le Hub est une vue *pilotage*. Lien réciproque entre les deux. |
| D2 | Périmètre rôle V1 | **EDITOR + ADMIN** | + USER | Pilotage = encadrant. USER reste sur `/today` carte « À traiter aujourd'hui ». À élargir Sprint 5 si demande. |
| D3 | Groupement principal | **Par urgence** (en retard / aujourd'hui / <7 j / <30 j) | Par site, par type | Optique action « qu'est-ce qui brûle ? ». Tri secondaire par site. |
| D4 | Échéances couvertes V1 | **3 types** : visites (trim + plan), équipements (expirant), actions (en retard 7 j+) | + audit IUC, + sécurité, etc. | Réutilise l'existant Sprint 2-3. Pas de nouveaux types métier. |
| D5 | Filtres minimums V1 | **Type, site, urgence** (chips + dropdown) | + cadence (trim/plan), + équipe | 3 filtres suffisent. Cadence resterait peu utile en V1. Filtre équipe = redondant avec scope. |
| D6 | Génération d'event `ECHEANCE_DEPASSEE` dans TeamActivity | **Non en V1** | Oui (1 event par échéance dépassée) | Trop verbeux (pollution du flux). Le Hub joue déjà ce rôle. |
| D7 | Champ `cadenceType` explicite sur `SiteVisitTemplate` | **Non en V1** (garder convention slug) | Ajouter une migration | Conventions slug stables et seulement 2 valeurs. Risque migration > bénéfice. À reprendre Sprint 5+. |
| D8 | Pagination | **« Voir plus » au scroll** (chargement 25 par batch) | Pagination paginée | Volumes attendus modestes (<200 échéances actives par périmètre). « Voir plus » plus naturel mobile. |
| D9 | Drilldown site | **Section échéances ajoutée à `/sites/[id]`** (ou onglet) | Page dédiée `/sites/[id]/echeances` | Profite de la page existante, pas de nouvelle route à maintenir. |
| D10 | Lien depuis Today EDITOR | **Bouton « Voir toutes les échéances »** sous Diagnostic ET sous Watchlist sites | Cartes supplémentaires | Conserve Today épuré. Ouvre Hub pré-filtré (`/echeances?type=visit` ou `?siteId=…`). |
| D11 | Action contextuelle par ligne d'échéance | **CTA principal contextuel** : « Planifier visite » / « Marquer équipement remplacé » / « Valider action » | Liste lecture seule | Hub doit permettre de *régler*, pas seulement *constater*. CTA réutilisent les routes existantes. |
| D12 | Calendrier (vue chronologique mois) | **Non en V1** | Vue calendrier | UX lourde à maintenir, volumes faibles, ROI faible. Liste groupée par urgence suffit. |

Tant que ces 12 lignes ne sont pas tranchées, l'écriture du code peut commencer sur les fondations (C2-C3 — types et sources) qui sont neutres à 90 %.

---

## 0.1 Contraintes assumées

- **Mobile-first** : 320 / 375 / 768 / desktop (cf. Sprint 2 audit responsive).
- **Multi-équipes** : scopes existants (`teamScope`, `siteScope`, `agentScope`, `actionScope`) — strictement aucun bypass.
- **Pas d'audio**, **pas de push**, **pas d'email** (cohérent décision PO 2026-06-14).
- **Pas de nouveau modèle métier** sauf strict nécessaire (au plus 1 migration cosmétique).
- **Réutilise tout ce que Sprint 2-3 ont livré** : helpers cadences, sources Prisma, `TeamActivity`, scoping.
- **TypeScript strict + Vitest** : tous les helpers purs (urgence, agrégation) testés unitairement.
- **Pas de régression** : `/today`, `/agents/[id]`, `/sites/[id]`, écran admin, photos restent fonctionnels.

---

## 1. Synthèse globale

### 1.1 Ordre optimal des commits

```
SEMAINE 1 — Fondations data (14-18 h)
  C1  S4-DOC : arbitrages PO + plan détaillé (no-code)         1-2 h
  C2  S4-01  : types EcheanceItem + helpers urgence + tests    5-7 h
  C3  S4-02  : sources Prisma unifiées (fan-out 3 types)       8-10 h

SEMAINE 2 — Route et UI minimale (16-22 h)
  C4  S4-03  : route /echeances + agrégateur + payload typé    6-8 h
  C5  S4-04  : UI Hub Échéances V1 (KPI + liste groupée)       10-14 h
       → Démo : Hub visible et lisible, sans filtres

SEMAINE 3 — Filtres et intégrations (16-20 h)
  C6  S4-05  : filtres type / site / urgence + URL search      6-8 h
  C7  S4-06  : lien depuis Today EDITOR (deux entrées)         2-3 h
  C8  S4-07  : drilldown — section échéances sur /sites/[id]   8-10 h
       → Démo : flux complet Today → Hub → Site

SEMAINE 4 — Polish + recette (12-16 h)
  C9  S4-08  : CTA contextuels + perf + responsive             6-8 h
  C10 S4-RECETTE : tests E2E + SPRINT4-RECETTE.md              6-8 h
```

**Total brut** : 58-77 h.
**Effort net solo + IA estimé** : ~55-70 h.
**Capacité Sprint 4** : 75 h.
**Marge** : ~5-20 h selon scope final et arbitrages D1-D12.

### 1.2 Dépendances entre commits

```
C1 (DOC)   ─── préalable validation PO

C2 (types) ─→ C3 (sources)
            └→ C4 (agrégateur)

C3 (sources) ─→ C4 (agrégateur)
              └→ C8 (drilldown réutilise getEcheancesForSite)

C4 (route)  ─→ C5 (UI)
            ─→ C6 (filtres)
            ─→ C7 (lien Today)

C5 (UI)     ─→ C6 (filtres greffent sur la liste)
            ─→ C9 (polish s'appuie sur la liste)

C7 (lien)   ─── indépendant de C5 si on accepte un lien vers Hub vide

C8 (drilldown) ─── peut paralléliser avec C6-C7

C10 (recette)  ─── dépend de tout
```

### 1.3 Points de démo

- **Fin semaine 1** : `GET /api/echeances` (interne) renvoie un payload typé pour un EDITOR, vérifiable via tests Vitest sur l'agrégateur.
- **Fin semaine 2** : Hub Échéances accessible en `/echeances`, liste groupée par urgence, KPI en tête.
- **Fin semaine 3** : Filtres opérationnels, lien Today EDITOR → Hub, drilldown depuis `/sites/[id]`.
- **Fin semaine 4** : CTA contextuels « régler » + responsive 4 bp + SPRINT4-RECETTE.md livré.

---

## 2. Acquis Sprint 1-3 réutilisés

| Acquis | Localisation | Usage Sprint 4 |
|---|---|---|
| `Site.isOccupied` | [veille-app/prisma/schema.prisma](veille-app/prisma/schema.prisma) | Détermine la fréquence planifiée (180 vs 365) |
| Constantes cadences | [veille-app/src/lib/today/constants.ts](veille-app/src/lib/today/constants.ts) | `QUARTERLY_VISIT_DAYS`, `OCCUPIED_PLANNED_VISIT_DAYS`, `UNOCCUPIED_PLANNED_VISIT_DAYS`, `URGENCY_THRESHOLDS` |
| `classifyVisitTemplateSlug`, `visitFrequencyDays` | idem | Classification trim / plan / other + fréquence |
| `computeSiteVisitStatus`, `fetchSitesWithRecentVisits` | [veille-app/src/lib/today/sources.ts](veille-app/src/lib/today/sources.ts) | Source visites (réécrit pour double cadence en S3-C4) |
| `getOpenActions`, `getExpiringEquipments` | idem | Sources actions / équipements |
| Scopes `teamScope`, `siteScope`, `agentScope`, `actionScope` | [veille-app/src/lib/auth.ts](veille-app/src/lib/auth.ts) | Strictement réutilisés, jamais contournés |
| `topItems`, `scoreItem`, `sortItems`, `classifyUrgency` | [veille-app/src/lib/today/priority.ts](veille-app/src/lib/today/priority.ts) | Réutilisés pour le scoring secondaire au sein d'un groupe d'urgence |
| `calendarDaysBetween` | [veille-app/src/lib/today/mappers.ts](veille-app/src/lib/today/mappers.ts) | Calcul jours restants / dépassés |
| `TeamActivity` | [veille-app/prisma/schema.prisma](veille-app/prisma/schema.prisma) | Lecture uniquement (lien éventuel depuis ligne d'échéance) |
| Composants UI `KpiCard`, `KpiSection`, `WatchlistRow`, `EmptyState` | [veille-app/src/app/(app)/today/components/](veille-app/src/app/(app)/today/components/) | Réutilisés ou copiés-adaptés |
| Pattern feature flag | [veille-app/src/lib/featureFlags.ts](veille-app/src/lib/featureFlags.ts) | `ENABLE_ECHEANCES` (default true) sur le même modèle que `ENABLE_TODAY` |
| `min-h-dvh` + safe-area | [veille-app/src/components/AppShell.tsx](veille-app/src/components/AppShell.tsx) | Layout safe par défaut |

**Aucun acquis n'est à refondre.** Le Hub est une *vue agrégée* — pas un nouveau domaine métier.

---

## 3. Rappel des règles métier (memory/business-rules.md)

| Règle | Valeur | Source |
|---|---|---|
| Visite trimestrielle | 90 j *tous sites* (occupé et inoccupé) | PO 2026-06-12 |
| Visite planifiée site **occupé** | 180 j | PO 2026-06-12 |
| Visite planifiée site **inoccupé** | 365 j | PO 2026-06-12 |
| Action en retard | `dueAt < now - 7 j` (seuil watchlist EDITOR) | Sprint 2 |
| Équipement expirant | `expirationDate ≤ now + 30 j` | Sprint 1 |
| Échéance « aujourd'hui » | `|jours| ≤ 2` | `URGENCY_THRESHOLDS.todayMaxDays` |
| Échéance « bientôt » | `≤ 7 j` | `URGENCY_THRESHOLDS.soonMaxDays` |
| Échéance « plus tard » | `≤ 30 j` | `URGENCY_THRESHOLDS.laterMaxDays` |
| Cadences indépendantes | Un site peut être en retard sur trim ET plan séparément | C4 Sprint 3 |
| Multi-équipes | `SiteTeam` (M-N), au moins 1 équipe par site | C5 Sprint 3 |
| Audio / vocal / IA vocale | **ABANDONNÉ DÉFINITIVEMENT** | PO 2026-06-14 |
| Notifications push / email | Hors périmètre V2 | PO 2026-06-14 |

---

## 4. User Stories Sprint 4

### US-4.1 — Visualisation pivot des échéances
> **En tant qu'**EDITOR (ou ADMIN), **je veux** voir, en un seul écran, toutes les échéances dépassées ou imminentes de mon périmètre, **afin de** prioriser mon pilotage.

**Critères d'acceptation** :
- L'écran affiche au moins 4 KPI de tête : « En retard », « Aujourd'hui », « < 7 jours », « < 30 jours ».
- Les échéances sont listées en sections regroupées par urgence (cf. D3).
- Chaque ligne affiche : type (visite trim / visite plan / équipement / action), libellé court, contexte (site et/ou agent), jours restants ou dépassés, CTA.
- Si zéro échéance dans un groupe : `EmptyState` discret (« Rien à signaler »).
- Tri secondaire intra-groupe : par date d'échéance ASC (le plus en retard / le plus proche en premier).

### US-4.2 — Filtrage rapide
> **En tant qu'**EDITOR, **je veux** filtrer le Hub par type, par site ou par urgence, **afin de** zoomer sur un sous-ensemble.

**Critères d'acceptation** :
- 3 filtres : type (visite / équipement / action — chips), site (dropdown ou recherche), urgence (chips).
- Filtres combinables (AND).
- État du filtre persisté dans l'URL (`?type=visit&siteId=…`) pour partage / bookmark.
- Bouton « Réinitialiser » remet à zéro.

### US-4.3 — Lien naturel depuis Today
> **En tant qu'**EDITOR, **je veux** rebondir depuis Today EDITOR vers le Hub, **afin de** ne pas perdre de temps si je veux la vue large.

**Critères d'acceptation** :
- Deux entrées dans Today EDITOR : une sous le diagnostic (« Voir toutes les échéances ») et une sous la watchlist Sites (« Voir échéances par site »).
- Pré-filtrage cohérent à l'arrivée sur le Hub (ex. depuis watchlist Sites → `?type=visit`).

### US-4.4 — Drilldown depuis un site
> **En tant qu'**EDITOR consultant `/sites/[id]`, **je veux** voir les échéances spécifiques à ce site, **afin de** préparer une visite.

**Critères d'acceptation** :
- Section dédiée sur la page site (ou onglet, cf. D9) : toutes les échéances scope `siteId`.
- Cadences trim et plan visibles avec « Prochaine visite trim : dans X j » / « En retard de Y j ».
- Lien retour vers le Hub avec filtre site appliqué.

### US-4.5 — CTA contextuels
> **En tant qu'**EDITOR, **je veux** agir directement depuis le Hub, **afin de** ne pas multiplier les clics.

**Critères d'acceptation** :
- CTA primaire par ligne, contextualisé :
  - visite → « Planifier » (`/visits/new?siteId=…&templateSlug=…`)
  - équipement → « Voir équipement » (page site, section équipements)
  - action → « Voir action » (`/agents/[id]?actionId=…`)
- CTA secondaire au tap long ou icône « plus » : « Marquer effectué » (V1.5, hors périmètre V1 par défaut).

### US-4.6 — Performance
> **En tant que** mainteneur, **je veux** que le Hub charge en < 500 ms en SSR pour 200 échéances actives, **afin de** rester usable.

**Critères d'acceptation** :
- Agrégateur exécute 3 requêtes Prisma en `Promise.all` (visites / équipements / actions).
- Pas de N+1 — `include` minimaliste (site `name`/`code`/`isOccupied`, agent `firstName`/`lastName`, template `slug`/`name`).
- Cache HTTP `private, max-age=30` côté payload (modèle déjà utilisé pour `/api/today`).
- Test perf Vitest avec dataset de 200 échéances (~< 100 ms agrégation pure).

### US-4.7 — Recette + DoD
> **En tant que** PO, **je veux** un document `SPRINT4-RECETTE.md` qui valide chaque US et liste les réserves, **afin de** décider la mise en prod.

---

## 5. Détail par commit

### Commit 1 — S4-DOC : arbitrages PO et plan détaillé (no-code)

#### Périmètre précis
Valider avec le PO les 12 lignes D1-D12. Si certaines lignes sont arbitrées différemment, mettre à jour ce document avant d'attaquer C2.

#### Fichiers concernés
- [SPRINT4-PLAN.md](SPRINT4-PLAN.md) — mise à jour des arbitrages

#### Dépendances
- Aucune.

#### Risques
| # | Risque | Mitigation |
|---|---|---|
| R1.1 | Arbitrages D9 / D11 inversés ↦ reprise de C8-C9 | Demander explicitement ; bloquer C8 / C9 tant que non validé |

#### Tests à réaliser
- Aucun (no-code).

#### Estimation
**1-2 h** (S).

---

### Commit 2 — S4-01 : types `EcheanceItem` + helpers urgence + tests Vitest

#### Périmètre précis
Modéliser la *donnée pivot* du Hub. Tout le reste (sources, agrégateur, UI) consommera ce type.

```ts
// veille-app/src/lib/echeances/types.ts (esquisse)
export type EcheanceKind =
  | "VISIT_QUARTERLY"
  | "VISIT_PLANNED"
  | "EQUIPMENT_EXPIRING"
  | "ACTION_OVERDUE";

export type EcheanceUrgency = "late" | "today" | "soon" | "later";

export type EcheanceItem = {
  id: string;                  // `${kind}:${sourceId}`
  kind: EcheanceKind;
  title: string;               // libellé court (« Trimestrielle » / « Extincteur EXT-12 »)
  subtitle?: string;           // contexte secondaire
  dueAt: Date | null;          // null = jamais (visite jamais effectuée)
  daysToDue: number | null;    // < 0 = en retard
  urgency: EcheanceUrgency;
  context: {
    siteId?: string;
    siteName?: string;
    siteIsOccupied?: boolean;
    agentId?: string;
    agentName?: string;
    teamIds: string[];         // pour scope check
  };
  cta: { label: string; href: string };
};
```

Helpers purs :
- `classifyEcheanceUrgency(daysToDue: number | null): EcheanceUrgency` (réutilise `URGENCY_THRESHOLDS`).
- `groupByUrgency(items): Record<EcheanceUrgency, EcheanceItem[]>`.
- `sortByDueAt(items): EcheanceItem[]` (ASC, null en queue ou en tête selon convention).

#### Fichiers concernés
- `veille-app/src/lib/echeances/types.ts` (nouveau)
- `veille-app/src/lib/echeances/urgency.ts` (nouveau)
- `veille-app/src/lib/echeances/urgency.test.ts` (nouveau, 12-15 tests minimum)

#### Dépendances
- `URGENCY_THRESHOLDS` (déjà en place).

#### Risques
| # | Risque | Mitigation |
|---|---|---|
| R2.1 | Doublon avec `TodoItem` (today) | Convention claire : `TodoItem` = items *à faire aujourd'hui*, `EcheanceItem` = items *avec date d'échéance future ou passée*. Pas de fusion en V1. |
| R2.2 | `dueAt = null` (jamais visité) traité comme « plus tard » | Spec : `null` → urgence `late` (jamais visité = problématique pour visites). Test explicite. |

#### Tests à réaliser
- `classifyEcheanceUrgency`: 6 cas (très en retard, en retard limite, aujourd'hui ±2, < 7 j, < 30 j, > 30 j, null).
- `groupByUrgency`: 3 cas (vide, mono-groupe, multi-groupes).
- `sortByDueAt`: stable, null en queue, dates équivalentes.

#### Estimation
**5-7 h** (M).

---

### Commit 3 — S4-02 : sources Prisma unifiées (fan-out 3 types)

#### Périmètre précis
Trois sources scopées qui produisent chacune une liste d'`EcheanceItem`. Réutilisent les helpers Sprint 2-3 sans les modifier.

```ts
// veille-app/src/lib/echeances/sources.ts
export async function getVisitEcheances(user, now): Promise<EcheanceItem[]>
export async function getEquipmentEcheances(user, now): Promise<EcheanceItem[]>
export async function getActionEcheances(user, now): Promise<EcheanceItem[]>
```

- `getVisitEcheances` : pour chaque site du périmètre, calcule trim et plan via `computeSiteVisitStatus` (déjà en place). Renvoie 0, 1 ou 2 items par site.
- `getEquipmentEcheances` : extension de `getExpiringEquipments` pour inclure aussi les équipements *déjà périmés* (pas seulement à venir).
- `getActionEcheances` : extension de `getOpenActions`, inclure toutes les actions avec `dueAt` non null (pas seulement les en retard 7 j+).

#### Fichiers concernés
- `veille-app/src/lib/echeances/sources.ts` (nouveau)
- `veille-app/src/lib/echeances/sources.test.ts` (nouveau — tests d'intégration avec base in-memory si possible, sinon mock Prisma)

#### Dépendances
- C2 (types).
- Sources `today/sources.ts` (lecture).

#### Risques
| # | Risque | Mitigation |
|---|---|---|
| R3.1 | N+1 sur les sites (1 requête par site pour compter visites) | Une seule requête `siteVisit.findMany` filtrée par `siteId IN [...]` + groupBy côté JS |
| R3.2 | Volume actions important (centaines) | Pagination Prisma `take: 500` + warn log si plus |
| R3.3 | `expirationDate = null` côté équipement | Skip (équipement non périssable) |

#### Tests à réaliser
- Vitest avec 1 site occupé + 1 site inoccupé + 3 équipements + 5 actions → vérifier les counts par kind.
- Cas sans visite → urgence `late`.

#### Estimation
**8-10 h** (L).

---

### Commit 4 — S4-03 : route `/api/echeances` + agrégateur

#### Périmètre précis
Route SSR `/api/echeances` qui appelle les 3 sources en parallèle, dédoublonne si nécessaire, applique filtres, renvoie un payload typé.

```ts
// veille-app/src/lib/echeances/aggregator.ts
export async function aggregateEcheances(
  user: SessionUser,
  now: Date,
  filters?: { type?: EcheanceKind[]; siteId?: string; urgency?: EcheanceUrgency[] },
): Promise<EcheancesPayload>
```

`EcheancesPayload` :
- `now: ISOString`
- `kpis: { late, today, soon, later }`
- `groups: Record<EcheanceUrgency, EcheanceItem[]>`
- `total: number`
- `filtersApplied: {...}`

Route handler (`src/app/api/echeances/route.ts`) :
- `requireUser`
- Rejet si role=USER (cf. D2)
- Parse query string `?type=…&siteId=…&urgency=…`
- Appelle `aggregateEcheances`
- Cache header `Cache-Control: private, max-age=30`

#### Fichiers concernés
- `veille-app/src/lib/echeances/aggregator.ts` (nouveau)
- `veille-app/src/lib/echeances/aggregator.test.ts` (nouveau)
- `veille-app/src/app/api/echeances/route.ts` (nouveau)
- `veille-app/src/lib/featureFlags.ts` (ajout `isEcheancesEnabled()`)

#### Dépendances
- C2 + C3.

#### Risques
| # | Risque | Mitigation |
|---|---|---|
| R4.1 | Filtres incompatibles ↦ payload vide trompeur | `filtersApplied` reflète l'état réel ; UI affiche EmptyState explicite (« Aucune échéance avec ces filtres ») |
| R4.2 | USER tente d'accéder ↦ 403 | Test explicite ; pas de fuite côté Today (le lien Today vers Hub n'apparaît que pour EDITOR / ADMIN) |

#### Tests à réaliser
- Tests Vitest agrégateur avec 3 mocks de sources.
- Test handler : 200 EDITOR, 403 USER, 401 sans auth.

#### Estimation
**6-8 h** (M).

---

### Commit 5 — S4-04 : UI Hub V1 (KPI + liste groupée par urgence)

#### Périmètre précis
Page `src/app/(app)/echeances/page.tsx` + composants. SSR, mobile-first.

Layout :
```
+------------------------------------------------+
|  ÉCHÉANCES                                      |
|  N actives sur mon périmètre                    |
+------------------------------------------------+
|  [KPI x4 : en retard / aujourd'hui / <7j / <30j]|
+------------------------------------------------+
|  EN RETARD (X)                                  |
|  [EcheanceRow x ...]                            |
|  AUJOURD'HUI (Y)                                |
|  [EcheanceRow x ...]                            |
|  < 7 JOURS                                      |
|  [EcheanceRow x ...]                            |
|  < 30 JOURS                                     |
|  [EcheanceRow x ...]                            |
+------------------------------------------------+
```

Composants :
- `EcheancesHeader.tsx` — titre + counts globaux + filtres compacts (vides en C5)
- `EcheancesKpiBar.tsx` — 4 `KpiCard` réutilisés
- `EcheanceGroup.tsx` — section par urgence (titre + couleur)
- `EcheanceRow.tsx` — ligne unitaire (icône kind, titre, subtitle, jours, CTA)

#### Fichiers concernés
- `veille-app/src/app/(app)/echeances/page.tsx` (nouveau)
- `veille-app/src/app/(app)/echeances/components/EcheancesHeader.tsx`
- `veille-app/src/app/(app)/echeances/components/EcheancesKpiBar.tsx`
- `veille-app/src/app/(app)/echeances/components/EcheanceGroup.tsx`
- `veille-app/src/app/(app)/echeances/components/EcheanceRow.tsx`
- `veille-app/src/components/AppShell.tsx` — ajout entrée nav « Échéances » (icône calendrier)

#### Dépendances
- C4 (route + agrégateur).

#### Risques
| # | Risque | Mitigation |
|---|---|---|
| R5.1 | Page « data dump » illisible | Hiérarchie typo claire (groupe = h2 majuscule, ligne compacte 56 px) + couleurs urgence cohérentes avec Today |
| R5.2 | Overflow horizontal mobile 320 px | Pattern `min-w-0 break-words` + audit responsive intégré |
| R5.3 | Nav grows à 7 entrées sur mobile | Conditionnel : seul EDITOR / ADMIN voit l'entrée. USER reste à 6. |

#### Tests à réaliser
- Preview MCP 320 / 375 / 768 / desktop : aucun overflow.
- Snapshot tests sur Group + Row.

#### Estimation
**10-14 h** (L).

---

### Commit 6 — S4-05 : filtres type / site / urgence + URL search

#### Périmètre précis
Trois filtres synchronisés avec l'URL. Re-fetch SSR au changement (Next App Router).

- Chips type : `[Visites] [Équipements] [Actions]` — multi-sélection.
- Dropdown site : recherche dans le périmètre, max 50 affichés.
- Chips urgence : `[En retard] [Aujourd'hui] [< 7j] [< 30j]` — multi-sélection.
- Bouton « Réinitialiser » si au moins un filtre actif.

#### Fichiers concernés
- `veille-app/src/app/(app)/echeances/components/EcheancesFilters.tsx`
- `veille-app/src/app/(app)/echeances/page.tsx` (lecture `searchParams`)
- `veille-app/src/lib/echeances/aggregator.ts` (filtres déjà supportés C4)

#### Dépendances
- C5.

#### Risques
| # | Risque | Mitigation |
|---|---|---|
| R6.1 | URL longue / état perdu au reload | `useSearchParams` + `router.replace({ query })` |
| R6.2 | Dropdown site avec 200+ sites lent | Recherche client-side après preload, ou Combobox virtualisé |

#### Tests à réaliser
- Filtre type=visit&urgency=late → liste cohérente avec payload filtré.
- Reload de la page : filtres conservés.

#### Estimation
**6-8 h** (M).

---

### Commit 7 — S4-06 : lien depuis Today EDITOR

#### Périmètre précis
Deux entrées dans `EditorDashboard.tsx` :
- Sous `DiagnosticBanner` : bouton « Voir toutes les échéances » → `/echeances`
- Sous `WatchlistSection title="Sites à visiter"` : bouton « Tout sur le pilotage » → `/echeances?type=visit`

#### Fichiers concernés
- `veille-app/src/app/(app)/today/components/EditorDashboard.tsx`

#### Dépendances
- C4 (route existe).

#### Risques
| # | Risque | Mitigation |
|---|---|---|
| R7.1 | Today devient « trop chargé » | Boutons discrets, secondaires (link styling) — pas de bouton primaire |

#### Tests à réaliser
- Preview Today EDITOR : présence des 2 liens.
- Click → arrivée sur `/echeances` avec filtre approprié.

#### Estimation
**2-3 h** (S).

---

### Commit 8 — S4-07 : drilldown — section échéances sur `/sites/[id]`

#### Périmètre précis
Ajout d'une section « Échéances » sur `/sites/[id]/page.tsx` (avant ou après la section sightings, à arbitrer en C5).

- Réutilise `EcheanceRow` (composant exporté en C5).
- Pré-charge via `getEcheancesForSite(user, siteId, now)` — fonction tirée de `sources.ts` (filtre `siteId`).
- Lien retour vers Hub : « Tout voir → `/echeances?siteId=…` ».

Si D9 = page dédiée plutôt qu'onglet : créer `src/app/(app)/sites/[id]/echeances/page.tsx` à la place.

#### Fichiers concernés
- `veille-app/src/app/(app)/sites/[id]/page.tsx` (modif)
- `veille-app/src/lib/echeances/sources.ts` (ajout `getEcheancesForSite`)

#### Dépendances
- C3 (sources).
- C5 (`EcheanceRow` export).

#### Risques
| # | Risque | Mitigation |
|---|---|---|
| R8.1 | Page site déjà longue ↦ scroll fatiguant | Section accordion repliée par défaut si > 5 échéances |
| R8.2 | Performance page site dégrade | `Promise.all` avec autres fetchers existants |

#### Tests à réaliser
- Page site avec 0 / 1 / N échéances.
- Click → Hub filtré.

#### Estimation
**8-10 h** (M).

---

### Commit 9 — S4-08 : CTA contextuels + perf + responsive final

#### Périmètre précis
- CTA primaire par ligne d'`EcheanceRow` (cf. US-4.5).
- Audit perf : 200 échéances mockées → temps SSR < 500 ms (mesure via `console.time` ou middleware).
- Audit responsive : preview 320 / 375 / 768 / desktop.
- Polish : skeleton loader, EmptyState par groupe, transitions douces filtres.

#### Fichiers concernés
- `veille-app/src/app/(app)/echeances/components/EcheanceRow.tsx`
- `veille-app/src/app/(app)/echeances/page.tsx`

#### Dépendances
- C5-C8.

#### Risques
| # | Risque | Mitigation |
|---|---|---|
| R9.1 | CTA mal calibrés (action non pertinente) | Mapping `kind → href` figé dans une table de routage, testé unitairement |

#### Tests à réaliser
- Vitest perf agrégateur < 100 ms sur dataset 200.
- Preview MCP 4 bp + screenshots.
- Test CTA navigation correcte par kind.

#### Estimation
**6-8 h** (M).

---

### Commit 10 — S4-RECETTE : tests E2E + SPRINT4-RECETTE.md

#### Périmètre précis
Reproduire la grille Sprint 3 :
- Scénarios par US (4.1 → 4.7).
- Tests cadences (déjà en place) + dataset Hub réel.
- Tests sécurité (USER 403, EDITOR voit son périmètre, ADMIN voit tout).
- Responsive 4 bp.
- Réserves / dette / risques de déploiement / actions pré-prod.

#### Fichiers concernés
- `SPRINT4-RECETTE.md` (nouveau)
- `veille-app/scripts/sprint4-recette-fixtures.ts` (nouveau)
- `veille-app/scripts/sprint4-recette-asserts.ts` (nouveau)
- `veille-app/scripts/sprint4-recette-cleanup.ts` (nouveau)

#### Dépendances
- Tout le reste.

#### Risques
| # | Risque | Mitigation |
|---|---|---|
| R10.1 | Découverte tardive d'un bug bloquant | Démos hebdo (cf. §1.3) pour ne rien laisser jusqu'en C10 |

#### Tests à réaliser
- Idem Sprint 3 C10 : couverture par US + axes transverses.

#### Estimation
**6-8 h** (M).

---

## 6. Estimation globale

| Commit | Estimation min | Estimation max |
|---|---|---|
| C1 DOC | 1 | 2 |
| C2 Types | 5 | 7 |
| C3 Sources | 8 | 10 |
| C4 Route | 6 | 8 |
| C5 UI V1 | 10 | 14 |
| C6 Filtres | 6 | 8 |
| C7 Lien Today | 2 | 3 |
| C8 Drilldown | 8 | 10 |
| C9 Polish | 6 | 8 |
| C10 Recette | 6 | 8 |
| **Total** | **58 h** | **78 h** |

Capacité Sprint : 75 h. Marge confortable.

---

## 7. Risques globaux Sprint 4

| # | Risque | Probabilité | Sévérité | Mitigation |
|---|---|---|---|---|
| RG1 | Performances dégradées sur volumes importants (>500 échéances) | moyenne | moyenne | Pagination « Voir plus » + cache `private, max-age=30` + index Prisma vérifiés |
| RG2 | Double affichage avec Today crée confusion | moyenne | moyenne | UX claire : Today = tournée du jour, Hub = pilotage. Liens explicites entre les deux. |
| RG3 | Arbitrages D1-D12 changés tardivement | basse | élevée | Bloquer C5+ tant que les D les concernant ne sont pas figées |
| RG4 | Régression sur la page `/sites/[id]` (drilldown C8) | basse | moyenne | Tests preview ciblés ; section accordion |
| RG5 | Filtres URL trop verbeux (UX bookmark) | basse | basse | Format compact `?t=v,e&u=late,today&s=…` |
| RG6 | USER demande accès au Hub avant Sprint 5 | moyenne | basse | Argumentaire D2 documenté ; pivotable rapidement (1 ligne de feature flag) |
| RG7 | Performance N+1 dans `getVisitEcheances` | moyenne | moyenne | Une seule requête `siteVisit.findMany` groupée par `siteId` (cf. R3.1) |
| RG8 | Migration `cadenceType` réclamée en cours de sprint | basse | moyenne | Refus poli : argumenter via D7. Si vraiment requis, créer un commit dédié hors C2-C10. |

---

## 8. Critères de succès / DoD Sprint 4

Pour considérer Sprint 4 livré :
1. Hub Échéances accessible en `/echeances` pour EDITOR + ADMIN.
2. 3 types d'échéances couverts (visites trim + plan, équipements, actions).
3. Filtres type / site / urgence opérationnels avec URL search persistante.
4. Liens depuis Today EDITOR et depuis `/sites/[id]`.
5. CTA primaire par ligne (planifier visite / voir équipement / voir action).
6. Responsive 320 / 375 / 768 / desktop sans overflow.
7. Vitest verts (cible ≥ 110 tests, +14-20 vs Sprint 3 = 96).
8. SPRINT4-RECETTE.md livré.
9. Aucune régression sur `/today`, `/sites/[id]`, `/agents/[id]`, photos, admin.
10. Aucune fonctionnalité audio.

---

## 9. Hors périmètre Sprint 4

Explicitement **hors** scope, à arbitrer Sprint 5+ :
- Notifications push, email, SMS, centre de notifications.
- Audio, IA vocale, reconnaissance.
- Vue calendrier mois (cf. D12).
- Drag-and-drop pour replanifier visites.
- Mode hors ligne enrichi pour le Hub (lecture cache uniquement).
- Création d'événement `ECHEANCE_DEPASSEE` dans TeamActivity (cf. D6).
- Champ `cadenceType` explicite sur `SiteVisitTemplate` (cf. D7).
- Action de masse (« marquer plusieurs comme effectués »).
- Export PDF du Hub.
- Hub accessible aux USER (cf. D2).

---

## 10. Validation et démarrage

Une fois D1-D12 arbitrés par le PO, je démarre par **C2** (C1 étant ce document). Démos hebdo à la fin de chaque semaine — fenêtre de validation/correction immédiate.

**Avant tout commit code** : confirmer D1-D12 explicitement.
