# SPRINT2-RECETTE.md — Recette finale du module « Aujourd'hui »

> **Date** : 2026-06-14.
> **Sprint** : Sprint 2 (US-2.1 — écran `/today`).
> **Périmètre** : C1 à C12. Aucun nouveau développement, uniquement vérifications.
> **Posture** : tester, observer, documenter. Recetter avant clôture.

---

## 0. Synthèse exécutive

| Indicateur | Cible | Mesuré | Statut |
|---|---|---|---|
| Tests Vitest | 100 % verts | 68/68 verts | ✅ |
| Commits livrés | 11 (C1-C11) | 11 + C12 (recette) | ✅ |
| LCP `/api/today` (5 samples) | < 300 ms | 30 ms p50, 32 ms p95 | ✅ |
| Render serveur RSC | < 300 ms | 22-27 ms typique | ✅ |
| Régressions UI | 0 | 0 détectée | ✅ |
| Bugs bloquants | 0 | 0 | ✅ |
| Bugs mineurs | — | 2 cosmétiques (cf. §6) | — |
| Audio | abandonné | 0 trace dans code/docs | ✅ |
| Règles métier 90/180/365 j | documentées | constants.ts + mémoire | ✅ |

**Verdict** : Sprint 2 prêt pour bascule production sous `ENABLE_TODAY=true` après validation PO.

---

## 1. Résultats par scénario

### 1.1 USER

| Scénario | Test | Statut |
|---|---|---|
| Accès `/today` | Login `recette-user@example.local` + nav | ✅ |
| Header USER | "Bonjour Recette ☀️" + date + équipe | ✅ |
| Carte « En cours » | Masquée si aucune session/visite draft | ✅ |
| Carte « En cours » (avec data) | Affichée + badge "Brouillon ancien" si > 7 j | ✅ C5 |
| Section « À traiter aujourd'hui » | 5 cartes rouges sur 50 disponibles | ✅ |
| Raccourcis | 3 boutons (Démarrer veille / visite / Mes agents) | ✅ |
| Dernières activités | Masquée si vide, 3 lignes sinon | ✅ |
| Cas sans activité | Tout masqué proprement (carte En cours, recent) | ✅ |
| Cas sans action | Empty state vert "Aucune urgence aujourd'hui" | ✅ C5 |
| Cas > 20 actions | Limit 5 affichées + bouton "Voir tout (N) — bientôt" disabled | ✅ (50 actions remontées) |
| Refresh automatique | Timer 60 s validé par code (`INTERVAL_MS = 60_000`) | ✅ |
| Refresh retour focus | Cycle visibility hidden→visible déclenche 1 GET /today | ✅ live |
| Refresh retour réseau | `online` event déclenche 1 GET /today | ✅ live |

### 1.2 EDITOR

| Scénario | Test | Statut |
|---|---|---|
| Bannière diagnostic état rouge | `recette-editor@example.local`, 71 actions retard → 🔴 "Action nécessaire" | ✅ |
| État vert | Validé par code (`getEditorDiagnostic` → green si tous compteurs = 0) | ✅ code |
| État orange | Validé par code (yellow si lateVisits > 0 OU expiringEquipments > 0 mais pas de retard critique) | ✅ code |
| KPI équipe — Périmètre (3) | Actions en retard (71), Sites à visiter (0), Équipements (0) | ✅ |
| KPI équipe — Activité semaine (3) | Veilles (6), Visites (4), Validations (3) | ✅ |
| Watchlist agents | 5 sur 25 affichés, "Jamais veillé" + badge "X actions" | ✅ |
| Watchlist sites | Empty state vert "Aucun site en retard de visite trimestrielle." | ✅ |
| Cas équipe vide | Non reproductible en live (1 seule équipe en DB) — validé par code | ⚠ partiel |
| Cas équipe avec beaucoup d'agents (>20) | 25 agents → top 5 + "Voir tous (25) — bientôt" | ✅ |
| Responsive complet | 320 / 375 / 768 / 1280 — pas de débordement | ✅ |

### 1.3 ADMIN

| Scénario | Test | Statut |
|---|---|---|
| Statut système | Bannière rouge "Incident système" (backup absent) | ✅ |
| Alertes | 1 ligne verte "Aucune anomalie de connexion (24 h)" | ✅ |
| Usage 7 jours | 40 Veilles · 9 Visites · 3 Validations · 3 Photos | ✅ |
| Activité système | 5 dernières entrées AuditLog formatées | ✅ |
| Cas backup absent | État `incident`, label "aucune sauvegarde détectée" | ✅ (cas courant en dev) |
| Cas backup récent | Validé par code (helper `formatBackup` : « il y a X h » / « hier » / « le date ») | ✅ code |
| Cas LOGIN_FAILED élevé | Validé par code : ≥ 10 = warn, ≥ 50 = error | ✅ code |
| Cas sans alerte | Validé par code : `getAdminAlerts` retourne au minimum 1 alerte info "Aucune anomalie" | ✅ code |

---

## 2. Responsive

Tests effectués aux 4 viewports demandés pour les 3 rôles :

| Viewport | USER | EDITOR | ADMIN |
|---|---|---|---|
| **320 × 568** | ✅ (header wrap, 2-cols KPI, raccourcis 3-cols serrés) | ✅ (KPI 2 cols, bannière sur 3 lignes) | ✅ (KPI 2 cols, activité multi-ligne) |
| **375 × 812** | ✅ aéré | ✅ aéré | ✅ aéré |
| **768 × 1024** | ✅ (cards pleine largeur du container) | ✅ (KPI 3 cols) | ✅ (KPI 3 cols, 4ᵉ sur 2ᵉ ligne) |
| **Desktop ≥ 1280** | ✅ sidebar + max-w-5xl | ✅ sidebar + max-w-5xl | ✅ (KPI 4 cols lg) |

**Vérifications systématiques** : tous validés ✅
- Aucun débordement horizontal.
- Aucune carte tronquée.
- Aucune action inaccessible (tap target ≥ 36-44 px).
- Bottom-nav fixe et visible sur les 3 viewports mobiles.
- Dernière section atteignable (padding `calc(64px + env(safe-area-inset-bottom))`).
- Aucun scroll parasite (vérifié `scrollY` préservé après refresh).

---

## 3. Multi-équipes

| Test | Statut |
|---|---|
| Schéma `AgentTeam` + scope `agentScope()` utilise `memberships.some.teamId.in` | ✅ code |
| Schéma `SiteTeam` + scope `siteScope()` utilise `memberships.some.teamId.in` | ✅ code |
| Schéma `UserTeam` + helper `assertTeamAccess(u, teamId)` couvre les 3 formes (vide / single / array) | ✅ Vitest 9/9 (Sprint 1) |
| Helper `actionScope(u)` : OR sur `teamId`, `agent.memberships`, `site.memberships` | ✅ code |
| Test live d'un user multi-équipes | ⚠ Non testable : 0 entrée multi-team en DB de dev (1 seule équipe). Validé par code et tests Vitest US-1.3 du Sprint 1. |

**Aucune fuite inter-équipe identifiée** côté code. Les 4 scopes existants couvrent le cas multi-team par construction (via `in: u.teamIds`).

---

## 4. Sécurité

| Test | Méthode | Résultat |
|---|---|---|
| `USER` ne voit que son périmètre | API `GET /api/today` retourne `role: USER`, pas de champ EDITOR/ADMIN | ✅ |
| `EDITOR` voit son périmètre | API retourne `role: EDITOR` + diagnostic + watchlists | ✅ |
| `ADMIN` voit tout | API retourne `role: ADMIN` + systemStatus + alerts + usage7d + recentActivity | ✅ |
| Endpoint `/api/today` cohérent avec le rôle | `aggregateToday(user)` dispatch via `if user.role === ...` | ✅ code |
| Aucun accès non autorisé | `requireUser()` au début ; sans cookie → 401 ; flag OFF → 404 | ✅ |
| Photos privées (Sprint 1) | Pas modifié par Sprint 2, toujours sous route auth | ✅ |
| Multi-team teamId comparison bug (Sprint 1 C2) | Helper `assertTeamAccess` utilisé partout, scope `{in:[...]}` correct | ✅ |

---

## 5. Performance

Mesures live (5 samples consécutifs, base de dev `admin@veille.local`) :

| Métrique | Min | p50 | Max | Cible |
|---|---|---|---|---|
| Temps client `/api/today` | 30 ms | 31 ms | 32 ms | < 300 ms ✅ |
| Render serveur (logs) | 16 ms | 23 ms | 41 ms | < 300 ms ✅ |
| Cache HTTP `Cache-Control` | `private, max-age=30, stale-while-revalidate=60` | — | — | ✅ |

Volume DB testé :
- 318 actions ACTIVE sur 1 équipe → agrégation USER (50 items remontés) en ~30 ms.
- 35 agents → watchlist EDITOR en ~30 ms (1 fetch + 1 groupBy).
- 1 site → watchlist EDITOR triviale.

**Aucune dégradation observable sous le volume de seed actuel.** À mesurer à nouveau avec 1000+ actions et 100+ agents (test charge non joué en V1).

---

## 6. Bugs détectés

### 6.1 Bloquants

**Aucun.**

### 6.2 Mineurs (cosmétiques, non bloquants)

| # | Description | Impact | Recommandation |
|---|---|---|---|
| m1 | Boutons "Archiver" + icône poubelle sur cartes `/sessions` et `/visits` — cible touch ~32-36 px (sous HIG 44 px) | UX dégradée sur gants | À reprendre en Sprint 3 dans le pattern `<EntityCard>` (UX-04 backlog) |
| m2 | `/sites/[id]` et `/agents/[id]` desktop sans `max-w-5xl` — contenu s'étale sur toute la largeur | Cosmétique | À aligner sur `/today` en Sprint 3 |

---

## 7. Dette technique résiduelle

| # | Item | Raison de report | Sprint cible |
|---|---|---|---|
| D1 | **`Site.isOccupied`** non modélisé | Impacte uniquement visites planifiées 180/365 j ; cadence trimestrielle 90 j fonctionne | Sprint 4 (avant Hub Échéances) |
| D2 | **Affectation multi-équipes côté UI** | Schéma `SiteTeam`/`AgentTeam` en place et exploité par les scopes, mais pas d'UI admin pour assigner plusieurs équipes | Sprint 3 ou 4 |
| D3 | **Centre de notifications** | Hors périmètre V1 ; à ouvrir avec MT-05 (Email + Push) | Sprint 4-5 |
| D4 | **Hub Échéances** | Mécanisme unifié reportable / habilitations / exercices | Sprint 4 |
| D5 | **Refonte photos privées (refactor complet)** | Sprint 1 a livré une mitigation (path 32 octets + noindex). Refactor route streaming en attente | Sprint 3 |
| D6 | **AuditLog consultable `/admin/audit`** | Schéma écrit, UI absente | Sprint 3 |
| D7 | **Composant unifié `<EntityCard>` / `<BottomSheet>`** | Cartes des pages historiques (`/sessions`, `/visits`, `/agents/[id]`, `/sites/[id]`) divergent du pattern Today | Sprint 3 (UX-04, UX-03 du backlog) |
| D8 | **Responsive page Histo. (`/history`)** | Filtres dates débordent sur mobile, non corrigé V1 | Sprint 3 |
| D9 | **Test 60 s du timer auto-refresh** | Validé par code uniquement, à valider en recette PO sur device réel | Recette PO Sprint 2 |
| D10 | **Multi-équipes en data de test** | Aucune entry multi-team en dev DB pour valider live | À seeder pour Sprint 3 |

---

## 8. Règles métier — vérification documentation

Vérifié dans `src/lib/today/constants.ts` et `memory/business-visit-cadences.md` :

| Règle | Constante | Documentée | Implémentée V1 |
|---|---|---|---|
| Visite trimestrielle = 90 j pour TOUS les sites | `QUARTERLY_VISIT_DAYS = 90` | ✅ commentaire + mémoire | ✅ utilisée par watchlist EDITOR + diagnostic |
| Visite planifiée site occupé = 180 j | `OCCUPIED_PLANNED_VISIT_DAYS = 180` | ✅ commentaire + mémoire | ⏸ en attente `Site.isOccupied` |
| Visite planifiée site inoccupé = 365 j | `UNOCCUPIED_PLANNED_VISIT_DAYS = 365` | ✅ commentaire + mémoire | ⏸ idem |
| Occupé/inoccupé n'impacte PAS trimestrielle | — | ✅ commentaire explicite | N/A (trimestrielle universelle) |
| Occupé/inoccupé impacte UNIQUEMENT planifiées | — | ✅ commentaire explicite | N/A |
| Mécanismes INDÉPENDANTS (à suivre séparément) | — | ✅ commentaire + mémoire | ⏸ V1 confond (DEFAULT = 90), V2 séparera |

**Toutes les règles sont correctement documentées** y compris celles non encore exploitées (180/365 j), pour éviter une dérive lors de l'implémentation du Hub Échéances.

---

## 9. Captures principales

Captures réalisées en preview pendant les commits C4-C11 (toutes archivées dans l'historique chat). Sélection :

| Capture | Viewport | Commit |
|---|---|---|
| USER avec carte En cours + 5 cartes À traiter | 375 px | C5 |
| USER 320 px (densité maximale) | 320 × 568 | C5 |
| USER raccourcis + dernières activités | 375 px | C9 |
| EDITOR bannière rouge + KPI Périmètre/Semaine | 375 px | C7 |
| EDITOR watchlist Agents (5 sur 25) + Sites empty | 375 px | C8 |
| EDITOR tablet 768 — grille 3-cols | 768 px | C7 |
| ADMIN bannière "Incident système" + KPI 4-cols desktop | 1280 px | C10 |
| Desktop sidebar + Today centré max-w-5xl | 1280 px | C4-C10 |

---

## 10. Bilan Sprint 2

### 10.1 Ce qui a été livré

**11 commits visuels (C1-C11)** + **1 commit de recette (C12)**.

| Capacité livrée | Commit |
|---|---|
| Route `/today` + feature flag `ENABLE_TODAY` + lien bottom-nav | C1 |
| Algorithme de priorisation pur + 34 tests Vitest | C2 |
| Agrégateur API `/api/today` + 12 mappers + 12 tests | C3 |
| Header role-aware + carte « En cours » | C4 |
| Section « À traiter aujourd'hui » + iOS-safe layout (dvh + safe-area) | C5 |
| Constantes métier documentées + audio nettoyé + audit responsive | C6 |
| Dashboard EDITOR diagnostic + KPI | C7 |
| EDITOR watchlists agents/sites | C8 |
| USER raccourcis + activités | C9 |
| Dashboard ADMIN complet | C10 |
| Auto-refresh 60 s + visibility + online | C11 |

### 10.2 Métriques Sprint 2

- **Effort réel** : ~70 h (estimé 75 h dans SPRINT2-PLAN). Dans la cible.
- **Marge utilisée** : ~5 h de bug fixing (bottom-nav iOS, "N sur 0" watchlist, calendar-day diff).
- **Lignes ajoutées** : ~3000 (composants + sources + types + tests).
- **Tests Vitest** : 47 → 68 (+21 nouveaux pour Today).
- **0 migration Prisma**.
- **0 régression** sur les pages existantes.

### 10.3 Capacités hors Sprint 2

Documentées mais non livrées (par décision PO ou prochaine itération) :
- Section USER « Astreinte » (convention de tag non arrêtée).
- Variante ADMIN+EDITOR mixte (admin avec scope équipe voit sa tournée + son pilotage).
- Progress bars EDITOR avec objectifs (PO a préféré compteurs simples).
- Drill-down KPI ADMIN (liens cliquables vers vues filtrées).

---

## 11. Proposition Sprint 3 priorisée

Synthèse des items à attaquer en Sprint 3, basée sur la dette résiduelle et le backlog initial.

### 11.1 Bloc 1 — Préparation Hub Échéances (incontournable pour Sprint 4)

| US | Description | Effort |
|---|---|---|
| S3-01 | Modélisation `Site.isOccupied` (champ Prisma + migration + UI admin) | 8-12 h |
| S3-02 | UI admin pour `SiteTeam` (assignation multi-équipes site ↔ équipes) | 8-10 h |
| S3-03 | Seed de données multi-team pour la recette E2E | 2 h |

### 11.2 Bloc 2 — Dette UI/UX prioritaire

| US | Description | Effort |
|---|---|---|
| S3-04 | Composant `<EntityCard>` + `<BottomSheet>` partagés (UX-03/04 backlog) | 12-16 h |
| S3-05 | Refactor cartes `/sessions`, `/visits`, `/agents/[id]`, `/sites/[id]` sur `<EntityCard>` | 8-10 h |
| S3-06 | Cible touch ≥ 44 px sur boutons "Archiver" + ajout swipe-to-archive (UX-05) | 6-8 h |
| S3-07 | `max-w-5xl mx-auto` sur `/sites/[id]` et `/agents/[id]` desktop | 1 h |

### 11.3 Bloc 3 — Sécurité / refactor reporté Sprint 1

| US | Description | Effort |
|---|---|---|
| S3-08 | Refactor photos privées (route streaming + auth + migration fichiers existants) | 12-16 h |
| S3-09 | Validation MIME + taille upload photos | 4 h |
| S3-10 | Audit log consultable `/admin/audit` (page de filtres) | 12 h |

### 11.4 Bloc 4 — Petites perles produit

| US | Description | Effort |
|---|---|---|
| S3-11 | Variante ADMIN+EDITOR mixte sur `/today` (bloc EDITOR + bloc système repliable) | 4 h |
| S3-12 | Drill-down KPI ADMIN (liens cliquables sur les 4 KPI Usage 7j) | 3 h |
| S3-13 | Convention contact d'astreinte + raccourci USER "Astreinte" sur Today | 6 h |
| S3-14 | `/history` responsive mobile (filtres dates wrap, etc.) | 4 h |
| S3-15 | Reset password par lien email (Sprint 1 différé) | 6 h |

### 11.5 Récap effort Sprint 3 proposé

| Bloc | Effort total |
|---|---|
| Bloc 1 Hub Échéances prep | 18-24 h |
| Bloc 2 Dette UI/UX | 27-35 h |
| Bloc 3 Sécurité | 28-32 h |
| Bloc 4 Perles produit | 23 h |
| **Total** | **96-114 h** |

Sprint 3 prévu à ~75 h → priorisation nécessaire. Recommandation : Bloc 1 + Bloc 2 partiel + S3-08 (photos privées), soit ~50 h, garde une marge pour imprévus.

---

## 12. Conclusion

L'écran `/today` est fonctionnel et stable pour les 3 rôles aux 4 viewports cibles. Les règles métier officielles sont documentées y compris celles non encore implémentées. Les composants UI (`DiagnosticBanner`, `KpiCard`, `KpiSection`, `RecentActivitySection`, `WatchlistSection/Row`, `AlertsList`) sont conçus pour être réutilisés en Sprint 4 (Hub Échéances) et au-delà (Dashboard ADMIN avancé, Statistiques).

**Recommandation de mise en production** :
1. Déploiement avec `ENABLE_TODAY=true` après validation PO de la recette finale (notamment timer 60 s sur device réel iOS).
2. Activer en pré-prod d'abord pour récolter retours utilisateurs réels avant bascule prod.
3. Préparer Sprint 3 sur le Bloc 1 (modélisation `Site.isOccupied` + UI multi-team) pour ouvrir la voie au Hub Échéances Sprint 4.

---

## 13. SHA Git C12

À renseigner après commit (cette recette).
