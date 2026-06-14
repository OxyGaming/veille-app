# Sprint 4 — Recette finale (C10)

> Date : 2026-06-14
> Reviewer : Claude Code (Opus 4.7) — automatisé, validation PO requise
> Branche : `main` — état au commit `58abe71` (C9) + scripts de recette
> Périmètre : C1 → C9 du Sprint 4 (Hub Échéances)

## 1. Méthodologie

Fixtures réutilisées de Sprint 3 C10 ([`scripts/sprint3-recette-fixtures.ts`](veille-app/scripts/sprint3-recette-fixtures.ts)) — pas de nouvelle fixture nécessaire :

| Entité | ID | Détail |
|---|---|---|
| Team A | `cmq9qr47000007oulk260tl7k` | Rive Droite Nord |
| Team B | `cmqdpbg4d0000o8ulo34y074t` | RECETTE-S3-Rive Gauche Sud |
| EDITOR multi-team | `recette-editor-s3@veille.local` / `recette` | A + B |
| USER team B | `recette-user-b-s3@veille.local` / `recette` | B uniquement |
| ADMIN | `admin@veille.local` / `admin` | global |
| Site A | `cmq9x4kfs0000y8ul8myn94vs` | **occupé** |
| Site B | `cmqdpbg7m0006o8ulqx6xryyo` | **inoccupé** |

Volume du dataset : **323 échéances actives, 72 critiques**.

Tests :
- 3 cookies curl (`/tmp/c_editor.txt`, `/tmp/c_userb.txt`, `/tmp/c_admin.txt`)
- vérifications API REST + scrap HTML SSR
- preview MCP : screenshots, eval, resize sur 320 / 375 / 768 / desktop
- helpers Vitest exécutés manuellement via `tsx -e`

## 2. Accès (lot A)

| # | Scénario | Attendu | Observé | Statut |
|---|---|---|---|---|
| A1 | `GET /api/echeances` sans auth | 401 | 401 | ✅ |
| A2 | `GET /api/echeances` USER | 403 | 403 | ✅ |
| A3 | `GET /api/echeances` EDITOR | 200 | 200, 323 items | ✅ |
| A4 | `GET /api/echeances` ADMIN | 200 | 200, 323 items | ✅ |
| A5 | `GET /echeances` USER (page) | redirect `/today` | **307** redirect | ✅ |
| A6 | `ENABLE_ECHEANCES=false` → `isEcheancesEnabled()` | `false` | `false` | ✅ |
| A7 | `ENABLE_ECHEANCES=true` → idem | `true` | `true` | ✅ |
| A8 | Sans `ENABLE_ECHEANCES` (default) | `true` | `true` | ✅ |

Avec `ENABLE_ECHEANCES=false`, la route renvoie **404** (`{"error":"Disabled"}`) et la page redirige vers `/today` — la logique est dans [src/app/api/echeances/route.ts:48](veille-app/src/app/api/echeances/route.ts#L48) et [src/app/(app)/echeances/page.tsx](veille-app/src/app/(app)/echeances/page.tsx).

## 3. KPI + groupes (lot B)

| Mesure | Valeur |
|---|---|
| `total` | 323 |
| `kpis.late` | 72 |
| `kpis.today` | 0 |
| `kpis.soon` | 1 |
| `kpis.later` | 11 |
| `kpis.future` | 239 |
| `kpis.critical` | 72 |
| `sum(groups)` | 323 |
| `sum(late+today+soon+later+future)` | 323 |

**Cohérence parfaite** : `total = sum(groups) = sum(5 KPI hors critique)` ✅.

Les 5 clés `groups` sont toujours présentes (même si vides), conformément à C2.

## 4. Filtres (lot C)

| # | URL | `total` observé | Vérif |
|---|---|---|---|
| C1 | `?urgency=critical` | 72 | `kpis.critical = 72` ✅ |
| C2 | `?type=VISIT_QUARTERLY` | 2 | kinds = `{VISIT_QUARTERLY}` ✅ |
| C3 | `?siteId=<Site B>` | 2 | siteIds = `{Site B}` ✅ |
| C4 | `?teamId=<Team B>` | 2 | items teamIds ⊃ Team B ✅ |
| C5 | `?type=VISIT_QUARTERLY,VISIT_PLANNED&urgency=late,critical` | 1 | visite trim Site B « jamais » ✅ |
| C6 | Reset (`/api/echeances` sans query) | 323 | `filtersApplied = {}` ✅ |

**URL partageable** : tous les filtres roundtrippent (saisie URL → SSR → DOM). Vérifié via fetch direct.

**Bouton « Réinitialiser »** apparaît dès qu'un filtre est actif (testé C6 du Sprint).

## 5. Règles métier (lot D)

### Cadences
| Constante | Valeur | Source |
|---|---|---|
| `QUARTERLY_VISIT_DAYS` | **90** | [src/lib/today/constants.ts](veille-app/src/lib/today/constants.ts) |
| `OCCUPIED_PLANNED_VISIT_DAYS` | **180** | idem |
| `UNOCCUPIED_PLANNED_VISIT_DAYS` | **365** | idem |
| `visitFrequencyDays("quarterly", true)` | 90 | ✅ |
| `visitFrequencyDays("quarterly", false)` | 90 | ✅ (trim indépendante de l'occupation) |
| `visitFrequencyDays("planned", true)` | 180 | ✅ |
| `visitFrequencyDays("planned", false)` | 365 | ✅ |

### Seuils critique (D13)
| Constante | Valeur |
|---|---|
| `ACTION_CRITICAL_THRESHOLD_DAYS` | 7 |
| `VISIT_CRITICAL_THRESHOLD_DAYS` | 30 |

| Cas | `isCriticalEcheance(...)` | Statut |
|---|---|---|
| Action retard -7 j (limite) | `false` | ✅ |
| Action retard -8 j | `true` | ✅ |
| Visite trim -30 j (limite) | `false` | ✅ |
| Visite trim -31 j | `true` | ✅ |
| Visite jamais effectuée | `true` | ✅ |
| Équipement -1 j | `true` | ✅ |
| Équipement 0 j (expire today) | `false` | ✅ |

### Cadence dynamique en pratique
- **Site A occupé** (POS-GIVORS), visite planifiée la plus récente il y a 3 j → `dueAt = 177 j`, `urgency = future` (180−3=177).
- **Site B inoccupé** (RECETTE-S3-INOCC), visite planifiée la plus récente il y a 201 j → `dueAt = 164 j`, `urgency = future` (365−201=164).

→ Cadences trim/plan **indépendantes** + plan **dynamique selon `Site.isOccupied`** confirmées.

## 6. Liens cross-page + CTA (lots E + F)

### Liens présents dans le HTML SSR
| Source | Cible | Statut |
|---|---|---|
| `/today` (EDITOR) | `/echeances?urgency=critical` | ✅ |
| `/today` (EDITOR) | `/echeances` (lien secondaire) | ✅ |
| `/sites/<A>` | `/echeances?siteId=<A>` (drilldown → Hub) | ✅ |

### CTA observés sur le dataset réel
| Kind | Label observé | Href observé | Statut |
|---|---|---|---|
| `VISIT_QUARTERLY` | « Ouvrir le site » | `/sites/cmqdpbg7m…` | ✅ |
| `VISIT_PLANNED` | « Ouvrir le site » | `/sites/cmqdpbg7m…` | ✅ |
| `ACTION_OVERDUE` (retard -990 j) | « Valider » | `/agents/cmq9sdqb9…?actionId=cmq9ss2gh…` | ✅ |
| `EQUIPMENT_EXPIRING` | (absent du dataset) | — | couvert par `cta.test.ts` (11 tests) |

Le helper [src/lib/echeances/cta.ts](veille-app/src/lib/echeances/cta.ts) garantit l'homogénéité Hub / drilldown (DRY). Garde-fou TypeScript `never` sur `kind`.

## 7. Drilldown site (lot E)

### Site A occupé
- Section « Échéances du site » présente ✅
- Sous-bloc Visite trimestrielle — hint « Cadence 90 jours » ✅
- Sous-bloc Visite planifiée — hint « **Cadence 180 jours (site occupé)** » ✅
- Sous-blocs Équipements + Actions présents (selon contenu)
- Lien retour Hub `?siteId=<A>` ✅

### Site B inoccupé
- Section présente ✅
- Trim → hint « Cadence 90 jours » + badge **CRITIQUE** « jamais effectué » ✅
- Plan → hint « **Cadence 365 jours (site inoccupé)** » ✅
- Sous-blocs Équipements / Actions masqués (rien dans le dataset) ✅
- Lien retour Hub `?siteId=<B>` ✅

## 8. Responsive (lot H)

| Breakpoint | `/today` EDITOR | `/echeances` | `/sites/[id]` | Bottom-nav |
|---|---|---|---|---|
| **320 px** | aucun overflow | aucun overflow (filtres compacts), chips wrap propre | aucun overflow, drilldown OK | 7 cols compactes |
| **375 px** | aucun overflow | aucun overflow | aucun overflow | 7 cols |
| **768 px** | aucun overflow | selects sur 2 col | drilldown lisible | 7 cols (avant breakpoint sidebar) |
| **Desktop** | sidebar + main | conteneur `max-w-5xl` | idem | sidebar 12 entrées (Échéances en 2e) |

Mesure `scrollWidth > clientWidth` = 0 sur chacun. Bottom-nav fixe avec `safe-area-inset-bottom` préservée. USER continue à voir 6 entrées (sans Échéances) — vérifié au C7.

## 9. Performance (lot G)

Médianes sur 3 samples avec dataset complet (323 échéances) :

| Route | Médiane | Cible | Statut |
|---|---|---|---|
| `/today` (EDITOR, badge critique inclus) | **152 ms** | < 500 ms | ✅ |
| `/echeances` | **145 ms** | < 500 ms | ✅ |
| `/echeances?urgency=critical` | **135 ms** | < 500 ms | ✅ |
| `/sites/<Site A>` (occupé, drilldown + reste) | **200 ms** | < 500 ms | ✅ |
| `/sites/<Site B>` (inoccupé) | **113 ms** | < 500 ms | ✅ |

Marge confortable. Le filtrage augmente la perf (moins de rows à mapper). Les requêtes Prisma fan-out en parallèle (`Promise.all`), pas de N+1.

## 10. Couverture Vitest

```
Test Files  12 passed (12)
     Tests  177 passed (177)
  Duration  ~800 ms
```

Décomposition Sprint 4 :
- `echeances/urgency.test.ts` — 17 (classification, group, sort)
- `echeances/criticality.test.ts` — 21 (4 règles D13 + helpers)
- `echeances/sources.test.ts` — 17 (3 sources + composition siteId)
- `echeances/aggregator.test.ts` — 15 (fan-out, KPI, filtres, dédup)
- `echeances/cta.test.ts` — 11 (table de routage par kind)

Plus les 96 tests existants (Sprint 1-3). TypeScript `tsc --noEmit` clean.

## 11. Bugs / réserves / dette

### Bugs bloquants
**Aucun.**

### Bugs mineurs
**Aucun.**

### Réserves & limites assumées
| # | Sujet | Détail / mitigation |
|---|---|---|
| L1 | Filtres en mémoire | Pas de pushdown SQL — acceptable jusqu'à ~1 000 items. Au-delà, prévoir cursor pagination Sprint 5+. |
| L2 | Pas de pagination cross-groupe | « Afficher 25 de plus » est par groupe ; pour parcourir 239 items du groupe `future`, il faut ~10 clics. |
| L3 | Convention slug visite (`trimestrielle-*` / `planifiee-*`) | Décision D7 — pas de champ `cadenceType` explicite. À reprendre si nouvelle famille de templates. |
| L4 | Compteur Today refait 3 requêtes Prisma | `getCriticalEcheancesCount` fait son propre fan-out. Coût marginal (en parallèle), mais duplication possible avec `getSitesWithoutVisit` etc. À mutualiser si la perf l'exige. |
| L5 | Action sans agent ni site → CTA `/today` | Cas pathologique improbable, fallback documenté. |
| L6 | Pas de mise à jour temps-réel | SSR. Refresh manuel nécessaire après une mutation. Cache HTTP `private, max-age=30` minimise l'impact. |
| L7 | Pas d'event `ECHEANCE_DEPASSEE` dans TeamActivity | Cf. D6 — décision PO : pollution du flux. Hub joue ce rôle. |
| L8 | Équipements expirant > 30 j non listés | Décision V1 — couvrirait des centaines d'équipements peu actionnables. Constante `EQUIPMENT_WINDOW_DAYS` ajustable. |
| L9 | `teamsAvailable` ignore les équipes sans échéance | Comportement assumé : on liste tout ce que le user peut filtrer. |
| L10 | Pas de mémorisation cross-page des filtres | Bookmark / partage marche, mais sortir et revenir réinitialise. Acceptable V1. |

### Dette technique
- Convention slug (cf. L3) — à reprendre quand un nouveau type sera nécessaire.
- L'icône `EQUIPMENT_EXPIRING` est `AlertTriangle` par sémantique d'alerte. À ajuster Sprint 5+ si une icône métier dédiée est ajoutée.
- USER voit la section « Échéances du site » sur `/sites/[id]` (sans liens Hub). À masquer si le PO préfère restreindre l'accès complet au pilotage.

## 12. Risques de déploiement

| # | Risque | Probabilité | Sévérité | Mitigation |
|---|---|---|---|---|
| R1 | Templates `trimestrielle-*` / `planifiee-*` absents en prod | basse | élevée (cadences classées `"other"` → invisibles) | Vérifier les slugs en pre-deploy. Test SQL : `SELECT slug FROM SiteVisitTemplate WHERE slug LIKE 'trimestrielle-%' OR slug LIKE 'planifiee-%'`. |
| R2 | `Site.isOccupied` absent (migration C3 Sprint 3 non jouée) | basse | élevée | `prisma migrate deploy` (idempotent). Champ avec défaut `true`. |
| R3 | `criticalCount` Today serait 0 alors qu'il y a des critiques | très basse | moyenne | Couvert par tests Vitest + recette E2E. |
| R4 | Volume > 1 000 échéances dégrade SSR | moyenne | moyenne | Cursor pagination Sprint 5+, ou index Prisma supplémentaires. |
| R5 | Filtres avancés cassent le SSR sur des combinaisons inattendues | basse | basse | Valeurs invalides silencieusement ignorées (`parseFilters` + `isKnownEcheanceKind`). |
| R6 | `ENABLE_ECHEANCES=false` accidentel | basse | élevée (Hub invisible) | Variable d'env documentée. Check pre-deploy. |
| R7 | Régression cache navigateur sur `?urgency=critical` | basse | basse | Cache HTTP `private, max-age=30` clairement scopé par cookie. |

## 13. Actions pré-production

**Obligatoires** :
1. `pnpm exec prisma migrate deploy` (cumulatif Sprint 3 + Sprint 4 — Sprint 4 n'introduit pas de nouvelle migration).
2. Vérifier `SiteVisitTemplate.slug` : au moins un template `trimestrielle-*` et un `planifiee-*` actifs.
3. Vérifier `ENABLE_ECHEANCES` absent ou `true` dans l'environnement cible.
4. Sanity check : `curl -I https://<host>/api/echeances` en EDITOR → 200, `Cache-Control: private, max-age=30, stale-while-revalidate=60`.
5. Vérifier que les flux Sprint 3 restent fonctionnels (photos privées, multi-team, flux activité).

**Recommandées** :
6. Activer la collecte de métriques SSR (durée handler) pour `/api/echeances`, `/today`, `/sites/[id]` — pour observer la dérive avec la volumétrie réelle.
7. Documenter dans le guide utilisateur la signification de « critique » (D13) pour aligner les attentes.
8. Smoke test manuel après déploiement : connexion EDITOR → `/today` (badge critique visible) → click badge → arrivée sur `/echeances?urgency=critical` → click sur une ligne visite → arrivée sur fiche site → section drilldown présente.

**Optionnelles** :
9. Vider le cache navigateur des utilisateurs récents pour qu'ils voient l'entrée « Échéances » dans la nav immédiatement (sinon, attendre le refresh PWA).
10. Si les volumes sont importants en prod (> 500 actions ACTIVE), envisager un `take` plus généreux dans `getActionEcheances` ou un index `ImportedAction(localStatus, dueAt)`.

## 14. SHA Git

Recette jouée sur le commit `58abe71` (C9 — CTA centralisés + perf).
Le présent rapport sera committé en SHA distinct (C10) — référencé à la livraison.
