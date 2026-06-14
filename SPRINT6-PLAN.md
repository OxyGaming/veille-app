# SPRINT6-PLAN.md — Plan d'exécution Sprint 6

> **Périmètre** : doter l'**ADMIN** d'un **sélecteur de périmètre dynamique** (Global / Mes équipes / Équipe X) consommé par Today, Hub Échéances, Dashboard, Notifications critiques et Audit. **Aucune modification des droits** : l'ADMIN garde tous ses accès.
> **Date** : 2026-06-14.
> **Sprint** : Sprint 6 (~75 h de capacité solo + IA).
> **Documents amont** : [SPRINT5-RECETTE.md](SPRINT5-RECETTE.md), [memory/business-rules.md](memory/business-rules.md), [memory/decisions.md](memory/decisions.md).

---

## 0. Décisions PO (validées en amont)

| # | Sujet | Décision retenue |
|---|---|---|
| D1 | Mode par défaut | **GLOBAL** pour les ADMIN existants. Valeurs : `GLOBAL` / `MY_TEAMS` / `TEAM` |
| D2 | Persistance | **Mémoriser le dernier choix utilisateur** côté DB : `{ adminScopeMode, adminTeamId }`. Restoré au login |
| D3 | Périmètre « Mes équipes » | Utiliser les `User.memberships` existantes. ADMIN sans équipe → **fallback `GLOBAL`** (RG1). ADMIN multi-équipes → union de ses équipes |
| D4 | Équipe spécifique | Dropdown équipe disponible **uniquement en mode `TEAM`** |
| D5 | Modules impactés | **Today · Échéances · Dashboard · Notifications critiques · Audit**. PAS d'impact : administration users, paramétrage, maintenance |
| D6 | Visibilité du mode | **Badge cliquable** dans le header : `Global` · `Mes équipes` · `Équipe X` |
| D7 | Audit du changement de vue | **Aucun AuditLog** lors d'un changement de périmètre — ce n'est pas une action sensible |

---

## 0.1 Acquis Sprint 1-5 réutilisés

| Acquis | Localisation | Usage Sprint 6 |
|---|---|---|
| Scopes `teamScope` / `siteScope` / `actionScope` / `agentScope` | [src/lib/auth.ts](veille-app/src/lib/auth.ts) | Doivent être englobés par le nouveau `resolveAdminScope()` — pas de réécriture, juste un wrapper conditionnel |
| `SessionUser` (typage) | idem | Étendu de 2 champs (`adminScopeMode`, `adminTeamId`) |
| Pattern feature flag | [src/lib/featureFlags.ts](veille-app/src/lib/featureFlags.ts) | `ENABLE_ADMIN_SCOPE_SELECTOR` (default true) pour rollback rapide |
| Pattern URL search params client + `useRouter().replace` | [Sprint 4 C6, Sprint 5 C5/C6](.) | Pas applicable ici (préférence persistée DB), mais pattern UI réutilisable |
| `aggregateEcheances`, `aggregateDashboard`, `aggregateAuditLogs`, `aggregateNotifications` | Sprint 4-5 | **Tous** doivent appeler `resolveAdminScope()` au lieu des scopes directs pour ADMIN |
| Pattern dédup `Notification.dedupKey` | Sprint 5 C2 | Préservé tel quel — la dédup `ECHEANCE_CRITICAL` reste stable malgré le changement de scope (RG4) |
| AppShell + NotificationsBell | Sprint 5 C5 | Ajout du badge sélecteur dans le header (cohabite avec EDIT, Bell, logout) |

**Aucun modèle métier n'est cassé.** Sprint 6 = couche d'abstraction au-dessus des scopes existants.

---

## 0.2 Contraintes assumées

- **Aucune modification des droits ADMIN** : un ADMIN garde la possibilité de tout voir.
- **EDITOR et USER inchangés** : leurs scopes (memberships) restent appliqués sans option de bascule.
- **`resolveAdminScope()` est la source unique** consommée par tous les agrégateurs concernés (RG2).
- **Aucun breaking change** : `siteScope(user)`, `teamScope(user)`, etc. conservent leur signature.
- **Pas d'audio / push / email** (cohérent PO 2026-06-14).
- **Responsive 320 / 375 / 768 / desktop** pour le sélecteur header.
- **Multi-équipes compatible** systématiquement.

---

## 1. Synthèse globale

### 1.1 Ordre optimal des commits

```
SEMAINE 1 — Fondations data (10-14 h)
  C1  S6-DOC : plan + arbitrages D1-D7 (validés)                1-2 h
  C2  S6-01  : modèle User étendu + migration                   6-8 h
  C3  S6-02  : Scope Engine resolveAdminScope() + tests        8-10 h

SEMAINE 2 — UI sélecteur + Today/Hub (12-16 h)
  C4  S6-03  : sélecteur header ADMIN (badge + dropdown)       6-8 h
  C5  S6-04  : intégration Today + Hub Échéances               6-8 h

SEMAINE 3 — Dashboard / Notif / Audit (14-18 h)
  C6  S6-05  : intégration Dashboard (filtre équipe → scope)    4-6 h
  C7  S6-06  : intégration Notifications critiques              4-6 h
  C8  S6-07  : intégration Audit ADMIN                          4-6 h

SEMAINE 4 — Polish + recette (10-14 h)
  C9  S6-08  : tests transverses + optimisation                 4-6 h
  C10 S6-RECETTE : SPRINT6-RECETTE.md                           6-8 h
```

**Total brut** : 49-66 h.
**Effort net solo + IA estimé** : ~50-65 h.
**Capacité Sprint 6** : 75 h.
**Marge** : ~10-25 h (confortable, permet de gérer un imprévu de scope).

### 1.2 Dépendances entre commits

```
C1 (DOC)   ─── préalable, déjà fait

C2 (User étendu + migration) ─→ C3 (Scope Engine lit les champs)
                              ─→ C4 (UI lit + sauvegarde les champs)

C3 (Scope Engine) ─→ C5 (Today + Hub)
                  ─→ C6 (Dashboard)
                  ─→ C7 (Notifications)
                  ─→ C8 (Audit)

C4 (UI sélecteur) ─── indépendant de C5-C8 ; nécessite C2 + C3

C5-C8 (intégrations modules) ─── parallélisables une fois C3 livré

C9 (tests transverses) ─→ C10 (recette)
```

### 1.3 Points de démo

- **Fin semaine 1** : `resolveAdminScope()` testable avec mocks (3 modes × cas ADMIN/EDITOR/USER).
- **Fin semaine 2** : ADMIN peut basculer Global ↔ Mes équipes ↔ Équipe X → Today et Hub se mettent à jour.
- **Fin semaine 3** : Dashboard, Notifications, Audit tous alignés sur le même scope.
- **Fin semaine 4** : SPRINT6-RECETTE.md livré.

---

## 2. Règles métier (rappel + ajouts Sprint 6)

| Règle | Valeur | Source |
|---|---|---|
| Visite trimestrielle / planifiée occupé / inoccupé | 90 / 180 / 365 j | PO 2026-06-12 |
| Échéance critique (D13 Sprint 4) | Action > 7 j retard · Visite > 30 j ou jamais · Équipement périmé | PO Sprint 4 |
| Multi-équipes | `SiteTeam`, au moins 1 équipe par site | S3-C5 |
| Notifications V1 | In-app, 4 types max | S5 D1 |
| Rétention | TA 180 j · Audit 365 j · Notif 90/180 j | S5 D6 |
| **Modes ADMIN** | `GLOBAL` (défaut) / `MY_TEAMS` / `TEAM` — **persisté en DB** | **Sprint 6 D1+D2** |
| **Fallback ADMIN sans équipe** | `MY_TEAMS` ou `TEAM` impossible → forcé `GLOBAL` côté serveur | **Sprint 6 D3** |
| **Pas d'audit du changement de vue** | Pas d'AuditLog | **Sprint 6 D7** |
| **EDITOR / USER inchangés** | Leur scope reste basé sur `memberships` | **Sprint 6** |
| Audio / vocal / IA vocale | **ABANDONNÉ DÉFINITIVEMENT** | PO 2026-06-14 |

---

## 3. User Stories Sprint 6

### US-6.1 — Préférences ADMIN persistées
> **En tant qu'**ADMIN, **je veux** que mon choix de périmètre soit mémorisé entre deux sessions, **afin de** ne pas avoir à re-sélectionner à chaque connexion.

**Critères d'acceptation** :
- `User` étendu de 2 champs nullable : `adminScopeMode` (string), `adminTeamId` (string).
- Migration Prisma additive, sans valeur par défaut → champ null = comportement actuel (GLOBAL).
- Helper `setAdminScope(userId, { mode, teamId })` + `getAdminScope(userId)` (V1.5 via `resolveAdminScope()` directement).

### US-6.2 — Sélecteur de périmètre dans le header
> **En tant qu'**ADMIN, **je veux** voir et changer mon périmètre en 2 clics depuis le header, **afin de** basculer rapidement sans naviguer.

**Critères d'acceptation** :
- Badge cliquable visible header mobile + sidebar desktop pour ADMIN uniquement.
- Affiche : `Global` / `Mes équipes` / `Équipe X` selon `adminScopeMode`.
- Click → dropdown ou bottom sheet avec 3 options + (si TEAM) liste des équipes.
- Sélection → POST côté API → re-render (router.refresh()).
- Aucun affichage pour EDITOR / USER.

### US-6.3 — Scope Engine `resolveAdminScope()`
> **En tant que** mainteneur, **je veux** une fonction unique qui résout le périmètre effectif d'un user, **afin de** garantir la cohérence entre les modules.

**Critères d'acceptation** :
- `resolveAdminScope(user)` renvoie `{ mode, teamIds, isGlobal }`.
- Pour USER / EDITOR : passthrough (`mode=MY_TEAMS`, `teamIds = user.teamIds`, `isGlobal = false`).
- Pour ADMIN :
  - `mode=GLOBAL` → `{ mode: 'GLOBAL', teamIds: [], isGlobal: true }`
  - `mode=MY_TEAMS` → si user.teamIds vide → fallback GLOBAL ; sinon `{ mode: 'MY_TEAMS', teamIds: user.teamIds, isGlobal: false }`
  - `mode=TEAM` → si `adminTeamId` invalide → fallback GLOBAL ; sinon `{ mode: 'TEAM', teamIds: [adminTeamId], isGlobal: false }`
- 15+ tests Vitest couvrant les cas et les fallbacks.

### US-6.4 — Today consomme le scope
> **En tant qu'**ADMIN, **je veux** que Today (`/today` + `/api/today`) respecte mon périmètre choisi.

**Critères d'acceptation** :
- `aggregateAdmin` (Today) ne fait plus de fan-out global ; appelle `resolveAdminScope()` pour fixer ses requêtes Prisma.
- Mode GLOBAL : comportement actuel maintenu (no-op visible).
- Mode MY_TEAMS / TEAM : counts, activité, badge critique restreints au périmètre.

### US-6.5 — Hub Échéances consomme le scope
> **En tant qu'**ADMIN, **je veux** que `/echeances` respecte mon périmètre.

**Critères d'acceptation** :
- `aggregateEcheances` reçoit le scope résolu (via wrapper sur `siteScope` et `actionScope`).
- Items + KPI + groupes alignés.
- Pas de régression EDITOR / USER.

### US-6.6 — Dashboard consomme le scope (et **supprime le filtre équipe**)
> **En tant qu'**ADMIN, **je veux** que `/dashboard` respecte mon périmètre, sans filtre équipe dans la page (le sélecteur header devient la source unique).

**Critères d'acceptation** :
- `aggregateDashboard` lit `resolveAdminScope()`.
- Le filtre équipe local Dashboard (S5 C7) est **retiré** au profit du badge header.
- KPI + tendances + sparklines alignés.

### US-6.7 — Audit ADMIN consomme le scope
> **En tant qu'**ADMIN, **je veux** que `/admin/audit` respecte mon périmètre.

**Critères d'acceptation** :
- Mode GLOBAL : tous les logs (comportement actuel).
- Mode MY_TEAMS / TEAM : `userId IN (users du périmètre)` OU `details.teamId IN (...)` — règle à fixer en C8 (probablement filtrage par `userId` des users appartenant aux équipes ciblées).
- Cas limite : logs sans `userId` (système) restent visibles seulement en mode GLOBAL.

### US-6.8 — Notifications critiques consomment le scope
> **En tant qu'**ADMIN, **je veux** ne pas être noyé sous des centaines de notifs `ECHEANCE_CRITICAL` quand je passe en « Mes équipes ».

**Critères d'acceptation** :
- `aggregateEditor` (Today, qui déclenche `notifyEcheancesCriticalForUser` via `after()`) utilise le scope résolu.
- ADMIN en mode `MY_TEAMS` ou `TEAM` ne reçoit que les notifs des items critiques de ce scope.
- **`dedupKey` inchangée** (`ECHEANCE_CRITICAL_ON_MY_PERIMETER:{kind}:{sourceId}`) — RG4. Conséquence : si l'ADMIN bascule GLOBAL puis MY_TEAMS, les notifs déjà créées en GLOBAL ne se re-créent pas (dédup stable).
- Pas de fuite cross-user.

### US-6.9 — Recette E2E
> **En tant que** PO, **je veux** valider chacun des 6 cas (ADMIN global, MY_TEAMS, TEAM, ADMIN sans équipe, EDITOR inchangé, USER inchangé).

---

## 4. Détail par commit

### Commit 1 — S6-DOC : plan + arbitrages PO

**Périmètre** : intégration des décisions D1-D7 validées dans ce document. No-code.

**Estimation** : **1-2 h** (S).

---

### Commit 2 — S6-01 : modèle User étendu + migration

**Périmètre** :

```prisma
model User {
  // ... champs existants
  adminScopeMode  String?   // "GLOBAL" | "MY_TEAMS" | "TEAM" — null = comportement par défaut (GLOBAL)
  adminTeamId     String?   // requis en mode TEAM
}
```

- Migration additive, **aucune valeur par défaut** — un user existant a `null` (= GLOBAL pour ADMIN).
- Helpers `setAdminScopePreference(userId, payload)` + `getAdminScopePreference(userId)`.
- Tests Vitest sur les helpers (mocks Prisma).

**Risque** : R2.1 — choisir entre `User` étendu OU `UserPreference` séparée. **Décision** : `User` étendu (2 champs) — V2 envisagerait une table dédiée si d'autres préférences s'ajoutent.

**Estimation** : **6-8 h** (M).

---

### Commit 3 — S6-02 : Scope Engine `resolveAdminScope()` + tests

**Périmètre** :

```ts
// src/lib/admin-scope.ts (nouveau)
export type AdminScopeMode = "GLOBAL" | "MY_TEAMS" | "TEAM";

export type ResolvedScope = {
  mode: AdminScopeMode;
  teamIds: string[];      // [] pour GLOBAL
  isGlobal: boolean;
};

export function resolveAdminScope(user: SessionUser): ResolvedScope;
```

- Pour `USER` / `EDITOR` : passthrough `{ mode: "MY_TEAMS", teamIds: user.teamIds, isGlobal: false }`.
- Pour `ADMIN` :
  - `adminScopeMode = null | "GLOBAL"` → GLOBAL
  - `adminScopeMode = "MY_TEAMS"` → si user.teamIds vide → GLOBAL ; sinon MY_TEAMS
  - `adminScopeMode = "TEAM"` → si `adminTeamId` absent OU invalide → GLOBAL ; sinon TEAM avec `[adminTeamId]`
- Wrappers `siteScopeFor(user, scope)`, `teamScopeFor(user, scope)`, etc. — alternatives aux helpers existants quand on veut respecter le scope ADMIN.

**Tests Vitest (cible 15+)** :
- 3 cas USER / EDITOR / ADMIN par défaut
- 3 modes ADMIN × cas heureux
- ADMIN sans équipe + mode MY_TEAMS → fallback GLOBAL
- ADMIN avec mode TEAM mais teamId invalide → fallback GLOBAL
- Cas ADMIN multi-team

**Risque** : R3.1 — divergence entre les helpers `siteScope` existants et `siteScopeFor` nouveaux. **Mitigation** : `siteScopeFor` est un sur-ensemble qui appelle `siteScope` quand `scope.mode === "MY_TEAMS"`. Cas par cas testé.

**Estimation** : **8-10 h** (L).

---

### Commit 4 — S6-03 : sélecteur header ADMIN

**Périmètre** :
- Composant `AdminScopeSelector` (Client) dans `src/components/`.
- Affichage badge :
  - GLOBAL → `[ Global ▼ ]`
  - MY_TEAMS → `[ Mes équipes ▼ ]`
  - TEAM → `[ Équipe RDN ▼ ]` (nom)
- Click → dropdown ou bottom sheet :
  - Bouton « Vue globale »
  - Bouton « Mes équipes »
  - Section « Une équipe » + liste des équipes (memberships ADMIN ou toutes pour viewAllTeams)
- Sélection → `POST /api/me/admin-scope` avec `{ mode, teamId? }`.
- Le serveur valide (cf. C2 helpers) puis renvoie 200.
- Côté client : `router.refresh()` pour re-render les Server Components.

**Routes** :
- `POST /api/me/admin-scope` — auth requise, **ADMIN-only** (les autres rôles → 403 sans effet).

**Intégration AppShell** :
- Visible UNIQUEMENT pour ADMIN (mobile header + sidebar desktop).
- Pas d'entrée bottom-nav.

**Risque** : R4.1 — sélecteur prend trop de place sur mobile 320 px. **Mitigation** : badge compact + bottom sheet plein écran pour la sélection.

**Estimation** : **6-8 h** (M).

---

### Commit 5 — S6-04 : intégration Today + Hub Échéances

**Périmètre** :
- `aggregateAdmin` (Today, `src/lib/today/aggregator.ts`) consomme `resolveAdminScope()` pour fixer ses queries.
- `aggregateEcheances` (Hub, `src/lib/echeances/aggregator.ts`) idem.
- Les helpers `siteScope` et `actionScope` restent appelés via wrappers `siteScopeFor(user, scope)`.
- Aucun changement EDITOR/USER (passthrough).

**Tests** :
- 4 tests Vitest sur `aggregateAdmin` (3 modes + sans équipe).
- 4 tests Vitest sur `aggregateEcheances` ADMIN (3 modes + sans équipe).
- E2E preview : ADMIN bascule, voit les counts changer.

**Risque** : R5.1 — `aggregateEcheances` ré-utilisé en C5 du Dashboard et en C7 (notifs critiques). Toute modif côté périmètre doit être cohérente. **Mitigation** : injecter `resolvedScope` en argument optionnel, default = `resolveAdminScope(user)`.

**Estimation** : **6-8 h** (M).

---

### Commit 6 — S6-05 : intégration Dashboard (retrait filtre équipe)

**Périmètre** :
- `aggregateDashboard` consomme `resolveAdminScope()`.
- **Retrait du filtre équipe** du composant `DashboardFiltersBar` (S5 C7).
- Le scope vient désormais uniquement du header. Cohérence garantie.
- Filtre période 30/90 j conservé.

**Risque** : R6.1 — utilisateur habitué à la dropdown équipe Dashboard. **Mitigation** : noter dans la doc utilisateur, badge sélecteur header est plus visible.

**Estimation** : **4-6 h** (S+).

---

### Commit 7 — S6-06 : intégration Notifications critiques

**Périmètre** :
- `notifyEcheancesCriticalForUser` reçoit les items déjà scopés par `aggregateEditor/aggregateAdmin`.
- `dedupKey` inchangée (`ECHEANCE_CRITICAL_ON_MY_PERIMETER:{kind}:{sourceId}`) — RG4.
- Conséquence côté ADMIN basculant : pas de re-création de notifs déjà existantes.
- Pas d'impact sur EDITOR.

**Tests** :
- 3 tests : ADMIN mode GLOBAL, ADMIN mode TEAM, EDITOR (inchangé).
- Vérifier que la dédup empêche les doublons après bascule.

**Estimation** : **4-6 h** (S+).

---

### Commit 8 — S6-07 : intégration Audit

**Périmètre** :
- `aggregateAuditLogs` consomme `resolveAdminScope()`.
- Mode GLOBAL : pas de filtre (comportement actuel).
- Mode MY_TEAMS / TEAM : `userId IN (users du périmètre)` — calculé via une sous-requête sur `UserTeam`.
- Cas limite : logs sans `userId` (système) → visibles seulement en GLOBAL.

**Tests** :
- 3 modes × cas heureux
- Cas système (userId null) visible/invisible selon mode

**Risque** : R8.1 — sous-requête sur `UserTeam` peut être coûteuse. **Mitigation** : index existant `UserTeam(teamId)`, requête simple.

**Estimation** : **4-6 h** (M).

---

### Commit 9 — S6-08 : tests transverses + optimisation

**Périmètre** :
- Tests Vitest sur les 4 agrégateurs avec scope résolu.
- Tests E2E manuels (preview) : ADMIN bascule, vérifier cohérence cross-modules.
- Profilage : mesurer perf `/today`, `/echeances`, `/dashboard` avec scope appliqué — viser inchangé vs Sprint 5.

**Estimation** : **4-6 h** (S+).

---

### Commit 10 — S6-RECETTE : tests E2E + SPRINT6-RECETTE.md

**Périmètre** :
- Grille de recette : 6 cas (ADMIN global, MY_TEAMS, TEAM, ADMIN sans équipe, EDITOR, USER).
- Vérification cross-modules : pour chaque scope, les 5 surfaces (Today, Échéances, Dashboard, Audit, Notif) montrent le même périmètre.
- Performance : médianes 3 samples par route.
- Responsive header sélecteur 320/375/768/desktop.
- Rapport `SPRINT6-RECETTE.md`.

**Estimation** : **6-8 h** (M).

---

## 5. Estimations globales

| Commit | Sujet | Min | Max |
|---|---|---|---|
| C1 | Doc + arbitrages D1-D7 (fait) | 1 | 2 |
| C2 | User étendu + migration + helpers | 6 | 8 |
| C3 | Scope Engine + 15+ tests | 8 | 10 |
| C4 | Sélecteur header ADMIN + route POST | 6 | 8 |
| C5 | Intégration Today + Hub Échéances | 6 | 8 |
| C6 | Intégration Dashboard (retrait filtre équipe) | 4 | 6 |
| C7 | Intégration Notifications critiques | 4 | 6 |
| C8 | Intégration Audit | 4 | 6 |
| C9 | Tests transverses + perf | 4 | 6 |
| C10 | Recette + SPRINT6-RECETTE.md | 6 | 8 |
| **Total** | | **49 h** | **68 h** |

Capacité Sprint : **75 h**.
Marge confortable : **7-26 h**.

---

## 6. Risques globaux Sprint 6

| # | Risque | Probabilité | Sévérité | Mitigation |
|---|---|---|---|---|
| RG1 | ADMIN sans équipe → fallback GLOBAL inattendu | moyenne | basse | Explicitement implémenté C3 + test dédié |
| RG2 | Scopes divergents entre modules | moyenne | élevée | **`resolveAdminScope()` unique** + tests transverses C9 |
| RG3 | Régression EDITOR | basse | élevée | Tests Vitest dédiés EDITOR par module |
| RG4 | Notifications critiques recréées lors du changement de scope | basse | moyenne | **`dedupKey` inchangée** — la dédup stable empêche les doublons |
| RG5 | UI sélecteur prend trop de place 320 px | moyenne | basse | Badge compact + bottom sheet plein écran |
| RG6 | Performance dégrade en mode MY_TEAMS sur grosse base | basse | moyenne | Indexes Sprint 5 + monitoring perf post-déploiement |
| RG7 | Préférence corrompue (mode TEAM mais teamId effacé) | basse | basse | Fallback GLOBAL côté serveur (C3) + sanity check au login |
| RG8 | Migration User incompatible avec rétro-compat | basse | élevée | Champs nullable, aucun comportement par défaut |

---

## 7. Stratégie de recette

### 7.1 Fixtures

Reprendre les fixtures Sprint 3 C10 (`recette-editor-s3`, `recette-user-b-s3`, Site A/B). Pour Sprint 6 ajouter :
- `recette-admin-multiteam@veille.local` (ADMIN avec memberships Team A + Team B)
- `recette-admin-noteam@veille.local` (ADMIN sans `memberships` — pour tester le fallback)

### 7.2 Grille C10

| Cas | Today | Échéances | Dashboard | Audit | Notif |
|---|---|---|---|---|---|
| ADMIN mode GLOBAL | global | global | global | global | global |
| ADMIN mode MY_TEAMS | scope | scope | scope | scope | scope |
| ADMIN mode TEAM | 1 team | 1 team | 1 team | 1 team | 1 team |
| ADMIN sans équipe + MY_TEAMS | fallback GLOBAL | fallback | fallback | fallback | fallback |
| EDITOR (inchangé) | memberships | memberships | memberships | 403 | memberships |
| USER (inchangé) | memberships | redirect /today | redirect /today | 403 | memberships |

### 7.3 Outils
- 4 cookies curl (admin-multiteam, admin-noteam, editor, user-b)
- Preview MCP screenshots 4 breakpoints
- Scripts `sprint6-recette-fixtures.ts` + asserts + cleanup
- Vitest run complet (cible ≥ 270 tests = 237 + ~35 nouveaux)

---

## 8. Critères de succès / DoD Sprint 6

1. Un ADMIN peut basculer Global ↔ Mes équipes ↔ Équipe X **en moins de 2 clics**.
2. Sur les 5 modules concernés (Today, Échéances, Dashboard, Audit, Notif), le périmètre observé est **strictement identique** entre eux (cohérence).
3. ADMIN sans équipe en mode MY_TEAMS → fallback transparent en GLOBAL.
4. EDITOR et USER **inchangés** (zero régression).
5. Performance des routes critiques **inchangée** ou améliorée vs Sprint 5.
6. Le badge sélecteur header est visible 320 → desktop sans overflow.
7. 270+ tests Vitest verts.
8. SPRINT6-RECETTE.md livré.
9. Aucune modif des droits ADMIN (les routes admin restent accessibles quel que soit le mode).

---

## 9. Hors périmètre Sprint 6

Explicitement **hors** scope, à arbitrer Sprint 7+ :
- Préférences EDITOR / USER (page paramètres).
- Sélecteur de période globale (déjà géré par modules).
- Notifications push, email, SMS.
- Modes de scope avec opérateur (intersection / union) au-delà des 3 cas.
- Drilldown du sélecteur vers une vue arbre des équipes.
- Audit du **changement** de scope (cf. D7 — explicitement refusé).
- Modification de la couleur du badge selon le mode (visuel V2+).

---

## 10. Validation et démarrage

Décisions D1-D7 **validées** en amont du plan. Je peux démarrer C2 dès que ce document est validé.

Démos hebdo à la fin de chaque semaine. Validation/correction immédiate.
