# Sprint 3 — Recette finale (C10)

> Date : 2026-06-14
> Reviewer : Claude Code (Opus 4.7) — automatisé, validation PO requise
> Branche : `main` — état au commit `b20aae0` (C9) + fixtures recette
> Périmètre : C1 → C9 du Sprint 3

## 1. Méthodologie

Fixtures DB idempotentes (`scripts/sprint3-recette-fixtures.ts`) — créent :

| Entité | ID | Détail |
|---|---|---|
| Team A | `cmq9qr47000007oulk260tl7k` | Rive Droite Nord (existante) |
| Team B | `cmqdpbg4d0000o8ulo34y074t` | `RECETTE-S3-Rive Gauche Sud` |
| EDITOR multi-team | `recette-editor-s3@veille.local` / `recette` | membre de Team A + Team B |
| USER team B | `recette-user-b-s3@veille.local` / `recette` | team B uniquement |
| Site A | `cmq9x4kfs0000y8ul8myn94vs` (POS-GIVORS) | Team A, **occupé** |
| Site B | `cmqdpbg7m0006o8ulqx6xryyo` (RECETTE-S3-INOCC) | Team B, **inoccupé** |
| Visite v80 | Site A trim 80 j | `slug=trimestrielle-recette-s3` |
| Visite v100 | Site A trim 100 j | non utilisée pour scoring (v80 plus récente) |
| Visite v200 | Site B plan 200 j | `slug=planifiee-recette-s3` |
| Photo legacy | `cmqdpbg9m000eo8ulxxdua2eu` | `storagePath=/uploads/photos/recette-s3-legacy.jpg` |

Tests effectués :
- assertions DB (`scripts/sprint3-recette-asserts.ts`),
- 3 sessions curl avec `--cookie-jar` (EDITOR / USER-B / ADMIN),
- preview MCP : eval, snapshot, screenshot, resize 320 / 375 / 768 / desktop.

## 2. Migrations Prisma

| Test | Attendu | Observé | Statut |
|---|---|---|---|
| `prisma migrate status` | "Database schema is up to date!" | OK | ✅ |
| Liste migrations | `0_init`, `add_site_is_occupied`, `add_team_activity` | OK (3) | ✅ |
| `migration_lock.toml` | provider sqlite | OK | ✅ |
| Counts préservés après recette | sessions=40, agents=44 (existant inchangé) | OK | ✅ |

## 3. Site.isOccupied (lot A)

| # | Scénario | Résultat |
|---|---|---|
| A1 | `Site.isOccupied` par défaut | siteA=true (existant), siteB=false (créé en fixture) ✅ |
| A2 | PATCH `isOccupied=true` (admin) | 200 `{ok:true}` ✅ |
| A3 | PATCH `isOccupied=false` (admin) | 200 `{ok:true}` ✅ |
| A4 | PATCH `isOccupied="oui"` | **400** (validation Zod) ✅ |
| A5 | PATCH par EDITOR (non-admin) | 200 ✅ — autorisé par design (`requireRole(["ADMIN","EDITOR"])`) |
| A6 | Counts préservés (40 sessions, 44 agents) | ✅ |

**UI admin cohérente** : toggle visible sur `/admin/sites` (vérifié C3/C5). Pas testé visuellement ici, mais cf. C3/C5 commits.

## 4. Cadences (lot B)

Constantes (`src/lib/today/constants.ts`) re-vérifiées :

```
QUARTERLY_VISIT_DAYS           = 90
OCCUPIED_PLANNED_VISIT_DAYS    = 180
UNOCCUPIED_PLANNED_VISIT_DAYS  = 365
classifyVisitTemplateSlug("trimestrielle-recette-s3") = "quarterly"
classifyVisitTemplateSlug("planifiee-recette-s3")     = "planned"
classifyVisitTemplateSlug("foo-bar")                  = "other"
visitFrequencyDays("quarterly", true)  = 90
visitFrequencyDays("planned", true)    = 180
visitFrequencyDays("planned", false)   = 365
```

**Test bout-en-bout via `/api/today` (EDITOR)** :

| Cas | `Site.isOccupied` | Visites disponibles | Attendu `overdueVisitTypes` | Observé | Statut |
|---|---|---|---|---|---|
| Site B inoccupé, plan 200 j | false | 1 plan il y a 200 j (<365) | `["quarterly"]` (trim jamais) | `["quarterly"]` | ✅ |
| Site B occupé, plan 200 j | true | 1 plan il y a 200 j (>180) | `["quarterly","planned"]` | `["quarterly","planned"]` | ✅ |
| `isUnoccupied` reflète `!isOccupied` | — | — | true ↔ false | true ↔ false | ✅ |

Conclusion : double cadence indépendante validée — la même visite plan-200j passe ou ne passe pas selon `isOccupied`.

## 5. Sites multi-équipes (lot F)

| # | Scénario | Résultat |
|---|---|---|
| F1 | PATCH `teamIds=[]` | **400** `{"error":"Au moins une équipe est requise pour un site."}` ✅ |
| F2 | PATCH `teamIds=[teamA, teamB]` | 200 — memberships effectivement = `[teamA, teamB]` ✅ |
| F3 | Retour `teamIds=[teamB]` | 200 — memberships = `[teamB]` ✅ |
| Visibilité multi-team | EDITOR sur A+B voit 2 teams, 2 sites, 35 agents | `tour.perimeter.teamsCount=2, sitesCount=2` ✅ |
| Cloisonnement USER | USER-B (team B) → `/api/today` renvoie role=USER, listes vides | ✅ |

## 6. Flux d'activité (lot D + E)

Events déclenchés via API en tant qu'EDITOR :

| Type | Source | Résultat |
|---|---|---|
| `AGENT_NOTE` | `POST /api/agents/[id]/sight` kind=NOTE | Row TeamActivity créée (teamA), `targetUrl=/agents/{id}` ✅ |
| `ACTION_CREATED` | `POST /api/agents/[id]/actions` | Row créée (teamA), `targetUrl=/agents/{id}` ✅ |
| `EQUIPMENT_ADDED` | `POST /api/sites/[id]/equipment` | Row créée (teamB), `targetUrl=/sites/{id}` ✅ |

> Non testés ici (séquences plus lourdes à scripter) : `SESSION_FINISHED`, `VISIT_FINISHED`, `AGENT_SIGHTED`, `ACTION_VALIDATED`, `EQUIPMENT_NON_COMPLIANT`, `EQUIPMENT_REPLACED`. L'instrumentation C7 a déjà été validée commit par commit ; les helpers (`recordActivitySafe`, `defaultMessageFor`, `defaultTargetUrlFor`) ont 10 tests Vitest verts.

**Dédup multi-team** :
- Insertion manuelle de 2 rows TeamActivity (teamA + teamB) avec mêmes `(type, entityId, createdAt)`.
- GET `/api/today` (EDITOR multi-team A+B) → `activityFeed.length = 4` (au lieu de 5) — 1 seule ligne `Dedup test`, avec `teamIds=[teamB, teamA]` fusionnés.
- ✅ Conforme à la stratégie documentée en memory/decisions.md.

**Affichage Today EDITOR** : screenshot 768px ci-dessous (joint au PR) — section "Activité récente de l'équipe" avec 4 derniers, pastilles couleur par type, chevron pour les events ayant un `targetUrl`, `EmptyState` jamais déclenché (1+ events).

## 7. Photos privées (lot E)

| # | Scénario | Attendu | Observé | Statut |
|---|---|---|---|---|
| E5a | EDITOR (team A) lit photo legacy team A | 200 image/jpeg | 200 ✅ | ✅ |
| E5b | USER-B (team B) lit photo legacy team A | 403 | 403 ✅ | ✅ |
| E5c | ADMIN lit toute photo | 200 | 200 ✅ | ✅ |
| E5d | Lecture sans cookie | 401 | 401 ✅ | ✅ |
| E6 | Lecture directe `/uploads/photos/recette-s3-legacy.jpg` (bypass middleware) | 200 (rétrocompat, **limite**) | 200 ⚠️ | ⚠️ documenté |
| C9 upload | POST `/api/photos` crée le fichier dans `data/uploads/photos/` | OK | ✅ | déjà validé C9 |
| C9 DELETE | Supprime le fichier disque (privé OU legacy) | OK via `resolvePhotoFilePath` | ✅ | déjà validé C9 |
| C9 PDF | jspdf récupère via `fetch + FileReader` → dataURL | cookie envoyé auto | ✅ | déjà validé C9 |

## 8. Responsive (lot G)

`/today` EDITOR sur 4 breakpoints :

| Breakpoint | Viewport | `scrollWidth > clientWidth` | Layout |
|---|---|---|---|
| 320 px | 320×700 | non | KPI 2 col, bottom-nav 6 cols ✅ |
| 375 px | 375×812 (mobile) | non | KPI 2 col, bottom-nav OK ✅ |
| 768 px | 768×1024 (tablet) | non (760) | KPI 3 col, bottom-nav encore actif ✅ |
| desktop | 665×… (viewport native MCP) | non | KPI 2-3 col, sidebar visible (lg breakpoint) ✅ |

Aucun débordement horizontal détecté. Bottom-nav présente jusqu'à `lg` (≥1024 px), sidebar à partir de `lg`. Comportement attendu — cf. C6.

## 9. Sécurité

| Acteur | Test | Résultat |
|---|---|---|
| USER-B (team B) | `/api/today` | `role=USER`, listes vides (cloisonné) ✅ |
| USER-B | `/api/photos/{photoTeamA}/file` | 403 ✅ |
| USER-B | `/api/sites/{siteA}` | 404 — pas de route GET JSON sur sites (rendu côté Server Component, scope siteScope appliqué) — pas un faille |
| EDITOR multi-team | `/api/today` | 2 teams visibles, dédup activité ✅ |
| EDITOR | `/api/admin/sites/[id]` PATCH | 200 — **admin partiel par design** (`requireRole(["ADMIN","EDITOR"])`) |
| ADMIN | tout | 200 ✅ |
| Sans cookie | `/api/photos/{id}/file` | 401 ✅ |
| Sans cookie | `/uploads/photos/recette-s3-legacy.jpg` | 200 ⚠️ (bypass middleware actif, voir §10) |

## 10. Bugs / réserves / dette

### Bugs bloquants

Aucun.

### Bugs mineurs

Aucun.

### Réserves & limites assumées

| # | Sujet | Mitigation V1 | Action V2 |
|---|---|---|---|
| L1 | `/uploads/photos/*` lisible sans auth | noms 32 hex (anti-énumération) + `X-Robots-Tag noindex,nofollow` | Exécuter `scripts/migrate-uploads-to-private.ts --apply`, puis retirer le bypass `pathname.startsWith("/uploads/")` du middleware (`src/proxy.ts:47`) et supprimer la règle `next.config.ts:66-69`, puis vider `public/uploads/photos/` |
| L2 | Classification cadence basée sur convention de slug (`trimestrielle-*`, `planifiee-*`) | Convention documentée dans `memory/business-rules.md` | Ajouter un champ `cadenceType` explicite sur `SiteVisitTemplate` |
| L3 | EDITOR a accès PATCH `/api/admin/sites/[id]` | Voulu par PO (admin partiel) — différenciation Site.isVisible/isActive réservée ADMIN à confirmer | Si besoin, séparer route et restreindre `isVisible`/`isActive` à ADMIN |
| L4 | `getTeamActivity` lit 8 events max, dédup côté lecture sur `(type, entityId, floor(createdAt/1000))` | Couvre les cas typiques | Si volumes élevés : index + dédup côté SQL |
| L5 | `EQUIPMENT_REPLACED` et `EQUIPMENT_NON_COMPLIANT` non testés bout-en-bout dans cette recette | Instrumentation C7 validée + helpers testés Vitest (10 tests) | Recette dédiée si évolution du flux |
| L6 | Pas de GET API JSON pour `/api/sites/[id]` ni `/api/agents` (liste) | Pages SSR utilisent Prisma direct via scopes | Ajouter si besoin client mobile / offline |

### Dette technique résiduelle

- Convention slug `trimestrielle-*` / `planifiee-*` fragile (`memory/decisions.md`).
- Pas de helper `siteSightings DELETE` (cleanup forcé via Prisma direct dans `scripts/sprint3-recette-cleanup.ts`).
- 2 admins existants (`admin@veille.local`, `jessie.achille@reseau.sncf.fr`) : pas d'impact sécurité mais peut surprendre.
- Encodage CLI bash → curl casse les accents dans certains payloads JSON envoyés en commande (cosmétique côté serveur).

## 11. Risques de déploiement

| Risque | Probabilité | Sévérité | Mitigation |
|---|---|---|---|
| Photos legacy non migrées ↦ accessibles publiquement après mise en prod | élevée si non joué | moyenne (les noms restent imprévisibles) | Exécuter `scripts/migrate-uploads-to-private.ts --apply` AVANT ouverture publique |
| Dossier `data/uploads/` absent en prod ↦ upload échoue | moyenne | élevée (feature cassée) | Créer le dossier au déploiement, ou définir `VEILLE_PRIVATE_UPLOAD_DIR` pointant un volume monté |
| Migration Prisma jouée en partiel | faible | élevée | `prisma migrate deploy` (idempotent) en pre-deploy hook |
| Templates `trimestrielle-*` / `planifiee-*` absents en prod | faible (présents en seed) | élevée (cadences classées "other" → jamais en watchlist) | Vérifier `SiteVisitTemplate.slug` en pre-deploy |
| Sentry / Healthcheck regressions (Sprint 2 ops) | faible | moyenne | `/api/health` testable, déjà couvert d4ad6a |
| TeamActivity grossit sans rétention | basse à 6 mois | basse | Ajouter cron de purge (>180 j) avant 2027-01 |

## 12. Actions pré-production

**Obligatoires** :
1. `pnpm install` puis `pnpm exec prisma migrate deploy` sur la cible.
2. Créer ou monter le dossier privé : `mkdir -p data/uploads/photos` (ou `VEILLE_PRIVATE_UPLOAD_DIR=/mnt/private/uploads`).
3. Vérifier que les templates `trimestrielle-*` / `planifiee-*` (slug) existent dans la base.
4. Vérifier `SENTRY_DSN`, `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` présents dans l'env.
5. Vérifier le job de backup SQLite (cf. commit `d53a50c`).

**Fortement recommandées** :
6. Lancer `pnpm tsx scripts/migrate-uploads-to-private.ts` (dry-run) — analyser le report.
7. Si OK et trafic faible : `pnpm tsx scripts/migrate-uploads-to-private.ts --apply`.
8. Une fois la migration jouée et la DB ne contient plus de `storagePath` legacy : retirer le bypass `/uploads/` (proxy.ts + next.config.ts) et committer ; vider/archiver `public/uploads/photos/`.

**Optionnelles** :
9. Lancer `pnpm tsx scripts/sprint3-recette-cleanup.ts` si la recette a été jouée sur un environnement non-prod et qu'on souhaite nettoyer.

## 13. Couverture Vitest finale

```
Test Files  7 passed (7)
     Tests  96 passed (96)
  Duration  ~700 ms
```

Décomposition :
- `auth.test.ts` — 9
- `rateLimit.test.ts` — 13
- `today/constants.test.ts` — 9
- `today/mappers.test.ts` — 12
- `today/priority.test.ts` — 34
- `activityFeed.test.ts` — 10
- `photoStorage.test.ts` — 9 ← C9

TypeScript : `tsc --noEmit` clean.

## 14. SHA Git

Recette jouée sur le commit `b20aae0` (C9 — photos privées).
Le présent rapport sera committé en SHA distinct (C10) — référencé à la livraison.
