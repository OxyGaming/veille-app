# Recette — Import planning agents (tour de service)

**Périmètre** : C1 (modèle + parser) + C2 (page admin + import transactionnel) + C3 (section `/today`) + C4 (sous-titre autocomplete agent).
**Branche** : `main`
**SHAs sprint** : C1 `2ddf5bf` · C2 `68e090a` · C3 `de1cfd5` · C4 `345078a` · recette `<voir SHA final ci-dessous>`
**Règle d'or non négociable** : `PlanningShift` n'est JAMAIS utilisé pour le cloisonnement. Le scope reste `Utilisateur → Team Veille → AgentTeam → Agent`. UCH / UCH JS sont ignorés.

---

## 0. Vérifications transverses

| Cas | Vérification | Résultat |
|---|---|---|
| Suite Vitest | `npx vitest run` → **402 / 402** verts (24 fichiers, dont parser 34 + import 8 + planning 27 = 69 sur le périmètre planning) | ✅ |
| TypeScript | `npx tsc --noEmit -p tsconfig.json` → **0 erreur** | ✅ |
| Build production | `npm run build` → **Compiled successfully (5.0 s)**, 36/36 pages générées, routes `/admin/planning`, `/api/admin/planning/preview`, `/api/admin/planning/import` présentes | ✅ |
| Migration Prisma | `prisma/migrations/20260620050358_add_planning_import/migration.sql` versionnée, applied | ✅ |

---

## 1. Import admin planning

Fichier de référence : `modif 1 1.txt` (ODS — tour de service ferroviaire, 7 372 lignes de données, 24 colonnes, période 11/05/2026 → début juin).

| Cas | Vérification | Résultat |
|---|---|---|
| Page `/admin/planning` rendue | E2E preview (session `admin@veille.local`) → 200, titre + zone d'upload + carte "Import actuel" rendus | ✅ |
| Upload ODS accepté | `<input accept=".ods,.xlsx,.xls">`. Test E2E sur fichier 0.61 Mo → 200 sur `/api/admin/planning/preview` | ✅ |
| Preview affichée | API renvoie `rowsTotal=7372 · rowsService=3784 · rowsNonService=3588 · rowsImported=595 · rowsIgnored=3189 · rowsErrored=0 · unknownMatriculesCount=186` | ✅ |
| Période couverte | API renvoie `periodStart=2026-05-10T17:10:00Z`, `periodEnd=2026-06-11T23:56:00Z` — UI affiche en français `10/05/2026 → 12/06/2026` | ✅ |
| Matricules inconnus listés | 186 matricules affichés, tronqué à 20 visibles + chip `… +166 autres` | ✅ |
| Erreurs de parsing affichées | 0 erreur sur le fichier réel → section repliable absente | ✅ |
| Diagnostic UCH | `rawUchSummary.byAppartenance` exposé (info brute, jamais utilisé pour le scope — confirmation textuelle dans l'UI) | ✅ |
| Confirmation obligatoire | Bouton `Importer définitivement` disabled tant que checkbox `Je confirme que cet import écrase intégralement le planning précédent` non cochée | ✅ |
| Import définitif | E2E preview → 200 sur `/api/admin/planning/import`, retour `{ importId, rowsImported:595, elapsedMs≈1000 }` | ✅ |
| Écrasement du précédent | Re-test : un second import efface bien les shifts du premier. `planningImport.count() === 1` après chaque import. Transaction Prisma testée à 8 reprises en Vitest (`import.test.ts`) | ✅ |
| `router.refresh()` post-commit | Carte "Import actuel" re-render avec les nouveaux compteurs + nom utilisateur + date | ✅ |
| AuditLog `PLANNING_IMPORTED` | Query DB → 1 entrée par import avec `action="PLANNING_IMPORTED"`, `entity="PlanningImport"`, `entityId=<importId>`, `userEmail=admin@veille.local`, `details` = compteurs + période. Aucune fuite de matricule sensible | ✅ |

---

## 2. Sécurité

| Cas | Vérification | Résultat |
|---|---|---|
| ADMIN → `/admin/planning` | 200, page rendue | ✅ |
| EDITOR → `/admin/planning` | Redirect `/admin` (server-side `if (u.role !== "ADMIN") redirect("/admin")`). Testé live avec un EDITOR temporaire | ✅ |
| USER → `/admin/planning` | Layout admin refuse en amont (`redirect("/procedures")`) | ✅ |
| Lien sidebar "Planning agents" | Visible uniquement ADMIN. Vérifié avec EDITOR : invisible | ✅ |
| ADMIN → POST `/api/admin/planning/preview` | 200 sur ODS valide, 400 sur fichier manquant, 413 si > 25 Mo, 422 sur en-tête invalide | ✅ |
| EDITOR → POST `/api/admin/planning/preview` | **403 "Accès refusé"** | ✅ |
| USER → POST `/api/admin/planning/preview` | **403 "Accès refusé"** | ✅ |
| EDITOR → POST `/api/admin/planning/import` | **403 "Accès refusé"** | ✅ |
| Sans cookie → `/admin/planning` | **307 `/login?from=%2Fadmin%2Fplanning`** | ✅ |
| Sans cookie → `/api/admin/planning/preview` | **401 "Non authentifié"** | ✅ |
| Aucun agent créé | Code-review `import.ts:resolveAgents()` — `agent.findMany` lecture seule, agents inconnus → `unknownMatricules`. Confirmé en base : `agent.count` identique avant/après import | ✅ |
| Aucune équipe créée | Aucun `team.create` ni `team.upsert` dans le pipeline d'import. Confirmé en base : `team.count` inchangé | ✅ |
| Aucun rattachement modifié | `AgentTeam` n'est jamais touchée. Code-review + diff Prisma | ✅ |

---

## 3. Données sensibles (RGPD)

| Cas | Vérification | Résultat |
|---|---|---|
| Aucun code NPO stocké | Query : `planningShift.findMany({distinct:['jsCode']})` → 71 codes distincts. Intersection avec `{MA, BM, AY, AZ, RP, DR, VT, F1..F5, YH, PE, NU, CF, RU, RN, FV, RQ, …}` = **∅**. Tous les `jsCode` sont des codes métier (VMCAS, LGV/, EVOLB, CRE004, DIE319, …) | ✅ |
| Aucun libellé maladie/congé stocké | Recherche regex `/(absence\|maladie\|congé\|méd\|repos)/i` sur le contenu de la DB (rawUchSummary, unknownMatricules, AuditLog.details) → **0 match** | ✅ |
| Aucun NPO affiché côté UI | Code-review `parser.ts:parsePlanningRow` — branche `non-service` ne retourne JAMAIS de `shift`, donc ni jsCode ni jsNumber ne traversent la frontière. Test Vitest dédié `expect(JSON.stringify(result.shifts)).not.toContain("MA")` | ✅ |
| Filtre amont strict | `parser.ts:parsePlanningRow` retourne `{kind:"non-service"}` pour toute valeur col 16 ≠ `"JS"`. Vérifié : pas de fall-through vers les champs des colonnes 17-19 (CODE NPO, FAM. NPO) | ✅ |
| Vérification DB shifts | `planningShift.count() = 599`, `planningImport.count() = 1` — seulement les SERVICE ont été persistés sur le fichier de 7 372 lignes | ✅ |

---

## 4. Section `/today` "Agents en service aujourd'hui"

| Cas | Vérification | Résultat |
|---|---|---|
| ADMIN GLOBAL | Section rendue en dessous de "Usage 7 derniers jours", scope `agentScope` = `{}` → tous les agents Veille visibles. 4 cartes (démo) rendues, tri correct | ✅ |
| ADMIN MY_TEAMS / TEAM | Code-review `aggregator.ts:172-186` — switch bascule sur `aggregateEditor` qui appelle `getAgentsOnDutyToday` avec le même `user`. `agentScope(user)` étendu en C5 (`auth.ts:216-223`) retourne le scope restreint → section filtre automatiquement | ✅ |
| EDITOR | `aggregateEditor` appelle `getAgentsOnDutyToday(user, now)` avec `agentScope(user)` = `{memberships: {some: {teamId: {in: user.teamIds}}}}` → seuls les agents des équipes EDITOR. Test Vitest dédié `planning.test.ts:scope EDITOR` | ✅ |
| USER inchangé | `aggregateUser` ne contient PAS d'appel à `getAgentsOnDutyToday`. `UserPayload` n'expose ni `agentsOnDutyToday` ni `hasPlanningImport`. Testé live : section absente sur compte USER | ✅ |
| Services de nuit `(+1)` | `isOvernightShift()` true quand `endsAt` jour calendaire ≠ `startsAt`. UI affiche `20:00 → 04:00 (+1)`. Validé pour Barthomeuf + Benchlih dans les démos | ✅ |
| Tri En service / Plus tard / Terminé | `STATUS_ORDER = {IN_SERVICE:0, LATER:1, FINISHED:2}` + `startsAt` asc en tie-break. Validé live : `[Yannis IN_SERVICE, Sebastien IN_SERVICE, Gillian LATER, Houda FINISHED]` | ✅ |
| Empty state "Aucun agent en service" | `hasPlanningImport=true` mais `items.length=0` → carte dashed avec icône User et libellé `"Aucun agent de votre périmètre n'a de journée de service prévue aujourd'hui"`. Pas de bouton import | ✅ |
| Empty state "Aucun planning importé" | `hasPlanningImport=false` → carte dashed avec icône Calendar, libellé + bouton CTA `Importer un planning` (visible ADMIN uniquement, prop `canImportPlanning`) | ✅ |
| CTA "Fiche agent" | Pointe vers `/agents/[id]` | ✅ |
| CTA "Démarrer une veille" | Pointe vers `/procedures` (catalogue existant — pas de modification du flux veille) | ✅ |
| Compteur dans le titre | `Agents en service aujourd'hui (N)` quand `items.length > 0`, omis sinon | ✅ |

---

## 5. Autocomplete agent (wizard veille)

| Cas | Vérification | Résultat |
|---|---|---|
| IN_SERVICE | `Aouadissian Sebastien (7906853F)` → sous-titre `"En service aujourd'hui · 06:00 → 16:00 · JS 20101"` | ✅ |
| LATER + overnight | `Barthomeuf Gillian (8511072R)` → `"Prévu plus tard · 20:00 → 04:00 (+1) · JS 20398"` | ✅ |
| FINISHED + overnight | `Benchlih Houda (9306755N)` → `"Service terminé · 22:00 → 06:00 (+1) · JS 20999"` | ✅ |
| Non prévu | `Bouziges Frederic (6901819C)` → `"Non prévu en service aujourd'hui"` (planning importé sans shift pour cet agent) | ✅ |
| Aucun import → aucun hint | `getAgentsPlanningHints` retourne `new Map()` quand `planningImport.count() === 0`. UI : pas de sous-titre, comportement legacy intact | ✅ (Vitest) |
| Aucune fuite NPO | Test Vitest `formatPlanningHint` vérifie qu'aucun shift NPO ne peut arriver (champ `shift` typé `{startsAt, endsAt, jsNumber}` — pas de jsCode NPO possible) + DB vérifiée §3 | ✅ |
| Aucune fuite hors scope | Le caller `sessions/[id]/page.tsx` construit `agents` via `agentScope(u)`. `getAgentsPlanningHints` reçoit `agentIds: string[]` déjà scopés — sans réintroduction de relation agent. Code-review confirmée | ✅ |
| Une seule requête SQL | `planningShift.findMany({ where: { agentId: { in: [...] }, startsAt, endsAt }, select: {agentId, startsAt, endsAt, jsNumber} })` — pas de N+1 même avec 500 agents | ✅ |

---

## 6. Performance

| Cas | Vérification | Résultat |
|---|---|---|
| Import fichier réel 7 372 lignes | `commitPlanningImport` complet en **~1.0 s** (mesure preview : `elapsedMs: 1010-1102`) | ✅ |
| `/today` SSR | `preview_logs` mesure GET `/today` : `82 ms` (cache chaud) à `552 ms` (premier compile). Médiane `270-400 ms`. Sous 500 ms hors first-load | ✅ |
| Autocomplete sans N+1 | 1 seul `findMany` couvre tous les agents du scope (vu §5). Pas d'appel agent-par-agent | ✅ |
| Requêtes SQL filtrées | `getAgentsOnDutyToday` : `WHERE startsAt < J+1 AND endsAt > J AND agent.isVisible AND agent.memberships.some(teamId IN ...)`. Index utilisés : `PlanningShift_startsAt_endsAt_idx`, `AgentTeam` indexé par teamId | ✅ |
| Volumétrie testée | 599 shifts en base (595 fichier réel + 4 démos). Cible "plusieurs milliers" → la requête reste O(N) sur l'index date | ⚠ (cf. §dette) |

---

## 7. Responsive

Testé via `preview_resize` sur les 4 points de référence.

| Vue | 320 px | 375 px | 768 px (tablet) | desktop |
|---|---|---|---|---|
| `/admin/planning` (vide) | ✅ pas d'overflow, grid 2-cols sur "Import actuel" | ✅ (similaire 320) | ✅ grid 4-cols | ✅ |
| `/admin/planning` (preview avec 186 inconnus) | ✅ liste tronquée, section repliable | ✅ | ✅ | ✅ |
| `/today` empty state | ✅ carte dashed centrée | ✅ | ✅ | ✅ |
| `/today` 4 cartes peuplées | ✅ stack vertical (`flex-col` < md), badges au-dessus du nom | ✅ | ✅ rangée horizontale (`md:flex-row`) | ✅ |
| `/sessions/[id]` (autocomplete 12 agents avec sous-titre) | n/a (rare) | ✅ liste lisible, sous-titres `truncate` (ellipsis sur les hint longs) | ✅ | ✅ |

Aucun débordement horizontal (`scrollWidth === clientWidth`) sur les 4 viewports testés.

---

## Bugs bloquants

**Aucun.** L'ensemble du périmètre est fonctionnel et testé.

---

## Bugs mineurs

| Sévérité | Description | Recommandation |
|---|---|---|
| Cosmétique | Sur mobile très étroit (320 px), les sous-titres autocomplete sont tronqués par `truncate` (CSS ellipsis). Information complète ailleurs (`/today`), donc acceptable | Aucun (rester sur ellipsis) |
| Mineur | La card "selected agent" du composant `AgentAutocomplete` est codée pour afficher le `hint`, mais le caller (`SessionClient`) unmonte le composant dès qu'un agent est choisi → le hint sur la card emerald n'est jamais visible dans le flux V1 | Conserver — utile pour de futurs callers ; pas de coût |
| Mineur | Le compteur de section affiche le total des shifts du jour pour le scope, pas le nombre d'agents distincts si un agent a 2 shifts du jour (rare). Dédup déjà en place → compteur cohérent | Aucun |
| Information | Sur très petit écran (320 px), le bouton "Démarrer une veille" passe sur une seconde ligne sous "Fiche agent". Lisible, gestes tactiles confortables | Aucun |

---

## Dette technique

| Item | Description | Impact | Action |
|---|---|---|---|
| D1 | Pas de tests d'intégration sur les routes API `/api/admin/planning/{preview,import}` (le projet n'a pas de pattern de test de route Next.js). Les helpers `previewPlanningImport`/`commitPlanningImport` sont couverts (8 tests) | Faible — couvert par recette navigateur | Garder ; à intégrer si pattern API-tests émerge |
| D2 | `getAgentsPlanningHints` appelle `planningImport.count()` à chaque rendu de la page session. Coût négligeable en SQLite (1 ms) mais évitable avec un cache process-wide | Très faible | Cache mémoire 60 s si volumétrie augmente |
| D3 | Volumétrie réelle testée : 599 shifts. La cible "plusieurs milliers de shifts" est tenue théoriquement par les index, mais non mesurée. Aucun chunking sur `createMany` | Faible (1 import / semaine attendu) | Mesurer avec un fichier 10× plus gros avant prod |
| D4 | Aucun bouton "purger le planning" — pour effacer sans réimporter, il faut passer par DB. Non bloquant tant qu'on a toujours un nouveau fichier à importer | Faible | À ajouter si demande métier |
| D5 | Le `now` côté SSR est `new Date()` (instantané). Une page ouverte longtemps ne se rafraîchit pas à minuit. Acceptable pour wizard veille (saisie courte) | Faible | `TodayAutoRefresh` existant rafraîchit `/today` toutes les 60 s → couvre l'essentiel |
| D6 | ESLint v9 sans `eslint.config.js` au niveau projet → `npm run lint` échoue. Pré-existant à ce sprint | Faible | Migration ESLint à planifier hors sprint planning |
| D7 | Une deuxième base `prisma/dev.db` peut apparaître après `migrate dev` si le CWD diffère. Le seed et l'app utilisent `./dev.db` à la racine `veille-app`. Doc ops à clarifier | Faible | Documenter dans README ops |

---

## Risques de déploiement

| Risque | Probabilité | Impact | Mitigation |
|---|---|---|---|
| Migration Prisma `20260620050358_add_planning_import` non appliquée en prod | Faible | Bloquant (page 500) | Pipeline CI doit jouer `prisma migrate deploy` avant le déploiement. La migration est versionnée et ajoute uniquement 2 tables + 4 indexes, pas de modification de tables existantes → reversible par `DROP TABLE` |
| Fichier ODS contenant un format de date différent (`YYYY-MM-DD` au lieu de `DD/MM/YYYY`) | Faible | Lignes en erreur | Le parser rejette explicitement les formats ≠ `DD/MM/YYYY` (couvert par 8 tests) → l'import échoue proprement avec compteur `rowsErrored`, aucune corruption silencieuse |
| Premier import en prod sur DB vide → tous les agents en `rowsIgnored` | Moyenne | UX dégradée (pas de hint, sections empty) | Documenter l'ordre : (1) seed agents via import actions (existant), (2) seed planning. Le rapport d'import expose `unknownMatriculesCount` et le manager voit immédiatement combien d'agents manquent |
| Charge sur `/today` si N agents très grand pour ADMIN GLOBAL | Faible | Latence SSR | Index composite `PlanningShift_startsAt_endsAt_idx` existant. Mesurer avant prod réelle ; pagination ou virtualisation à envisager au-delà de 100 cartes simultanées |
| Fuite RGPD via fichier ODS contenant des libellés sensibles | Très faible | Critique si réel | Filtre amont prouvé en test + SQL distinct sur DB confirmé. Toute évolution future du parser doit conserver la branche stricte `col[16] === "JS"` |
| Conflit UTC vs Europe/Paris sur heures de service | Faible | Décalage d'1-2 h en affichage | Server prod doit être en `TZ=Europe/Paris` (cohérent avec le reste du projet). Documenter dans README ops |

---

## Actions pré-production

1. **CI** : vérifier que `prisma migrate deploy` est invoqué sur l'environnement cible avant le déploiement (la migration `20260620050358_add_planning_import` doit être appliquée).
2. **Doc ops** : ajouter au README la procédure standard d'import planning (qui, fréquence, fichier attendu, comportement en cas d'erreur).
3. **Variables env** : confirmer `TZ=Europe/Paris` sur le serveur prod (cohérence horaires planning vs autres dates).
4. **Volumétrie** : effectuer un test de charge avec un fichier ~10 000 shifts avant la mise en production réelle. Mesurer `commitPlanningImport.elapsedMs` et `/today` p95.
5. **Rétrocompatibilité** : sur première mise en prod, prévoir la séquence (1) seed agents par import actions existant, (2) premier import planning. Sinon `unknownMatriculesCount` sera très élevé sur le premier rapport (information visible, pas d'erreur).
6. **Backup** : vérifier que la procédure de backup quotidien existante embarque les nouvelles tables `PlanningImport` et `PlanningShift` (par défaut OUI, c'est un VACUUM INTO de la DB entière).
7. **Audit RGPD** : faire valider par le DPO interne le fait que seuls les SERVICE sont persistés (preuve : 71 jsCodes distincts en base, 0 NPO).
8. **Monitoring** : surveiller `AuditLog` action `PLANNING_IMPORTED` pour traçabilité ; flagger si > 1 import par 24 h (signe d'erreur opérateur).

---

## SHA Git de la recette

À renseigner après commit final de cette recette.

---

## Synthèse

L'ensemble du périmètre planning (C1-C4) est **validé pour mise en production**.
- ✅ **402 tests Vitest** verts
- ✅ **TypeScript** propre, **build prod** propre
- ✅ **Sécurité** ADMIN strict, EDITOR/USER refusés (testés live)
- ✅ **RGPD** : 0 code NPO sensible en base (71 jsCodes distincts vérifiés)
- ✅ **Cloisonnement** intégralement via `agentScope` — planning n'élargit jamais le scope
- ✅ **Performance** : import ~1 s sur 7 372 lignes, `/today` médiane 270-400 ms
- ✅ **Responsive** : 320 / 375 / 768 / desktop tous OK
- ⚠ Dette technique listée (D1-D7), tous items à impact faible ou très faible
- ⚠ Actions pré-production à exécuter (cf. liste §Actions)

**Aucun bug bloquant.** Feu vert recommandé pour déploiement après exécution des actions pré-prod 1-3.
