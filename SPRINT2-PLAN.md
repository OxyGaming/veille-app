# SPRINT2-PLAN.md — Plan d'exécution Sprint 2 (US-2.1)

> **Périmètre** : implémentation de l'écran `/today` selon [TODAY-V1.md](TODAY-V1.md).
> **Date** : 2026-06-14.
> **Sprint** : Sprint 2 (~75 h de capacité solo + IA).
> **Option retenue** : C — USER complet + EDITOR allégé + ADMIN minimal.

---

## 0. Décisions PO intégrées

| Item | Décision |
|---|---|
| Label | "Aujourd'hui" |
| Route | `/today` |
| Feature flag | `ENABLE_TODAY` — activé par défaut en dev, désactivable en prod |
| Astreinte | Hors V1 — bouton désactivé avec tooltip, pas de structure de tag |
| Objectifs hebdo EDITOR | Compteurs simples, aucun ratio ni objectif heuristique |
| Périmètre | USER complet + EDITOR allégé + ADMIN minimal |

## 0.1 Contraintes assumées

- Aucune migration Prisma.
- Aucune nouvelle entité.
- Lectures dérivées de l'existant uniquement (`VeilleSession`, `SiteVisit`, `ImportedAction`, `Agent`, `Site`, `SiteEquipment`, `User`, `UserTeam`, `AuditLog`).
- Mobile-first (320 px de largeur minimum).
- Pas de Hub Échéances, pas de QR, pas de push, pas d'équipement étendu.
- Pas de refonte navigation (ajout d'un seul lien Aujourd'hui).

---

## 1. Synthèse globale

### 1.1 Ordre optimal des commits

```
SEMAINE 1 — Fondations + USER cœur (28 h)
  C1  Infrastructure /today + flag + lien nav        5 h
  C2  Algorithme priorisation V1 + tests             8 h
  C3  Agrégateur API + helpers                       8 h
  C4  USER : header + En cours                       7 h

SEMAINE 2 — USER finalisé + EDITOR cœur (23 h)
  C5  USER : À traiter aujourd'hui                   8 h
  C6  USER : raccourcis + activités                  6 h
  C7  EDITOR : bannière diagnostic                   5 h
  C8  EDITOR : compteurs hebdo simples               4 h
       → Démo USER en fin de semaine 2

SEMAINE 3 — EDITOR finalisé + ADMIN (16 h)
  C9  EDITOR : watchlists + raccourcis               8 h
  C10 ADMIN minimal                                  8 h
       → Démo EDITOR allégé fin semaine 3

SEMAINE 4 — Finitions + tests (10 h)
  C11 Pull-to-refresh + cache 30 s                   4 h
  C12 Tests E2E + perf + démo Sprint 2               6 h
```

**Total brut** : 77 h.
**Effort net solo + IA estimé** : ~65 h.
**Capacité Sprint 2** : ~75 h.
**Marge** : ~10 h pour imprévus, retours utilisateur en cours de sprint, hotfix Sprint 1 résiduel.

### 1.2 Dépendances entre commits

```
C1 ─→ C2 ─→ C3 ─┬→ C4 ─→ C5 ─→ C6
                ├→ C7 ─→ C8 ─→ C9
                └→ C10
                                C6 + C9 + C10 ─→ C11 ─→ C12
```

- C2 ne dépend pas strictement de C1, mais on enchaîne pour rester cohérent.
- C3 lit le service de C2.
- C4-C6 (USER) sont indépendants de C7-C9 (EDITOR) et C10 (ADMIN).
- C11 et C12 dépendent de l'ensemble.

### 1.3 Points de démo intermédiaires

- **Fin semaine 1** : page `/today` charge pour un USER, affiche header + carte En cours. Pas encore "À traiter".
- **Fin semaine 2** : USER complet. Démo mobile sur iPhone (Chrome DevTools).
- **Fin semaine 3** : EDITOR allégé + ADMIN minimal. Démo des 3 rôles.
- **Fin semaine 4** : tests passants, performance validée, prête pour pré-prod sous feature flag.

---

## 2. Détail par commit

### Commit 1 — Infrastructure `/today` + feature flag + lien nav

#### Périmètre précis

- Créer le squelette `/today` (server component vide qui rend juste "Aujourd'hui").
- Introduire un helper `isTodayEnabled()` qui lit `process.env.ENABLE_TODAY`.
- Modifier `src/app/page.tsx` pour rediriger vers `/today` si flag activé, sinon `/procedures` (fallback).
- Ajouter le lien **Aujourd'hui** en première position de `NAV_MOBILE` et `NAV_DESKTOP` dans `AppShell.tsx`, conditionné par flag.
- Documenter le flag dans le README.

#### Fichiers concernés

| Fichier | Action |
|---|---|
| `veille-app/src/lib/featureFlags.ts` | **Créer** — helper `isTodayEnabled()` + autres flags futurs |
| `veille-app/src/app/page.tsx` | **Modifier** — redirect conditionnel |
| `veille-app/src/app/(app)/today/page.tsx` | **Créer** — page squelette server component |
| `veille-app/src/components/AppShell.tsx` | **Modifier** — ajout NAV_MOBILE + NAV_DESKTOP entrée Today |
| `veille-app/src/components/icons.tsx` | **Modifier** — ajouter `Icon.Home` si absent |
| `veille-app/.env.example` | **Modifier** — `ENABLE_TODAY=true` |
| `veille-app/README.md` | **Modifier** — documenter le flag |

#### Dépendances

- Aucune (point de départ).

#### Risques

| # | Risque | Mitigation |
|---|---|---|
| R1.1 | Casse de la redirection actuelle si flag mal lu côté Edge | Lire le flag dans une `lib/` accessible Node + Edge, pas `process.env.X` direct dans middleware |
| R1.2 | Lien Today actif sur d'autres routes | Vérifier `pathname === "/today"` strict |
| R1.3 | Layout `(app)` non appliqué à `/today` | Créer la page dans `src/app/(app)/today/page.tsx` pour hériter d'AppShell |

#### Tests à réaliser

- Manuel : `ENABLE_TODAY=true` → `/` redirige vers `/today`.
- Manuel : `ENABLE_TODAY=false` → `/` redirige vers `/procedures`.
- Manuel : `/today` affiche header AppShell et le mot "Aujourd'hui".
- Manuel : item Aujourd'hui actif en bottom-nav uniquement quand on est sur `/today`.

#### Estimation

**5 h** (S).

---

### Commit 2 — Algorithme de priorisation V1 + tests Vitest

#### Périmètre précis

- Créer le module `src/lib/today/` avec :
  - `types.ts` : types `TodayItem`, `Urgency`, `Role`, `TodayPayloadUser`, `TodayPayloadEditor`, `TodayPayloadAdmin`.
  - `priority.ts` : fonctions `scoreItem`, `urgencyWeight`, `typeWeight`, `roleWeight`, `sortItems`.
- Écrire les tests Vitest dans `priority.test.ts` (8 cas :
  - action en retard 3 j → urgence rouge,
  - action due aujourd'hui → orange,
  - péremption J+18 → jaune,
  - brouillon vieux → information,
  - tie-break par dueAt ASC,
  - score scope direct vs équipe,
  - tri stable,
  - cas limite 0 item).

#### Fichiers concernés

| Fichier | Action |
|---|---|
| `veille-app/src/lib/today/types.ts` | **Créer** |
| `veille-app/src/lib/today/priority.ts` | **Créer** — algorithme V1 §7.2 |
| `veille-app/src/lib/today/priority.test.ts` | **Créer** — Vitest 8 cas |

#### Dépendances

- Tests Vitest déjà configurés (cf. `auth.test.ts`, `rateLimit.test.ts`).

#### Risques

| # | Risque | Mitigation |
|---|---|---|
| R2.1 | Algorithme tordu, scores incohérents | Documenter chaque poids dans le code avec commentaire bref |
| R2.2 | Tests trop liés à l'implémentation | Tester les outputs (ordre) plutôt que les valeurs précises de score |

#### Tests à réaliser

- `pnpm test` (ou `npm test`) → 8 tests verts.
- Pas de coverage cible imposé, mais > 80 % du fichier `priority.ts`.

#### Estimation

**8 h** (M).

---

### Commit 3 — Agrégateur Today (route API + helpers de requête)

#### Périmètre précis

- Créer `src/app/api/today/route.ts` (GET).
- Créer `src/lib/today/aggregator.ts` qui retourne un payload typé selon `user.role`.
- Sources V1 (lectures Prisma) :
  - **USER** : current work (1 session ou visite), todo list (actions team scope avec dueAt, brouillons > 3j, péremptions < 30j), activité récente (3 dernières unions).
  - **EDITOR** : compteurs retard (actions, visites, équipements), watchlists agents/sites, activité hebdo.
  - **ADMIN** : compteurs système, dernier backup mtime, AuditLog récents.
- Toutes les requêtes en `Promise.all` pour rester sous 300 ms.
- Cache HTTP : `Cache-Control: private, max-age=30, stale-while-revalidate=60`.
- Erreurs : try/catch enveloppant, fallback payload minimal en cas d'échec partiel + log Sentry.

#### Fichiers concernés

| Fichier | Action |
|---|---|
| `veille-app/src/app/api/today/route.ts` | **Créer** — GET handler |
| `veille-app/src/lib/today/aggregator.ts` | **Créer** — fonctions `aggregateUser`, `aggregateEditor`, `aggregateAdmin` |
| `veille-app/src/lib/today/sources.ts` | **Créer** — helpers `getCurrentWork`, `getOpenActions`, `getDraftReminders`, `getExpiringEquipments`, `getRecentActivity`, `getAgentsToReview`, `getSitesWithoutVisit`, `getBackupStatus`, `getSystemAlerts`, `getSystemUsage` |
| `veille-app/src/lib/today/aggregator.test.ts` | **Créer** — 3-4 tests d'intégration sur le tri et l'inclusion des sources |

#### Dépendances

- C2 (utilise `sortItems`, `scoreItem`).
- `getSessionUser`, `teamScope`, `agentScope`, `siteScope`, `actionScope` existants.

#### Risques

| # | Risque | Mitigation |
|---|---|---|
| R3.1 | Perf > 500 ms sur base prod réelle | Mesurer en pré-prod avec seed représentatif ; activer `EXPLAIN QUERY PLAN` SQLite ; au pire, différer "Cette semaine" en lazy load |
| R3.2 | Bug scope teamId pour multi-équipes | Réutiliser strictement les helpers `teamScope(u)` du Sprint 1 |
| R3.3 | Lecture filesystem backup synchronisée bloque le request | Utiliser `fs/promises` async + cache 5 min |
| R3.4 | Compteur Sentry indisponible | Fallback : "Aucune mesure d'erreur récente" (état dégradé jaune) |

#### Tests à réaliser

- Vitest sur l'agrégateur (tri, filtres, cas vide).
- Manuel : `curl /api/today` retourne 200 avec payload typé.
- Manuel : USER multi-équipes → todo list contient les 2 équipes.
- Perf locale : payload < 300 ms sur base de dev seed.

#### Estimation

**8 h** (M).

---

### Commit 4 — USER : `TodayHeader` + carte "En cours"

#### Périmètre précis

- Composant `TodayHeader` (client) : prénom + emoji selon heure + date FR + équipe principale. Variante par rôle (USER : "Bonjour ☀️", EDITOR : "MA TOURNÉE", ADMIN : "PILOTAGE SYSTÈME").
- Composant `CurrentWorkCard` (client) : carte violette sticky avec icône, titre, contexte, progression, CTA "Reprendre →".
- Page `/today` rendue pour USER avec ces 2 composants alimentés par l'agrégateur.

#### Fichiers concernés

| Fichier | Action |
|---|---|
| `veille-app/src/app/(app)/today/page.tsx` | **Modifier** — render USER variant |
| `veille-app/src/app/(app)/today/TodayClient.tsx` | **Créer** — composant client orchestrant les sections selon rôle |
| `veille-app/src/app/(app)/today/components/TodayHeader.tsx` | **Créer** |
| `veille-app/src/app/(app)/today/components/CurrentWorkCard.tsx` | **Créer** |

#### Dépendances

- C3 (consomme `aggregateUser`).

#### Risques

| # | Risque | Mitigation |
|---|---|---|
| R4.1 | Mauvaise détection heure côté SSR vs client | Calculer l'emoji côté client uniquement (hydration cohérente) |
| R4.2 | Carte vide affichée si rien en cours | Conditional render strict |
| R4.3 | Lien Reprendre cassé pour visite vs session | Type discriminé + helper `currentWorkHref(item)` |

#### Tests à réaliser

- Manuel : login USER avec une session draft → carte présente.
- Manuel : USER sans rien en cours → carte absente.
- Manuel : visite draft prioritaire sur session draft plus ancienne → bonne sélection.
- Manuel : header lisible sur 320 px, 414 px, desktop.

#### Estimation

**7 h** (M).

---

### Commit 5 — USER : "À traiter aujourd'hui"

#### Périmètre précis

- Composant `TodoSection` (client) : header + liste de `TodoCard` + lien "Voir tous (N) →".
- Composant `TodoCard` (client) : code couleur urgence, titre, sous-titre, CTA contextuel.
- Agrégation côté serveur déjà faite (C3). C5 = consommation UI + interactions.
- Si 0 item : message positif "Aucune urgence aujourd'hui ✓".
- CTA Valider → ouvre `ValidateModal` existant (lazy import).
- CTA Démarrer → router push `/visits/new?siteId=X` ou `/sessions/new?procedureId=X`.
- CTA Voir → router push détail.
- CTA Reprendre → router push détail.

#### Fichiers concernés

| Fichier | Action |
|---|---|
| `veille-app/src/app/(app)/today/components/TodoSection.tsx` | **Créer** |
| `veille-app/src/app/(app)/today/components/TodoCard.tsx` | **Créer** |
| `veille-app/src/app/(app)/today/components/EmptyState.tsx` | **Créer** — message positif réutilisable |
| `veille-app/src/lib/today/types.ts` | **Modifier** — affiner `TodoCardProps` |

#### Dépendances

- C3, C4.

#### Risques

| # | Risque | Mitigation |
|---|---|---|
| R5.1 | Mauvais lien CTA selon type d'item | Discriminer par `item.sourceType` + tester 3 types |
| R5.2 | Trop d'items rend la page longue | Limit 5 strict côté agrégateur, "Voir tous" si > 5 |
| R5.3 | Liens "Voir tous" V1 ambigus | Documenter la cible exacte par type (action → `/actions`, visite → `/visits?overdue`, equipement → `/sites?expiring`) |

#### Tests à réaliser

- Manuel : USER avec 3 actions retard → 3 cartes rouges.
- Manuel : USER avec 1 péremption J+5 → 1 carte orange.
- Manuel : USER sans rien → "Aucune urgence aujourd'hui ✓".
- Manuel : tap "Valider" sur action → modale ouverte.

#### Estimation

**8 h** (M).

---

### Commit 6 — USER : Raccourcis + Dernières activités

#### Périmètre précis

- Composant `ShortcutsRow` (USER variant) : 3 boutons en grille 3 colonnes ≥ 96 px.
  - Nouvelle veille → `/procedures` (V1 fallback car US-3.13 pas livré).
  - Astreinte → **disabled** avec tooltip "Fonctionnalité à venir".
  - Nouvelle visite → `/visits/new`.
- Composant `RecentActivity` : 3 lignes texte non cliquables, format "Hier 17:22 · Vu Martin L. (POS-VALENCE)".
- USER variant complète et livrable en pré-prod.

#### Fichiers concernés

| Fichier | Action |
|---|---|
| `veille-app/src/app/(app)/today/components/ShortcutsRow.tsx` | **Créer** — 3 variantes USER/EDITOR/ADMIN |
| `veille-app/src/app/(app)/today/components/RecentActivity.tsx` | **Créer** |
| `veille-app/src/lib/today/sources.ts` | **Modifier** — `getRecentActivity` finalisé (union 4 sources) |

#### Dépendances

- C3, C4, C5.

#### Risques

| # | Risque | Mitigation |
|---|---|---|
| R6.1 | Tooltip Astreinte invisible sur mobile | Texte sous le bouton "Bientôt disponible" plutôt que tooltip hover |
| R6.2 | Activité récente reformat texte difficile | Helper `formatRecentLine(item)` testé en Vitest |
| R6.3 | Mélange chronologique union 4 sources | Tri DESC strict sur `Math.max(updatedAt, createdAt, completedAt)` |

#### Tests à réaliser

- Manuel : 3 raccourcis visibles, taille touch ≥ 48 px.
- Manuel : Astreinte non cliquable, badge "Bientôt".
- Manuel : 3 dernières activités issues de 4 sources mélangées.
- Manuel : USER sans activité → section masquée.

#### Estimation

**6 h** (M).

---

### Commit 7 — EDITOR : Bannière diagnostic

#### Périmètre précis

- Composant `DiagnosticBanner` (client) : 3 états visuels avec couleur fond, icône emoji, texte compteurs.
- Calculs côté serveur (dans `aggregateEditor`) :
  - `lateActions7d` = count `ImportedAction WHERE localStatus = ACTIVE AND dueAt < today - 7 AND scope team`.
  - `lateVisits` = count `Site WHERE lastVisitDate + expectedFrequencyDays < today AND scope team`.
  - `expiredEquipments` = count `SiteEquipment WHERE expirationDate < today AND isActive AND scope team`.
- État global : rouge si > 0 retard absolu, jaune si > 2 items orange, vert sinon.
- CTA "Voir le détail" → `/visits?filter=overdue` (V1).

#### Fichiers concernés

| Fichier | Action |
|---|---|
| `veille-app/src/app/(app)/today/components/DiagnosticBanner.tsx` | **Créer** |
| `veille-app/src/lib/today/sources.ts` | **Modifier** — ajouter `getEditorDiagnostic` |
| `veille-app/src/lib/today/aggregator.ts` | **Modifier** — `aggregateEditor` consomme `getEditorDiagnostic` |
| `veille-app/src/app/(app)/today/TodayClient.tsx` | **Modifier** — render variant EDITOR |
| `veille-app/src/app/(app)/today/components/TodayHeader.tsx` | **Modifier** — variant EDITOR ("MA TOURNÉE") |

#### Dépendances

- C3, C4 (header).

#### Risques

| # | Risque | Mitigation |
|---|---|---|
| R7.1 | Calcul `lateVisits` lourd (cross-join site × visites) | Limiter avec subquery sur dernière visite + index sur `siteId, completedAt` |
| R7.2 | Tous EDITOR voient même état pour scope confus | Réutiliser `teamScope(u)` ; tester avec USER multi-équipes |
| R7.3 | "Voir le détail" V1 redirige vers une page non filtrée si query non supportée | Documenter et accepter redirect simple V1 ; améliorer en V2 |

#### Tests à réaliser

- Manuel : EDITOR avec 3 actions retard > 7 j → bannière rouge.
- Manuel : EDITOR sans rien → bannière verte.
- Manuel : EDITOR avec 1 péremption hier + 0 action retard → rouge (péremption = critique).
- Lighthouse : LCP < 1 s sur mobile.

#### Estimation

**5 h** (S).

---

### Commit 8 — EDITOR : Compteurs hebdo simples (sans ratio)

#### Périmètre précis

- Composant `WeekCountersList` : 3 compteurs en cartes simples, sans barre ni objectif.
  - "Visites cette semaine : 3"
  - "Veilles équipe cette semaine : 12"
  - "Actions clôturées cette semaine : 9"
- Calculs serveur dans `aggregateEditor.weekCounters` :
  - `visitsCount` = count `SiteVisit WHERE completedAt BETWEEN weekStart AND today AND scope team`.
  - `sessionsCount` = count `VeilleSession WHERE completedAt BETWEEN weekStart AND today AND scope team`.
  - `actionsClosedCount` = count `ImportedAction WHERE localStatus = VALIDATED_LOCAL AND validatedAt BETWEEN weekStart AND today AND scope team`.
- Pas de progress bars, pas d'objectif (décision PO).
- Chaque ligne cliquable → liste filtrée correspondante.

#### Fichiers concernés

| Fichier | Action |
|---|---|
| `veille-app/src/app/(app)/today/components/WeekCountersList.tsx` | **Créer** |
| `veille-app/src/lib/today/sources.ts` | **Modifier** — ajouter `getWeekCounters` |

#### Dépendances

- C3, C7.

#### Risques

| # | Risque | Mitigation |
|---|---|---|
| R8.1 | `weekStart` mal calculé (timezone) | Helper `startOfWeekParis()` (lundi 00:00 Europe/Paris) |
| R8.2 | Compteur "Actions clôturées" basé sur `validatedAt` qui n'existe peut-être pas | Vérifier le schéma : si pas le champ, utiliser `updatedAt` filtré sur `localStatus = VALIDATED_LOCAL` ; documenter approximation |

#### Tests à réaliser

- Manuel : EDITOR sur seed avec 3 visites cette semaine → "Visites cette semaine : 3".
- Manuel : EDITOR sans rien cette semaine → "Visites cette semaine : 0" (pas masqué — info utile).
- Manuel : clic sur ligne → navigation.

#### Estimation

**4 h** (S).

---

### Commit 9 — EDITOR : Watchlists + raccourcis

#### Périmètre précis

- Composant `WatchlistAgents` : top 5 agents triés par freshness DESC.
  - Ligne : nom + "X jours sans veille" + CTA "Veiller →".
  - "Voir tous (N) →" si plus de 5.
- Composant `WatchlistSites` : top 5 sites sans visite récente.
  - Ligne : nom + "X jours" ou "X jours de retard" + CTA "Visiter →".
- Composant `ShortcutsRowEditor` : Importer Excel / Stats équipe / Échéances équipe (V1 → liste actions retard).
- EDITOR allégé livrable en pré-prod.

#### Fichiers concernés

| Fichier | Action |
|---|---|
| `veille-app/src/app/(app)/today/components/WatchlistAgents.tsx` | **Créer** |
| `veille-app/src/app/(app)/today/components/WatchlistSites.tsx` | **Créer** |
| `veille-app/src/app/(app)/today/components/ShortcutsRow.tsx` | **Modifier** — variant EDITOR |
| `veille-app/src/lib/today/sources.ts` | **Modifier** — `getAgentsToReview`, `getSitesWithoutVisit` finalisés |

#### Dépendances

- C3, C7, C8.

#### Risques

| # | Risque | Mitigation |
|---|---|---|
| R9.1 | Performance tri freshness sur 500+ agents | LIMIT 5 + index `Agent.lastSessionAt` ; mesurer |
| R9.2 | Agents non visibles affichés (M15 non livré) | Filtrer `Agent.isVisible = true` |
| R9.3 | Sites sans `expectedFrequencyDays` mal triés | Fallback 90 jours par défaut documenté |

#### Tests à réaliser

- Manuel : EDITOR avec 7 agents > 14 j → 5 affichés + "Voir tous (7) →".
- Manuel : EDITOR avec aucun agent en retard → "Aucun agent à veiller cette semaine ✓".
- Manuel : tap "Veiller" sur agent → `/sessions/new?agentId=X` (fallback V1).
- Manuel : Lighthouse mobile EDITOR ≥ 90.

#### Estimation

**8 h** (M).

---

### Commit 10 — ADMIN minimal : état + healthcheck + alertes + activité

#### Périmètre précis

- Composant `SystemStatus` : carte état global (vert/jaune/rouge) avec :
  - count users actifs + équipes
  - date dernier backup (mtime de `data/backups/latest.db`)
  - count erreurs 5xx 24 h (Sentry ou logger)
- Composant `SimpleAlerts` : liste de 3-5 alertes :
  - sessions brouillon > 30 j
  - LOGIN_FAILED 24 h
  - 5xx 24 h
- Composant `RecentSystemActivity` : 5 dernières entrées AuditLog.
- Composant `ShortcutsRowAdmin` : Nouvel user / Logs audit (V1 redirect vers liste users si page audit pas livrée) / Imports.
- Variante ADMIN + EDITOR : si `user.teamIds.length > 0`, afficher bloc EDITOR au-dessus, "Pilotage système" replié par défaut.

#### Fichiers concernés

| Fichier | Action |
|---|---|
| `veille-app/src/app/(app)/today/components/SystemStatus.tsx` | **Créer** |
| `veille-app/src/app/(app)/today/components/SimpleAlerts.tsx` | **Créer** |
| `veille-app/src/app/(app)/today/components/RecentSystemActivity.tsx` | **Créer** |
| `veille-app/src/app/(app)/today/components/CollapsibleSection.tsx` | **Créer** — wrapper pour ADMIN+EDITOR repliable |
| `veille-app/src/app/(app)/today/components/ShortcutsRow.tsx` | **Modifier** — variant ADMIN |
| `veille-app/src/app/(app)/today/TodayClient.tsx` | **Modifier** — render ADMIN ou ADMIN+EDITOR |
| `veille-app/src/lib/today/sources.ts` | **Modifier** — `getBackupStatus`, `getSystemAlerts`, `getRecentSystemActivity` |
| `veille-app/src/app/(app)/today/components/TodayHeader.tsx` | **Modifier** — variant ADMIN ("PILOTAGE SYSTÈME") |

#### Dépendances

- C3, C7, C8, C9 (réutilisation header + bloc EDITOR).

#### Risques

| # | Risque | Mitigation |
|---|---|---|
| R10.1 | Path backup différent en dev vs prod | Variable env `BACKUP_DIR` avec fallback `data/backups` |
| R10.2 | Lecture `mtime` fs synchrone bloque request | `fs.promises.stat` + try/catch + cache 5 min |
| R10.3 | Compteur 5xx Sentry indisponible | Fallback : compter via logger structuré local, sinon afficher "Indisponible" |
| R10.4 | AuditLog vide → section masquée silencieusement | Si vide : "Aucune activité récente" |

#### Tests à réaliser

- Manuel : ADMIN sans équipe → page ADMIN pure.
- Manuel : ADMIN avec équipe → bloc EDITOR + "Pilotage système" repliable.
- Manuel : sans backup récent → état dégradé jaune.
- Manuel : > 10 LOGIN_FAILED 24 h → alerte orange.

#### Estimation

**8 h** (M).

---

### Commit 11 — Pull-to-refresh + cache 30 s côté client

#### Périmètre précis

- Hook `useTodayRefresh()` (client) :
  - Intercepte le geste pull-down (gestion `touchstart`/`touchmove`/`touchend` natif, pas de lib externe).
  - Re-fetch `/api/today` si > 60 s depuis dernier fetch (au focus de fenêtre).
  - Cache local 30 s (en mémoire, pas localStorage).
  - Toast "Mis à jour" via sonner.
- Indicateur visuel pendant le refresh (spinner mini).
- `onfocus` window → trigger refresh si stale.

#### Fichiers concernés

| Fichier | Action |
|---|---|
| `veille-app/src/app/(app)/today/hooks/useTodayRefresh.ts` | **Créer** |
| `veille-app/src/app/(app)/today/TodayClient.tsx` | **Modifier** — intégrer le hook |
| `veille-app/src/app/(app)/today/components/RefreshIndicator.tsx` | **Créer** — spinner discret |

#### Dépendances

- C6, C9, C10 (besoin d'un TodayClient stable).

#### Risques

| # | Risque | Mitigation |
|---|---|---|
| R11.1 | Geste pull-down conflit avec scroll natif iOS | Détecter `scrollY === 0` avant capture ; sinon ignorer |
| R11.2 | Double refresh (pull + focus) | Debounce 500 ms |
| R11.3 | Cache 30 s incohérent avec mutations dans d'autres onglets | Acceptable V1 : refresh manuel au pire |

#### Tests à réaliser

- Manuel mobile (Chrome DevTools touch) : pull-down → spinner + toast.
- Manuel : changer d'onglet 70 s puis revenir → refresh auto.
- Manuel : changer d'onglet 20 s puis revenir → pas de refresh.
- Manuel : conflit avec scroll natif évalué OK.

#### Estimation

**4 h** (S).

---

### Commit 12 — Tests E2E + finalisation Sprint 2

#### Périmètre précis

- Tests d'intégration Vitest sur l'agrégateur (3 cas par rôle).
- Scénarios manuels documentés dans `SPRINT2-TESTING.md` :
  - USER terrain (login + voir En cours + valider une action).
  - EDITOR (login + voir bannière rouge + cliquer Veiller).
  - ADMIN (login + voir état + cliquer Nouvel user).
- Mesure Lighthouse mobile (cible LCP < 1 s).
- Mesure performance API `GET /api/today` (cible < 300 ms en dev).
- Vérification feature flag : déploiement avec `ENABLE_TODAY=false` ne casse rien.
- Mise à jour `CHANGELOG.md` Sprint 2.
- Note utilisateur `docs/USER-TODAY.md` (1 page).

#### Fichiers concernés

| Fichier | Action |
|---|---|
| `veille-app/src/lib/today/aggregator.test.ts` | **Modifier** — compléter couverture |
| `SPRINT2-TESTING.md` | **Créer** — scénarios manuels |
| `CHANGELOG.md` | **Modifier** — Sprint 2 entry |
| `docs/USER-TODAY.md` | **Créer** — guide utilisateur |

#### Dépendances

- Tous les commits précédents.

#### Risques

| # | Risque | Mitigation |
|---|---|---|
| R12.1 | Bug détecté en perf à la fin du sprint | Marge 10 h disponible pour hotfix |
| R12.2 | Lighthouse < 90 sur certains rôles | Audit ciblé : lazy import des modales lourdes (ValidateModal déjà géré) |
| R12.3 | Régression sur `/procedures` ou bottom-nav | Test manuel des 9 pages existantes en fin de sprint |

#### Tests à réaliser

- Tests Vitest : 100 % verts.
- Lighthouse mobile sur les 3 variantes : score performance ≥ 85.
- Test sur seed de production simulé (non automatisé).
- Vérification déploiement pré-prod avec flag ON puis OFF.

#### Estimation

**6 h** (M).

---

## 3. Matrice synthétique

| Commit | Titre | Effort | Tests requis | Risque max |
|---|---|---|---|---|
| C1 | Infra + flag + nav | 5 h | Manuel routing | R1.3 layout |
| C2 | Algorithme + tests | 8 h | Vitest 8 cas | R2.1 cohérence |
| C3 | Agrégateur API | 8 h | Vitest + perf | R3.1 perf SQLite |
| C4 | Header + En cours | 7 h | Manuel mobile | R4.1 SSR/client emoji |
| C5 | À traiter | 8 h | Manuel 3 types | R5.1 CTA |
| C6 | Raccourcis + activités | 6 h | Manuel | R6.1 tooltip mobile |
| C7 | Bannière EDITOR | 5 h | Manuel + LCP | R7.1 perf cross-join |
| C8 | Compteurs hebdo | 4 h | Manuel | R8.2 champ `validatedAt` |
| C9 | Watchlists + raccourcis EDITOR | 8 h | Manuel + perf | R9.1 perf agents |
| C10 | ADMIN minimal | 8 h | Manuel 2 variantes | R10.3 Sentry indispo |
| C11 | Pull-to-refresh | 4 h | Manuel mobile | R11.1 conflit scroll iOS |
| C12 | Tests + finalisation | 6 h | Lighthouse + manuel | R12.2 perf |
| **Total** | — | **77 h** | — | — |

## 4. Hypothèses techniques à valider avant C1

1. **`process.env.ENABLE_TODAY`** est lu uniquement côté Node (page server). On évite `middleware.ts` qui tourne en Edge.
2. **Champ `validatedAt`** sur `ImportedAction` : à vérifier dans le schéma Prisma. Si absent → fallback `updatedAt` filtré sur `localStatus`.
3. **Dossier backup** : `data/backups/latest.db` (Sprint 1 — US-1.8). Confirmer path en prod.
4. **Sentry counter** : disponible via `@sentry/nextjs` côté serveur ? À défaut, compteur d'erreurs depuis `logger.ts` Sprint 1.
5. **`Agent.lastSessionAt`** : existe-t-il déjà ? Sinon, dériver via subquery `MAX(VeilleSession.completedAt)`.
6. **`Site.lastVisitDate`** : idem.

Je vérifierai ces 6 points lors du C1 et signalerai immédiatement si une hypothèse tombe.

## 5. Stratégie de déploiement

**Fin de chaque semaine** :
- Semaine 1 : commit dans `main` derrière flag `ENABLE_TODAY=false` en prod. Activable en dev local.
- Semaine 2 : activation flag pour utilisateur test interne (pré-prod).
- Semaine 3 : feedback EDITOR + ADMIN, ajustements.
- Semaine 4 : activation flag pour tous en prod **uniquement après validation** du PO.

**Rollback** : flip flag → `false`, redirect revient à `/procedures`. Pas de rollback DB nécessaire (aucune migration).

## 6. Métriques de succès Sprint 2

- ✅ Toutes les pages existantes fonctionnent inchangées avec flag OFF.
- ✅ Avec flag ON, `/today` charge en < 500 ms en SSR sur base de dev.
- ✅ Lighthouse mobile ≥ 85 sur les 3 variantes.
- ✅ Tous les tests Vitest passent.
- ✅ Démo des 3 rôles convaincante en fin de Sprint 2.

---

## 7. Demande de validation

Plan d'exécution complet **prêt pour validation**.

**En attente de ton OK pour démarrer le Commit 1.**

Si modification de scope souhaitée :
- Réduction : retirer Commit 10 (ADMIN) → -8 h, livraison plus rapide.
- Ajout : remettre progress bars EDITOR (C8 enrichi) → +4 h.
- Permutation : faire EDITOR avant USER finalisé (priorité PO) → ordre C1-C3-C7-C8-C9 puis USER.

Dis-moi si tu valides l'ordre proposé tel quel.
