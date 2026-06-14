# SPRINT4-PLAN.md — Plan d'exécution Sprint 4

> **Périmètre** : livrer le **Hub Échéances** — vue centralisée des visites en retard ou à venir, équipements expirants et actions à échoir, sur tout le périmètre de l'utilisateur.
> **Date** : 2026-06-14.
> **Sprint** : Sprint 4 (~75 h de capacité solo + IA).
> **Documents amont** : [memory/business-rules.md](memory/business-rules.md), [memory/decisions.md](memory/decisions.md), [SPRINT3-RECETTE.md](SPRINT3-RECETTE.md), [TODAY-V1.md](TODAY-V1.md).

---

## 0. Décisions PO validées (2026-06-14)

| # | Sujet | Décision retenue |
|---|---|---|
| D1 | URL du Hub | **Route séparée `/echeances`** |
| D2 | Périmètre rôle V1 | **EDITOR + ADMIN** (USER reste sur `/today`) |
| D3 | Groupement principal | **5 groupes** : En retard / Aujourd'hui / Dans les 7 jours / Dans les 30 jours / **Plus tard** |
| D4 | Échéances couvertes V1 | **3 types** : visites (trim + plan), équipements (expirants ou déjà périmés), actions ouvertes |
| D5 | Filtres V1 | **4 filtres** : Type, Site, **Équipe**, Urgence |
| D6 | Event `ECHEANCE_DEPASSEE` dans TeamActivity | **Refusé V1** — le flux d'activité reste pour les actions humaines |
| D7 | Champ `cadenceType` explicite | **Refusé V1** — conserver la convention slug `trimestrielle-*` / `planifiee-*` |
| D8 | Pagination | **Voir plus** par batch de 25 (initial = 25) |
| D9 | Drilldown site | **Section « Échéances du site » ajoutée à `/sites/[id]`** (visite trim, plan, équipements, actions) |
| D10 | Liens depuis Today | **2 liens** sous Diagnostic + Watchlist sites **+ indicateur « X échéances critiques »** → `/echeances?urgency=critical` |
| D11 | CTA contextuels | **Lecture seule** : Visite → ouvrir le site · Action → valider/ouvrir · Équipement → voir le site |
| D12 | Vue calendrier mois | **Refusée V1** |
| D13 | Notion **transverse** de « critique » | Voir §0.2 — réutilisable Hub, Today, futurs dashboards |

---

## 0.2 D13 — Définition transverse de « critique »

Une **échéance critique** est une échéance qui mérite une réaction immédiate, plus stricte que la simple « urgence ». Définition retenue par le PO :

| Type | Critère « critique » |
|---|---|
| **Action** | Retard > 7 jours (`dueAt < now - 7 j`) |
| **Visite trimestrielle** | Retard > 30 jours (`finishedAt < now - (90+30) j` OU jamais et site existant depuis > 90+30 j) |
| **Visite planifiée occupée** | Retard > 30 jours (`finishedAt < now - (180+30) j`) |
| **Visite planifiée inoccupée** | Retard > 30 jours (`finishedAt < now - (365+30) j`) |
| **Équipement** | Déjà expiré (`expirationDate < now`) |

Cette notion est exposée par un helper centralisé `isCriticalEcheance(item)` (cf. C2), réutilisable :
- Compteur Today EDITOR (« X échéances critiques »).
- KPI dédié dans le Hub Échéances.
- Filtre URL `/echeances?urgency=critical`.
- Futurs dashboards et éventuelles notifications V2+.

Chaque `EcheanceItem` porte un champ booléen `isCritical` calculé à l'agrégation, pour éviter le recalcul côté UI.

---

## 0.3 Contraintes assumées

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

Ordre PO validé : **navigation utile rapidement**, filtres avancés en fin de sprint.

```
SEMAINE 1 — Fondations data (14-18 h)
  C1  S4-DOC : plan détaillé + arbitrages PO intégrés          déjà fait
  C2  S4-01  : types EcheanceItem + helpers urgence + critique + tests
                                                               6-8 h
  C3  S4-02  : sources Prisma unifiées (fan-out 3 types)       8-10 h

SEMAINE 2 — Route et UI minimale (16-22 h)
  C4  S4-03  : route /echeances + agrégateur + payload typé    6-8 h
  C5  S4-04  : UI Hub Échéances V1 (KPI + 5 groupes urgence)   10-14 h
       → Démo : Hub visible et lisible, sans filtres

SEMAINE 3 — Liens, filtres et drilldown (16-21 h)
  C7  S4-06  : liens Today EDITOR + indicateur « X critiques » 3-4 h
  C6  S4-05  : filtres type / site / équipe / urgence + URL    7-9 h
  C8  S4-07  : drilldown — section « Échéances du site »       8-10 h
       → Démo : flux complet Today → Hub → Site

SEMAINE 4 — Polish + recette (12-16 h)
  C9  S4-08  : CTA lecture seule + perf + responsive           6-8 h
  C10 S4-RECETTE : tests E2E + SPRINT4-RECETTE.md              6-8 h
```

**Total brut** : 58-77 h.
**Effort net solo + IA estimé** : ~55-70 h.
**Capacité Sprint 4** : 75 h.
**Marge** : ~5-20 h selon scope final et arbitrages D1-D12.

### 1.2 Dépendances entre commits

```
C1 (DOC)   ─── préalable validation PO (validé)

C2 (types) ─→ C3 (sources)
            └→ C4 (agrégateur)
            └→ C7 (compteur « critiques » dans Today)

C3 (sources) ─→ C4 (agrégateur)
              └→ C8 (drilldown réutilise getEcheancesForSite)

C4 (route)  ─→ C5 (UI)
            ─→ C7 (lien Today vers Hub)
            ─→ C6 (filtres)

C5 (UI)     ─→ C6 (filtres greffent sur la liste)
            ─→ C9 (polish s'appuie sur la liste)

C7 (lien)   ─── peut démarrer dès C4 (indicateur critique = compteur agrégé)

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
> **En tant qu'**EDITOR, **je veux** filtrer le Hub par type, par site, par équipe ou par urgence, **afin de** zoomer sur un sous-ensemble.

**Critères d'acceptation** :
- 4 filtres : type (chips), site (dropdown ou recherche), **équipe (chips ou dropdown)**, urgence (chips — 5 valeurs).
- Filtres combinables (AND).
- État du filtre persisté dans l'URL (`?type=visit&siteId=…&teamId=…&urgency=late,today`) pour partage / bookmark.
- Bouton « Réinitialiser » remet à zéro.
- Valeur spéciale `?urgency=critical` (cf. D13) filtre sur les échéances critiques transversalement (action >7 j, visite >30 j, équipement périmé).

### US-4.3 — Lien naturel depuis Today
> **En tant qu'**EDITOR, **je veux** rebondir depuis Today EDITOR vers le Hub, **afin de** ne pas perdre de temps si je veux la vue large.

**Critères d'acceptation** :
- Deux entrées dans Today EDITOR : une sous le diagnostic (« Voir toutes les échéances ») et une sous la watchlist Sites (« Voir échéances par site »).
- Pré-filtrage cohérent à l'arrivée sur le Hub (ex. depuis watchlist Sites → `?type=visit`).
- **Indicateur de synthèse** « X échéances critiques » (cf. D13) en tête de la zone EDITOR, cliquable → `/echeances?urgency=critical`. Couleur rouge si X > 0, neutre sinon.

### US-4.4 — Drilldown depuis un site
> **En tant qu'**EDITOR consultant `/sites/[id]`, **je veux** voir les échéances spécifiques à ce site, **afin de** préparer une visite.

**Critères d'acceptation** :
- Section dédiée sur la page site (ou onglet, cf. D9) : toutes les échéances scope `siteId`.
- Cadences trim et plan visibles avec « Prochaine visite trim : dans X j » / « En retard de Y j ».
- Lien retour vers le Hub avec filtre site appliqué.

### US-4.5 — CTA lecture seule (D11)
> **En tant qu'**EDITOR, **je veux** rebondir vers la page concernée depuis chaque échéance, **afin de** consulter et traiter dans l'écran adapté.

**Critères d'acceptation** :
- CTA primaire par ligne, **lecture seule** (pas d'édition dans la liste) :
  - **Visite** → « Ouvrir le site » (`/sites/[siteId]`)
  - **Action** → « Valider » ou « Ouvrir » (`/agents/[agentId]?actionId=…`)
  - **Équipement** → « Voir le site » (`/sites/[siteId]`, ancre équipement si possible)
- Mapping `kind → href` testé unitairement en C9.
- Pas de tap-long, pas de marquage effectué inline (V2+).

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

### Commit 1 — S4-DOC : plan détaillé + arbitrages PO intégrés (no-code) — **fait**

Plan validé par le PO le 2026-06-14. 12 lignes D1-D12 tranchées, **D13** ajoutée (notion transverse de « critique »). Ordre des commits ajusté : C7 avant C6.

---

### Commit 2 — S4-01 : types `EcheanceItem` + helpers urgence/critique + tests Vitest

#### Périmètre précis
Modéliser la *donnée pivot* du Hub. Tout le reste (sources, agrégateur, UI) consommera ce type. Inclut la notion D13 « critique ».

```ts
// veille-app/src/lib/echeances/types.ts (esquisse)
export type EcheanceKind =
  | "VISIT_QUARTERLY"
  | "VISIT_PLANNED"
  | "EQUIPMENT_EXPIRING"
  | "ACTION_OVERDUE";

// 5 groupes (D3) — tri ASC par urgence implicite via cet ordre.
export type EcheanceUrgency = "late" | "today" | "soon" | "later" | "future";

export type EcheanceItem = {
  id: string;                  // `${kind}:${sourceId}`
  kind: EcheanceKind;
  title: string;               // libellé court (« Trimestrielle » / « Extincteur EXT-12 »)
  subtitle?: string;           // contexte secondaire
  dueAt: Date | null;          // null = jamais (visite jamais effectuée)
  daysToDue: number | null;    // < 0 = en retard
  urgency: EcheanceUrgency;
  /** D13 — critique selon le critère typé par `kind` */
  isCritical: boolean;
  context: {
    siteId?: string;
    siteName?: string;
    siteIsOccupied?: boolean;
    agentId?: string;
    agentName?: string;
    teamIds: string[];         // pour scope check + filtre équipe (D5)
  };
  cta: { label: string; href: string };
};
```

Helpers purs :
- `classifyEcheanceUrgency(daysToDue: number | null): EcheanceUrgency` — réutilise `URGENCY_THRESHOLDS`, `null` ou `< 0` → `late`, `≤ 2` → `today`, `≤ 7` → `soon`, `≤ 30` → `later`, sinon `future`.
- `isCriticalEcheance(item: Pick<EcheanceItem, "kind"|"daysToDue">): boolean` — applique D13 :
  - `ACTION_OVERDUE` critique si `daysToDue < -7`
  - `VISIT_QUARTERLY` critique si `daysToDue < -30` (toujours par rapport à la date de prochaine échéance)
  - `VISIT_PLANNED` critique si `daysToDue < -30`
  - `EQUIPMENT_EXPIRING` critique si `daysToDue < 0` (déjà expiré)
- `groupByUrgency(items): Record<EcheanceUrgency, EcheanceItem[]>`.
- `sortByDueAt(items): EcheanceItem[]` — ASC, `null` en tête (cas « jamais »).

#### Fichiers concernés
- `veille-app/src/lib/echeances/types.ts` (nouveau)
- `veille-app/src/lib/echeances/urgency.ts` (nouveau)
- `veille-app/src/lib/echeances/criticality.ts` (nouveau)
- `veille-app/src/lib/echeances/urgency.test.ts` (nouveau, ≥ 8 tests)
- `veille-app/src/lib/echeances/criticality.test.ts` (nouveau, ≥ 7 tests — un par règle D13 + edge cases)

#### Dépendances
- `URGENCY_THRESHOLDS` (déjà en place).

#### Risques
| # | Risque | Mitigation |
|---|---|---|
| R2.1 | Doublon avec `TodoItem` (today) | Convention claire : `TodoItem` = items *à faire aujourd'hui*, `EcheanceItem` = items *avec date d'échéance future ou passée*. Pas de fusion en V1. |
| R2.2 | `dueAt = null` (jamais visité) traité comme « plus tard » | Spec : `null` → urgence `late` (jamais visité = problématique pour visites). Test explicite. |
| R2.3 | « Critique » mal aligné avec urgence | Helpers découplés : `isCritical` n'utilise PAS `urgency`. Un item `late` peut ne pas être critique (action 5 j de retard) et un item `today` ne sera jamais critique. Tests vérifient ce découplage. |

#### Tests à réaliser
- `classifyEcheanceUrgency` : 7 cas (très en retard, exactement -1 j, jour J ±2, 5 j, 28 j, 60 j, null).
- `isCriticalEcheance` : 4 règles D13 × (critique / non critique) = 8 cas.
- `groupByUrgency` : 5 groupes, vide, mono-groupe.
- `sortByDueAt` : stable, null en tête, dates équivalentes.

#### Estimation
**6-8 h** (M).

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
type EcheancesFilters = {
  type?: EcheanceKind[];
  siteId?: string;
  teamId?: string;                          // D5 — filtre équipe
  urgency?: (EcheanceUrgency | "critical")[]; // D13 — valeur spéciale
};

export async function aggregateEcheances(
  user: SessionUser,
  now: Date,
  filters?: EcheancesFilters,
): Promise<EcheancesPayload>
```

`EcheancesPayload` :
- `now: ISOString`
- `kpis: { late, today, soon, later, future, critical }` ← `critical` ajouté D13
- `groups: Record<EcheanceUrgency, EcheanceItem[]>` (5 clés)
- `criticalItems: EcheanceItem[]` (sous-ensemble transverse — pour `?urgency=critical`)
- `total: number`
- `filtersApplied: EcheancesFilters`
- `teamsAvailable: { id: string; name: string }[]` ← pour peupler le dropdown filtre équipe

Route handler (`src/app/api/echeances/route.ts`) :
- `requireUser`
- Rejet si role=USER → **403** (cf. D2)
- Parse query string `?type=…&siteId=…&teamId=…&urgency=…` (urgency peut contenir `critical`)
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

### Commit 5 — S4-04 : UI Hub V1 (KPI + liste 5 groupes urgence)

#### Périmètre précis
Page `src/app/(app)/echeances/page.tsx` + composants. SSR, mobile-first. 5 groupes d'urgence (D3) + KPI critique (D13).

Layout :
```
+--------------------------------------------------+
|  ÉCHÉANCES                                        |
|  N actives sur mon périmètre                      |
+--------------------------------------------------+
|  [KPI x5] critiques / en retard / aujourd'hui /  |
|           < 7 j / < 30 j                          |
+--------------------------------------------------+
|  EN RETARD (X)                                    |
|  [EcheanceRow x ...]                              |
|  AUJOURD'HUI (Y)                                  |
|  [EcheanceRow x ...]                              |
|  DANS LES 7 JOURS                                 |
|  [EcheanceRow x ...]                              |
|  DANS LES 30 JOURS                                |
|  [EcheanceRow x ...]                              |
|  PLUS TARD                                        |
|  [EcheanceRow x ...]                              |
+--------------------------------------------------+
```

Le KPI « critiques » est en première position, accent rouge, cliquable → filtre URL `?urgency=critical`. Les 4 autres KPI suivent l'ordre des groupes.

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

### Commit 6 — S4-05 : filtres type / site / équipe / urgence + URL search

#### Périmètre précis
**4 filtres** synchronisés avec l'URL. Re-fetch SSR au changement (Next App Router).

- Chips type : `[Visites] [Équipements] [Actions]` — multi-sélection.
- Dropdown site : recherche dans le périmètre, max 50 affichés.
- **Chips ou dropdown équipe** (D5) : équipes du périmètre user — multi-sélection si chips.
- Chips urgence : `[Critiques] [En retard] [Aujourd'hui] [< 7j] [< 30j] [Plus tard]` — multi-sélection. `[Critiques]` est un raccourci sémantique distinct (D13).
- Bouton « Réinitialiser » si au moins un filtre actif.

#### Fichiers concernés
- `veille-app/src/app/(app)/echeances/components/EcheancesFilters.tsx`
- `veille-app/src/app/(app)/echeances/page.tsx` (lecture `searchParams`)
- `veille-app/src/lib/echeances/aggregator.ts` (filtres déjà supportés C4)

#### Dépendances
- C5, C7.

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

### Commit 7 — S4-06 : liens Today EDITOR + indicateur critique

#### Périmètre précis
Trois éléments dans `EditorDashboard.tsx` :
- **Indicateur « X échéances critiques »** (D13) placé en tête de la zone EDITOR, juste sous `DiagnosticBanner`. Compte = `payload.criticalCount` lu depuis l'agrégateur via une nouvelle source `getCriticalEcheancesCount(user, now)` (cf. C2/C3). Cliquable → `/echeances?urgency=critical`. Rouge si > 0, neutre si = 0.
- Sous `DiagnosticBanner` : bouton « Voir toutes les échéances » → `/echeances`.
- Sous `WatchlistSection title="Sites à visiter"` : bouton « Tout sur le pilotage » → `/echeances?type=visit`.

#### Fichiers concernés
- `veille-app/src/app/(app)/today/components/EditorDashboard.tsx` (modif)
- `veille-app/src/app/(app)/today/components/CriticalEcheancesBadge.tsx` (nouveau, ~30 lignes)
- `veille-app/src/lib/today/aggregator.ts` (ajout du `criticalCount` dans `aggregateEditor`)
- `veille-app/src/lib/today/types.ts` (ajout `criticalCount` dans `EditorPayload`)

#### Dépendances
- C2 (helper `isCriticalEcheance`).
- C3 (au minimum les sources échéances pour calculer le compteur ; sinon recalculer light dans `today/sources.ts`).

#### Risques
| # | Risque | Mitigation |
|---|---|---|
| R7.1 | Today devient « trop chargé » | Boutons discrets, secondaires. L'indicateur critique remplace symboliquement la zone « action nécessaire » s'il est rouge. |
| R7.2 | Performance Today régresse à cause du calcul critique | Mutualiser : le helper de calcul est appelé sur les mêmes lignes Prisma que Today (`getSitesWithoutVisit`, `getOpenActions`, `getExpiringEquipments`) — pas de requête supplémentaire. |

#### Tests à réaliser
- Preview Today EDITOR : présence des 2 liens + indicateur critique.
- Click indicateur → `/echeances?urgency=critical` avec dataset cohérent.
- Test Vitest `aggregateEditor` : `criticalCount` reflète le nombre attendu sur fixtures.

#### Estimation
**3-4 h** (S+).

---

### Commit 8 — S4-07 : drilldown — section « Échéances du site » sur `/sites/[id]`

#### Périmètre précis (D9)
Ajout d'une section nommée **« Échéances du site »** sur `/sites/[id]/page.tsx`. Contenu structuré en 4 sous-blocs :
1. **Visite trimestrielle** — statut + date dernière + prochaine échéance (« Prochaine dans X j » / « En retard de Y j »).
2. **Visite planifiée** — idem, en tenant compte de `isOccupied` (180 j vs 365 j).
3. **Équipements expirants** — liste compacte (max 5, avec « Voir tous » si plus).
4. **Actions ouvertes** — liste compacte (max 5).

Réutilise `EcheanceRow` (composant exporté en C5). Lien retour Hub : « Tout voir → `/echeances?siteId=…` ».

#### Fichiers concernés
- `veille-app/src/app/(app)/sites/[id]/page.tsx` (modif)
- `veille-app/src/app/(app)/sites/[id]/components/SiteEcheancesSection.tsx` (nouveau)
- `veille-app/src/lib/echeances/sources.ts` (ajout `getEcheancesForSite(user, siteId, now)`)

#### Dépendances
- C3 (sources).
- C5 (`EcheanceRow` export).

#### Risques
| # | Risque | Mitigation |
|---|---|---|
| R8.1 | Page site déjà longue ↦ scroll fatiguant | Section accordion repliée par défaut si > 5 échéances par sous-bloc |
| R8.2 | Performance page site dégrade | `Promise.all` avec les autres fetchers existants |
| R8.3 | Différenciation visuelle entre les 4 sous-blocs | Titres clairs + icône par type (calendrier / flamme / horloge) |

#### Tests à réaliser
- Page site avec 0 / 1 / N échéances par sous-bloc.
- Click « Voir tous » → Hub filtré par `siteId` et `type`.
- USER non autorisé sur le site ne voit pas la section (scope check inchangé).

#### Estimation
**8-10 h** (M).

---

### Commit 9 — S4-08 : CTA lecture seule + perf + responsive final

#### Périmètre précis (D11)
- CTA primaire par ligne d'`EcheanceRow`, **lecture seule** (pas d'édition inline) :
  - `VISIT_QUARTERLY` / `VISIT_PLANNED` → « Ouvrir le site » (`/sites/[siteId]`)
  - `ACTION_OVERDUE` → « Valider » ou « Ouvrir » (`/agents/[agentId]?actionId=…`)
  - `EQUIPMENT_EXPIRING` → « Voir le site » (`/sites/[siteId]#equipments`)
- Mapping `kind → href` figé dans une table de routage exportée (`ctaForKind(item)`), testée unitairement.
- Audit perf : 200 échéances mockées → temps SSR < 500 ms (mesure via `console.time`).
- Audit responsive : preview 320 / 375 / 768 / desktop.
- Polish : skeleton loader, EmptyState par groupe, transitions filtres.

#### Fichiers concernés
- `veille-app/src/app/(app)/echeances/components/EcheanceRow.tsx`
- `veille-app/src/lib/echeances/cta.ts` (nouveau — table de routage)
- `veille-app/src/lib/echeances/cta.test.ts` (nouveau — couverture par `kind`)
- `veille-app/src/app/(app)/echeances/page.tsx`

#### Dépendances
- C5-C8.

#### Risques
| # | Risque | Mitigation |
|---|---|---|
| R9.1 | CTA mal calibrés (action non pertinente) | Mapping `kind → href` testé unitairement, 4 cas + edge cases (siteId manquant, agentId manquant) |
| R9.2 | Perf dégrade avec gros dataset | Index Prisma vérifiés ; cache HTTP `private, max-age=30` ; benchmark Vitest |

#### Tests à réaliser
- Vitest perf agrégateur < 100 ms sur dataset 200.
- Vitest `ctaForKind` : couverture des 4 kinds + 2 edge cases.
- Preview MCP 4 bp + screenshots.

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

Ordre d'exécution validé (C7 avant C6) :

| Commit | Sujet | Min | Max |
|---|---|---|---|
| C1 | Doc + arbitrages D1-D13 (fait) | 1 | 2 |
| C2 | Types + helpers urgence / critique + 15+ tests | 6 | 8 |
| C3 | Sources Prisma unifiées (3 types) | 8 | 10 |
| C4 | Route /api/echeances + agrégateur + flag | 6 | 8 |
| C5 | UI Hub V1 (5 groupes) | 10 | 14 |
| C7 | Liens Today EDITOR + indicateur critique | 3 | 4 |
| C6 | Filtres type/site/équipe/urgence + URL | 7 | 9 |
| C8 | Drilldown « Échéances du site » | 8 | 10 |
| C9 | CTA lecture seule + perf + responsive | 6 | 8 |
| C10 | Recette + SPRINT4-RECETTE.md | 6 | 8 |
| **Total** | | **61 h** | **81 h** |

Capacité Sprint : 75 h. Marge ~0-14 h selon scope final.

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
