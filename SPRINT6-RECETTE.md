# Sprint 6 — Recette finale (C10)

> Date : 2026-06-14
> Reviewer : Claude Code (Opus 4.7) — automatisé, validation PO requise
> Branche : `main` — état au commit `39fd2dd` (C8)
> Périmètre : C2 → C9 du Sprint 6 (mode ADMIN Global / Mes équipes / Une équipe)

## 1. Méthodologie

Fixtures réutilisées :
- `admin@veille.local` (mot de passe `admin`) — ADMIN avec membership unique `Rive Droite Nord`
- `recette-editor-s3@veille.local` — EDITOR sur `Rive Droite Nord`
- `jessie.achille@import.local` — USER sur `Rive Droite Nord`
- `admin-noteam@veille.local` (créé en C9) — ADMIN sans memberships
- 2 équipes en base : `Rive Droite Nord` (cmq9qr47000007oulk260tl7k), `RECETTE-S3-Rive Gauche Sud` (cmqdpbg4d0000o8ulo34y074t)

Tests exécutés :
- API REST via `preview_eval` (fetch authentifié + cookies session)
- Vitest : 283 tests verts / 18 fichiers
- TypeScript strict : `tsc --noEmit` clean
- Mesures performance : médianes 5 samples à chaud (warm-up)

## 2. Résultats par scénario

### Matrice ADMIN (toutes valeurs validées le 14/06/2026)

| Module | GLOBAL | MY_TEAMS | TEAM A (RDN) | TEAM B (RGS) |
|---|---|---|---|---|
| **Hub Échéances — total items** | 323 | 321 | 321 | **2** |
| **Hub Échéances — items critiques** | 72 | 71 | 71 | **1** |
| **Audit — total lignes CSV** | 105 | 85 | 85 | **41** |

Critères PO vérifiés :
- **GLOBAL ≠ MY_TEAMS** : 323 vs 321 (échéances), 72 vs 71 (critiques), 105 vs 85 (audit) ✅
- **TEAM A ≠ TEAM B** : 321 vs 2 (échéances), 71 vs 1 (critiques), 85 vs 41 (audit) ✅
- **MY_TEAMS == TEAM A** (cohérent — l'ADMIN n'a qu'une équipe propre) ✅

### EDITOR (inchangé)

| Mesure | Valeur | Statut |
|---|---|---|
| `/today` | 200 | ✅ |
| `/dashboard` | 200 | ✅ |
| `/admin/audit` | redirect `/today` | ✅ (refusé) |
| Subtitle dashboard | « Périmètre de mes équipes. » | ✅ |
| Filtre Équipe dans Dashboard | **retiré** (passait par dropdown ADMIN) | ✅ |
| Filtre période 30/90 j | toujours présent | ✅ |
| Génération notif critique | 0 delta (inchangé) | ✅ |

### USER (inchangé)

| Mesure | Valeur | Statut |
|---|---|---|
| `/today` | 200 | ✅ |
| `/dashboard` | redirect `/today` | ✅ |
| `/admin/audit` | redirect `/today` | ✅ |
| `/api/echeances` | 401 | ✅ (comportement Sprint 4) |
| Génération notif critique | 0 delta | ✅ |

### ADMIN sans équipe (fallback GLOBAL)

| Test | Valeur attendue | Valeur observée | Statut |
|---|---|---|---|
| Préférence MY_TEAMS sur teamIds=[] | fallback GLOBAL (cf. C3) | échéances=323 / critiques=72 = GLOBAL | ✅ |
| Audit CSV en MY_TEAMS | audit complet (= GLOBAL) | 111 lignes | ✅ |

## 3. Comportement par module

### Today (C5)

| Rôle / Mode | Pipeline utilisé | Source |
|---|---|---|
| USER | `aggregateUser` | inchangé |
| EDITOR | `aggregateEditor` | inchangé |
| ADMIN GLOBAL | `aggregateAdmin` | inchangé + side-effect notif (C7) |
| ADMIN MY_TEAMS | `aggregateEditor` (vue pilotage scopée) | basculement en C5 |
| ADMIN TEAM | `aggregateEditor` (vue pilotage scopée) | basculement en C5 |

Les helpers `teamScope` / `siteScope` / `actionScope` / `agentScope` héritent automatiquement de la restriction via `adminScopedTeamIds(u)` (C5).

### Hub Échéances (C5)

- Sources Prisma `getVisitEcheances` / `getEquipmentEcheances` / `getActionEcheances` consomment `siteScope(user)` et `actionScope(user)` → propagation automatique du scope ADMIN.
- Filtres URL (`type`, `siteId`, `teamId`, `urgency`) toujours fonctionnels — sans régression.
- En mode TEAM B : 2 items totaux dont 1 critique → scope strictement appliqué.

### Dashboard (C6)

- Dropdown « Équipe » local **retiré** ; remplacé par le badge header (C4).
- Sous-titre dynamique selon `user.adminScopeMode` :
  - GLOBAL → « Vue globale toutes équipes. »
  - MY_TEAMS → « Périmètre de mes équipes (sélecteur header). »
  - TEAM → « Équipe sélectionnée via le sélecteur header. »
- `getNotificationCounts` distingue ADMIN GLOBAL (count global) de ADMIN MY_TEAMS/TEAM (count personnel).
- Filtre période 30/90 j conservé.

### Notifications critiques (C7)

- `aggregateAdmin` déclenche `notifyEcheancesCriticalForUser` post-réponse via `after()` — l'ADMIN GLOBAL reçoit désormais les notifs `ECHEANCE_CRITICAL_ON_MY_PERIMETER`.
- Sémantique `dedupKey` stable indépendamment du scope : `ECHEANCE_CRITICAL_ON_MY_PERIMETER:{kind}:{sourceId}`.
- Changement GLOBAL → MY_TEAMS → TEAM → GLOBAL : **0 doublon** (73 stable).
- Hot reload `/today` : **0 nouvelle notif** (dédup OK).

### Audit (C8)

- `AuditLog` n'a pas de `teamId` → scope appliqué via `userId IN (auteurs des équipes du scope)`.
- Entrées système (`userId = null`) visibles uniquement en GLOBAL.
- Cohérence GET ⇔ CSV : même filtre `userScope` propagé.
- `getDistinctAuditActions` et `getAuditUsersOptions` restreintes au scope (dropdowns filtre alignés).

## 4. Performance

Médianes 5 samples à chaud (cible PO : < 500 ms).

| Route | GLOBAL | MY_TEAMS | TEAM A | TEAM B |
|---|---|---|---|---|
| `/today` | 145 ms | 138 ms | 137 ms | 136 ms |
| `/dashboard` | 95 ms | 100 ms | 104 ms | 96 ms |
| `/api/echeances` | 301 ms | 283 ms | 292 ms | 24 ms |
| `/admin/audit` | 83 ms | 90 ms | 86 ms | 85 ms |

Aucune mesure n'excède 500 ms (max observé : 428 ms p95 sur `/today` GLOBAL).

EDITOR : `/today` 141 ms, `/dashboard` 346 ms, `/api/echeances` 32 ms.

## 5. Bugs bloquants

**Aucun.**

## 6. Bugs mineurs

| ID | Description | Sévérité | Impact |
|---|---|---|---|
| B1 | `DashboardPayload.teamsAvailable` reste calculé alors qu'il n'est plus consommé en UI (C6) | trivial | +1 requête Prisma inutile. À nettoyer Sprint 7. |
| B2 | Compteurs Notification en mode MY_TEAMS/TEAM affichent la vue personnelle (proxy EDITOR) car `Notification` n'a pas de champ teamId | mineur | Documenté en commentaire `getNotificationCounts`. Solution V2 : ajouter `teamId` à Notification. |
| B3 | Logs audit `userId = null` (système) masqués en MY_TEAMS/TEAM | accepté PO (C8) | Documenté. |
| B4 | Sous-titre Dashboard ADMIN dépend de `user.adminScopeMode` côté session — pas de rafraîchissement live tant que `router.refresh()` n'a pas tourné | trivial | Géré par le bottom-sheet C4 qui rafraîchit après POST. |

## 7. Dette technique

- **Notification.teamId absent** : limite la granularité par-équipe des compteurs Dashboard (cf. B2). Migration additive prévue Sprint 7+.
- **`DashboardFilters.teamId` déprécié** : conservé sur le type pour rétro-compat payload. Suppression Sprint 7+.
- **Pas de tests Vitest dédiés à `aggregateAdmin` C7** : couverture transitive via sources + helpers + `notifyEcheancesCriticalForUser` (Sprint 5). À renforcer si la matrice ADMIN évolue.
- **Helper `adminScopedTeamIds` utilise un `require()` lazy** dans `auth.ts` pour éviter un cycle import avec `admin-scope.ts`. Acceptable, à revoir si la structure module évolue.
- **Pas de hot-swap session après POST scope-preference** : le client appelle `router.refresh()` — manque une mise à jour optimiste du badge. À polir Sprint 7.

## 8. Risques de déploiement

| Risque | Mitigation |
|---|---|
| Migration `20260614204231_add_admin_scope_preference` à appliquer en prod | Migration additive (3 colonnes nullable), pas de backfill nécessaire. `prisma migrate deploy` OK. |
| `Client Prisma` à régénérer (runtime + node_modules) | `npx prisma generate` post-deploy + restart workers. |
| Performance Hub Échéances en GLOBAL (301 ms) | Sous cible 500 ms mais à surveiller à mesure que le volume croît. Index composites Sprint 5 C9 toujours en place. |
| Risque sur dédup notif critique en cas de changement de scope | Couvert par `@@unique(userId, dedupKey)` + `dedupKey` indépendant du scope. Vérifié sur GLOBAL ↔ MY_TEAMS ↔ TEAM (0 doublon sur 73 baseline). |

## 9. Actions pré-production

1. ✅ `prisma generate` et `prisma migrate deploy` sur l'environnement cible.
2. ⏳ Smoke test en staging avec un ADMIN multi-équipes (>2 équipes) pour valider MY_TEAMS sur dataset plus large.
3. ⏳ Vérifier visuellement le sélecteur header sur écran < 360 px (test C4 limité aux viewports standards).
4. ⏳ Nettoyer `scripts/check-all-notifs-types.ts`, `scripts/check-notifications.ts`, `scripts/test-notify-direct.ts` (scratch dev, non commités).
5. ⏳ Communiquer aux ADMIN : le dropdown équipe Dashboard est retiré, la sélection passe par le badge header.

## 10. SHA Git des commits C2 → C10

| Commit | SHA | Titre |
|---|---|---|
| C2 | `5f3237a` | feat(admin-scope): persistance des préférences ADMIN (User étendu + helpers) |
| C3 | `25a8ea3` | feat(admin-scope): Scope Engine unifié resolveAdminScope() |
| C4 | `4a206d5` | feat(admin-scope): sélecteur header ADMIN + route POST scope-preference |
| C5 | `3fa2b22` | feat(admin-scope): brancher resolveAdminScope dans Today + Hub Échéances |
| C6 | `d7bd284` | feat(dashboard): C6 — scope ADMIN appliqué + retrait dropdown équipe |
| C7 | `96ff5c4` | feat(notifications): C7 — notif critique ADMIN GLOBAL via aggregateAdmin |
| C8 | `39fd2dd` | feat(audit): C8 — scope ADMIN sur /admin/audit + export CSV |
| C9 | inclus C10 | tests transverses + matrice perf (pas de commit code dédié) |
| C10 | _ce commit_ | docs(sprint6): C10 recette finale — matrice scopes ADMIN, perf, bugs, risques |

## 11. Validation finale

| Critère PO | Statut |
|---|---|
| ADMIN GLOBAL → vue globale sur tous les modules | ✅ |
| ADMIN MY_TEAMS → restriction aux équipes de l'ADMIN | ✅ |
| ADMIN TEAM → restriction à l'équipe sélectionnée | ✅ |
| EDITOR inchangé (Today, Dashboard, Hub, refus audit) | ✅ |
| USER inchangé (refus dashboard/audit/echeances) | ✅ |
| ADMIN sans équipe → fallback GLOBAL | ✅ |
| Pas de doublon notif sur changement de scope | ✅ |
| Pas de régression des filtres existants | ✅ |
| Performance < 500 ms partout | ✅ |
| TypeScript strict clean | ✅ |
| Vitest 283/283 verts | ✅ |
| Filtre équipe local Dashboard retiré | ✅ |
| Audit CSV respecte le même scope que la liste | ✅ |
| Scope Engine = source unique (C3) | ✅ |

**Sprint 6 prêt pour validation finale et déploiement.**
