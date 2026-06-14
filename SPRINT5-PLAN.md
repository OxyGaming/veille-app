# SPRINT5-PLAN.md — Plan d'exécution Sprint 5

> **Périmètre** : transformer l'application en outil de **pilotage proactif** — Centre de notifications personnel, génération automatique d'événements ciblés, vue d'audit ADMIN, dashboard de pilotage, rétention automatique, durcissement perf.
> **Date** : 2026-06-14.
> **Sprint** : Sprint 5 (~75 h de capacité solo + IA).
> **Documents amont** : [SPRINT4-RECETTE.md](SPRINT4-RECETTE.md), [memory/business-rules.md](memory/business-rules.md), [memory/decisions.md](memory/decisions.md).

---

## 0. Décisions PO à valider avant C1

Sprint à fort impact UX et donnée : 12 lignes à trancher. Recommandations argumentées, chaque ligne se valide ou s'arbitre indépendamment.

| # | Sujet | Recommandation | Alternative | Argument |
|---|---|---|---|---|
| D1 | Canal V1 | **In-app uniquement** : Centre + badge non-lues + indicateur nav | + Web push browser (Notifications API) | Push nécessite permission user, service worker dédié et back-office de gestion. Coût V1 vs ROI faible — on garde le périmètre déclaratif PO « pas de push V1 ». |
| D2 | Centre de notifications accessible à | **USER + EDITOR + ADMIN** | EDITOR/ADMIN seulement | Les notifications sont personnelles (actions assignées, échéances sur mes sites). Pertinent pour tous les rôles. |
| D3 | Types d'événements générant une notif V1 | **4 types** : `ACTION_ASSIGNED_TO_ME`, `ACTION_VALIDATED_ON_MY_ACTION`, `VISIT_FINISHED_ON_MY_SITE`, `ECHEANCE_CRITICAL_ON_MY_PERIMETER` | + tous les événements TeamActivity (8+) | Sous-ensemble actionnable, évite la pollution du badge. Élargissable Sprint 6+. |
| D4 | Centre d'audit accessible à | **ADMIN uniquement** | ADMIN + EDITOR | AuditLog contient des modifications sensibles (suppressions, droits, etc.). Conformité RGPD. |
| D5 | Dashboard pilotage accessible à | **EDITOR + ADMIN** (même critère que Hub Échéances) | + USER | Outil de management. USER a déjà sa carte « En cours » + « À traiter » sur Today. |
| D6 | Rétention par type | **TeamActivity 180 j** · **AuditLog 365 j** · **Notification 90 j (lue) / 180 j (non lue)** | Durées plus longues / config | Équilibre stockage SQLite / valeur historique. Audit plus long pour conformité. |
| D7 | Mécanisme purge | **Route `POST /api/admin/retention/purge`** déclenchée par cron externe (system cron, GitHub Action…) | Scheduler Node interne | Next.js sans scheduler natif. Externe = explicite, observable, simple. |
| D8 | Notif → cible click | **`targetUrl`** comme TeamActivity (déjà éprouvé S3-C8) | Modal détail | Cohérence Activity Feed / Notif. Évite un nouvel écran. |
| D9 | Opt-out par type de notification | **Non V1** (pas de page préférences) | Préférences user | Volume V1 maîtrisé (4 types). Page préférences = Sprint 6+. |
| D10 | Volumétrie & index minimum | **3 index Prisma** : `Notification(userId, readAt, createdAt DESC)`, `AuditLog(createdAt DESC)`, `TeamActivity(teamId, createdAt DESC)` si absent | Plus d'index | Index choisis sur les requêtes effectives de C4/C6/C9. Cible perf < 200 ms / 500 rows. |
| D11 | Email / SMS / Web push | **Refusé V1** (cohérent décision PO 2026-06-14) | À envisager V2+ | Confirme la position prise en Sprint 3. |
| D12 | Dashboard contenu V1 | **4-6 KPI consolidés** + 1-2 sparklines (visites 30 j, actions validées 30 j) | Graphes complexes / drilldowns | ROI V1 vs complexité D3.js / lib. Sparklines minimales suffisent. |

Tant que ces 12 lignes ne sont pas tranchées, l'écriture du code peut commencer sur les fondations (C2 — modèle Notification + helpers) qui sont neutres à 90 %.

---

## 0.1 Acquis Sprint 1-4 réutilisés

| Acquis | Localisation | Usage Sprint 5 |
|---|---|---|
| `TeamActivity` | `prisma/schema.prisma` + `src/lib/activityFeed.ts` | C3 — déclencheur de notifications dérivées (multi-team dédup déjà géré) |
| `AuditLog` | `prisma/schema.prisma` | C6 — source du centre d'audit |
| Helpers cadences | `src/lib/today/constants.ts` | C3 — détection « échéance critique » via `isCriticalEcheance` (S4-C2) |
| Sources Hub Échéances | `src/lib/echeances/sources.ts` | C3 — déclenche `ECHEANCE_CRITICAL_ON_MY_PERIMETER` à la lecture |
| Scopes (`teamScope`, `siteScope`, `agentScope`, `actionScope`) | `src/lib/auth.ts` | C4/C6 — strictement réutilisés |
| `requireRole(['EDITOR','ADMIN'])` + `requireUser` | idem | C4/C6/C7/C8 |
| Pattern feature flag | `src/lib/featureFlags.ts` | C2/C7 — `ENABLE_NOTIFICATIONS`, `ENABLE_PILOTAGE` (default true) |
| `recordActivitySafe` (non-bloquant) | `src/lib/activityFeed.ts` | C3 — modèle pour `recordNotificationSafe` |
| Composants Today (`KpiCard`, `KpiSection`, `WatchlistRow`) | `src/app/(app)/today/components/` | C5/C7 |
| Pattern `EcheanceRow` / chips / filtres URL | `src/app/(app)/echeances/components/` | C5 (list notif) / C6 (filtres audit) |
| `getCriticalEcheancesCount` | `src/lib/echeances/aggregator.ts` | C7 — KPI pilotage |
| Helper `Icon.Bell` (à ajouter si absent) | `src/components/icons.tsx` | C5 |

**Aucun acquis n'est à refondre.** Sprint 5 ajoute 1 modèle (`Notification`) et ré-utilise tout le reste.

---

## 0.2 Contraintes assumées

- **Aucun breaking change** : tables existantes, routes existantes, comportements Today/Hub/sites/agents inchangés.
- **Tous les commits indépendants** : chaque commit déployable seul (feature flag par sujet si nécessaire).
- **Vérification Preview obligatoire** pour toute modif UI (C5, C6, C7).
- **Vitest obligatoire** pour toute logique métier (C2, C3, C8, C9).
- **TypeScript strict** : aucune nouvelle exception.
- **Responsive 320 / 375 / 768 / desktop** : audit obligatoire pour C5/C6/C7.
- **Multi-équipes compatible** : scopes existants strictement appliqués.
- **Pas d'audio / push / email** (cohérent PO 2026-06-14).

---

## 1. Synthèse globale

### 1.1 Ordre optimal des commits

```
SEMAINE 1 — Fondations data (12-16 h)
  C1  S5-DOC : plan + arbitrages PO D1-D12                   1-2 h
  C2  S5-01  : modèle Notification + migration + helpers     6-8 h
  C3  S5-02  : génération automatique 4 types                8-10 h

SEMAINE 2 — API et UI Centre (16-22 h)
  C4  S5-03  : route /api/notifications + agrégateur         6-8 h
  C5  S5-04  : UI Centre de notifications + badge nav        10-14 h
       → Démo : notifs visibles, marquage lu/non-lu

SEMAINE 3 — Audit + Pilotage (16-22 h)
  C6  S5-05  : centre d'audit ADMIN + filtres                8-10 h
  C7  S5-06  : dashboard pilotage EDITOR/ADMIN               8-12 h
       → Démo : 3 nouveaux écrans cohérents

SEMAINE 4 — Industrialisation + recette (18-22 h)
  C8  S5-07  : rétention auto (route ADMIN + script + tests) 6-8 h
  C9  S5-08  : optimisation perf (3 index + tests perf)      6-8 h
  C10 S5-RECETTE : tests E2E + SPRINT5-RECETTE.md            6-8 h
```

**Total brut** : 62-84 h.
**Effort net solo + IA estimé** : ~60-78 h.
**Capacité Sprint 5** : 75 h.
**Marge** : ~0-15 h selon scope final.

> **Risque scope** : si D3 élargi (8+ types) ou D12 enrichi (drilldown dashboard), prévoir reformatage estimation C3/C7 (+6-10 h chacun).

### 1.2 Dépendances entre commits

```
C1 (DOC)   ─── préalable validation PO

C2 (modèle + migration) ─→ C3 (recordNotificationSafe)
                        ─→ C4 (route lit Notification)
                        ─→ C5 (UI consomme C4)
                        ─→ C8 (purge supprime des Notification)
                        ─→ C9 (index sur Notification)

C3 (génération auto) ─→ C5 (UI affiche ce que C3 a créé)
                     ─→ C10 (recette E2E)

C4 (API) ─→ C5 (UI fetch)

C6 (audit) ─── indépendant de C2-C5 (consomme uniquement AuditLog)
            ─→ C8 (purge AuditLog)
            ─→ C9 (index AuditLog)

C7 (dashboard) ─── indépendant data mais réutilise composants C5
                ─→ C10 (recette)

C8 (rétention) ─── dépend de C2 + C6 pour ce qu'il purge

C9 (perf) ─── dépend de C2 + C6 (index sur leurs tables)

C10 (recette) ─── dépend de tout
```

### 1.3 Points de démo

- **Fin semaine 1** : `recordNotificationSafe()` testable manuellement (création + lecture en DB), tests Vitest verts.
- **Fin semaine 2** : Centre de notifications navigable, badge non-lu, marquage en 1 click.
- **Fin semaine 3** : Audit ADMIN consultable, dashboard pilotage visible pour EDITOR.
- **Fin semaine 4** : Rétention exécutable, perf < 200 ms / 500 rows, SPRINT5-RECETTE.md livré.

---

## 2. Règles métier (rappel + ajouts Sprint 5)

| Règle | Valeur | Source |
|---|---|---|
| Visite trimestrielle / planifiée occupé / inoccupé | 90 / 180 / 365 j | PO 2026-06-12 |
| Échéance critique (D13) | Action > 7 j retard · Visite > 30 j retard ou jamais · Équipement périmé | PO Sprint 4 |
| Multi-équipes | `SiteTeam` (M-N), au moins 1 équipe par site | S3-C5 |
| Notifications V1 | **In-app, 4 types max, pas d'email/SMS/push** | D1 + D11 (Sprint 5) |
| Rétention | TA 180 j · Audit 365 j · Notif 90/180 j | D6 (Sprint 5) |
| Audit | ADMIN uniquement | D4 (Sprint 5) |
| Pilotage | EDITOR + ADMIN | D5 (Sprint 5) |
| Audio / vocal / IA vocale | **ABANDONNÉ DÉFINITIVEMENT** | PO 2026-06-14 |

---

## 3. User Stories Sprint 5

### US-5.1 — Centre de notifications personnel
> **En tant qu'**utilisateur connecté, **je veux** voir les événements me concernant directement, **afin de** rester informé sans aller chercher dans le flux d'activité.

**Critères d'acceptation** :
- Écran `/notifications` accessible à USER + EDITOR + ADMIN (D2).
- Liste chronologique DESC, max 50 visibles (« Afficher 25 de plus »).
- Indicateur visuel `non-lu` (point coloré + fond légèrement teinté).
- Marquage individuel `lu` au clic sur la notif (mute le visuel).
- Bouton « Tout marquer comme lu » en tête.
- Badge dans le header (compteur non-lues, plafonné à 99+).
- Cliquer une notif → navigue vers `targetUrl`.
- EmptyState si zéro notif.

### US-5.2 — Génération automatique
> **En tant que** mainteneur, **je veux** que les notifications soient créées automatiquement par les bons événements métier, **afin de** garantir que l'utilisateur reçoit l'info au bon moment.

**Critères d'acceptation** :
- 4 types implémentés (D3) :
  - `ACTION_ASSIGNED_TO_ME` : si une action est créée pour un agent dont je suis l'observateur récent (à définir précisément en C3) ou pour mon équipe → notif aux observateurs récents
  - `ACTION_VALIDATED_ON_MY_ACTION` : ma propre action validée par quelqu'un d'autre
  - `VISIT_FINISHED_ON_MY_SITE` : visite terminée sur un site dont je suis membre d'équipe principale
  - `ECHEANCE_CRITICAL_ON_MY_PERIMETER` : nouvelle échéance critique apparue dans mon périmètre (calculé au moment du fetch Today/Hub, dédup)
- `recordNotificationSafe()` non-bloquant — la mutation principale ne plante jamais.
- Dédup multi-team : 1 notif par destinataire même si l'événement touche plusieurs équipes du user.

### US-5.3 — Centre d'audit
> **En tant qu'**ADMIN, **je veux** consulter l'historique exhaustif des modifications sensibles, **afin de** conformité RGPD et investigation incident.

**Critères d'acceptation** :
- Écran `/admin/audit` accessible ADMIN uniquement (D4).
- Liste DESC par `createdAt`, pagination 50 par 50.
- Filtres : par action, par utilisateur, par entité, par période (date début/fin).
- URL search params (cohérent C6 Sprint 4).
- Export CSV (V1 — bouton « Télécharger ») si volume raisonnable.

### US-5.4 — Dashboard pilotage
> **En tant qu'**EDITOR ou ADMIN, **je veux** un dashboard synthétique des KPI clés, **afin de** prendre des décisions de pilotage rapides.

**Critères d'acceptation** :
- Écran `/pilotage` accessible EDITOR + ADMIN (D5).
- 4-6 KPI principaux (D12) : échéances critiques · sites jamais visités · agents jamais veillés · visites 30 j · actions validées 30 j · temps moyen action→validation (V1.5 si simple).
- 1-2 sparklines : visites par semaine (12 semaines), actions validées par semaine (12 semaines).
- Drilldown limité aux pages existantes (Hub, watchlists Today, etc.).

### US-5.5 — Rétention automatique
> **En tant que** mainteneur, **je veux** un mécanisme automatique de purge des données historiques selon des durées documentées, **afin de** maîtriser la taille de la base et la conformité RGPD.

**Critères d'acceptation** :
- Route `POST /api/admin/retention/purge` ADMIN uniquement.
- Dry-run par défaut (`?apply=1` pour effectuer).
- Renvoie un rapport JSON : `{teamActivity, auditLog, notificationsRead, notificationsUnread}` avec counts supprimés.
- Idempotent et sûr à rejouer.
- Durées issues de D6, exposées comme constantes éditables.

### US-5.6 — Optimisation perf
> **En tant que** mainteneur, **je veux** que les nouvelles pages restent < 200 ms / 500 rows, **afin de** garantir l'UX en montée en charge.

**Critères d'acceptation** :
- 3 index Prisma (D10) ajoutés via migration.
- Test perf Vitest : agrégateur Notification < 50 ms sur 500 rows mockés, agrégateur Audit idem.
- Pages C5/C6 mesurées < 200 ms en SSR sur dataset 500 rows.

### US-5.7 — Recette finale
> **En tant que** PO, **je veux** `SPRINT5-RECETTE.md` validant chaque US et listant les réserves, **afin de** décider la mise en prod.

---

## 4. Détail par commit

### Commit 1 — S5-DOC : plan + arbitrages PO

**Périmètre** : valider D1-D12. Mise à jour de ce document si arbitrages divergent.

**Fichiers** : [SPRINT5-PLAN.md](SPRINT5-PLAN.md).

**Risques** : R1.1 — D3 (liste de types) élargi tardivement → reprise de C3. **Mitigation** : bloquer C3 tant que D3 non validé.

**Tests** : aucun (no-code).

**Estimation** : **1-2 h** (S).

---

### Commit 2 — S5-01 : modèle Notification + migration + helpers + tests

**Périmètre** :

```prisma
model Notification {
  id              String   @id @default(cuid())
  userId          String
  type            String   // ACTION_ASSIGNED_TO_ME | ACTION_VALIDATED_ON_MY_ACTION | VISIT_FINISHED_ON_MY_SITE | ECHEANCE_CRITICAL_ON_MY_PERIMETER
  entityType      String?
  entityId        String?
  message         String
  targetUrl       String?
  readAt          DateTime?
  createdAt       DateTime @default(now())
  /// Évite la dédup multi-team : un même event ne crée pas N notifs au même user
  dedupKey        String?
  user            User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId, readAt, createdAt])
  @@index([dedupKey])
  @@unique([userId, dedupKey])
}
```

Helpers (`src/lib/notifications/`) :
- `NOTIFICATION_TYPES` const
- `recordNotificationSafe(input)` (try/catch + log structuré, jamais bloquant)
- `markAsRead(userId, notificationId)`, `markAllAsRead(userId)`
- `getUnreadCount(userId)` (utilisé par C5 badge)

Tests Vitest : ≥ 12 (types valides, dédup via `dedupKey`, `recordNotificationSafe` non-bloquant, `markAsRead` autorisation, count).

**Dépendances** : aucune (sauf D2-D6).

**Risques** : R2.1 — migration vs sites déjà en prod → strict additif, pas de modif schéma existant.

**Estimation** : **6-8 h** (M).

---

### Commit 3 — S5-02 : génération automatique (instrumentation)

**Périmètre** : 4 types branchés sur les routes existantes (sans modifier leur comportement).

| Type | Source | Destinataires | Dédup key |
|---|---|---|---|
| `ACTION_ASSIGNED_TO_ME` | `POST /api/agents/[id]/actions` (S3-C7) | observateur récent de l'agent (à déterminer en C3) | `ACTION_ASSIGNED:{userId}:{actionId}` |
| `ACTION_VALIDATED_ON_MY_ACTION` | `POST /api/actions/[id]/validate` | créateur de l'action si != validateur | `ACTION_VALIDATED:{userId}:{actionId}` |
| `VISIT_FINISHED_ON_MY_SITE` | `PATCH /api/visits/[id]` → completed | membres équipe principale du site | `VISIT_FINISHED:{userId}:{visitId}` |
| `ECHEANCE_CRITICAL_ON_MY_PERIMETER` | déclenché par cron ou à la lecture Today (à arbitrer en C3) | EDITOR + ADMIN du périmètre concerné | `ECHEANCE_CRITICAL:{userId}:{kind}:{sourceId}` |

Tests Vitest : ≥ 8 (un par type avec mocks Prisma, dédup vérifiée).

**Dépendances** : C2.

**Risques** :
- R3.1 — déterminer le destinataire `ACTION_ASSIGNED_TO_ME` peut être ambigu si l'agent a plusieurs observateurs. **Mitigation** : 1 notif par observateur récent (60 j max), dédup `dedupKey`.
- R3.2 — `ECHEANCE_CRITICAL_ON_MY_PERIMETER` à la lecture risque de boucle (chaque GET Today crée des notifs). **Mitigation** : dédup `dedupKey` par jour glissant, créer la notif seulement lors de la transition « non-critique → critique » détectée via flag DB léger ou comparaison avec dernier snapshot.

**Estimation** : **8-10 h** (L).

---

### Commit 4 — S5-03 : route `/api/notifications` + agrégateur

**Périmètre** :
- `GET /api/notifications?unreadOnly=true|false&limit=50&offset=0` : liste paginée scope `userId = currentUser.id`.
- `POST /api/notifications/[id]/read` : marquage individuel.
- `POST /api/notifications/read-all` : marquage en lot.
- `GET /api/notifications/unread-count` : compteur léger pour le badge nav.

Tests Vitest : ≥ 10 (auth, scope, pagination, marquage, batch).

**Dépendances** : C2.

**Risques** : R4.1 — appel `unread-count` à chaque navigation → cache 30 s + `private`.

**Estimation** : **6-8 h** (M).

---

### Commit 5 — S5-04 : UI Centre de notifications + badge nav

**Périmètre** :
- Page `/notifications` Server Component, lecture via agrégateur direct (pas de fetch HTTP).
- Composants : `NotificationsHeader`, `NotificationsList`, `NotificationRow` (icône par type, message, date relative, badge non-lu, chevron).
- Pagination « Afficher 25 de plus » réutilisant pattern Sprint 4 C5.
- Bouton « Tout marquer comme lu » → POST + revalidation.
- Click ligne → marquage lu + navigation `targetUrl`.
- Badge dans `AppShell.tsx` : compteur non-lues côté `Icon.Bell`, polling 60 s (réutilise `TodayAutoRefresh`).
- Entrée nav conditionnelle (tous rôles).

**Dépendances** : C4.

**Risques** :
- R5.1 — badge over-fetch → polling cap 60 s + cache HTTP 30 s.
- R5.2 — nav 8 entrées sur mobile EDITOR/ADMIN → repenser le grid : « Notif » remplace « Histo. » ou icon-only ; à valider preview.

**Tests** : preview 4 bp + click marquage.

**Estimation** : **10-14 h** (L).

---

### Commit 6 — S5-05 : centre d'audit ADMIN + filtres

**Périmètre** :
- Page `/admin/audit` ADMIN only.
- Liste DESC, pagination 50.
- Filtres URL : `action[]`, `userId`, `entity`, `from`, `to`.
- Bouton export CSV (V1 — server-side stream).
- EmptyState et états chargement (skeleton).

**Dépendances** : aucune (consomme AuditLog existant).

**Risques** : R6.1 — volumes export > 10 000 lignes. **Mitigation** : limite 5 000 + warning.

**Tests** : preview ADMIN, redirect non-ADMIN, filtres URL.

**Estimation** : **8-10 h** (M).

---

### Commit 7 — S5-06 : dashboard pilotage EDITOR/ADMIN

**Périmètre** :
- Page `/pilotage` accessible EDITOR + ADMIN.
- Header + 4-6 KPI (D12) :
  - Échéances critiques (réutilise `getCriticalEcheancesCount` S4)
  - Sites jamais visités (count)
  - Agents jamais veillés (count)
  - Visites 30 j (count)
  - Actions validées 30 j (count)
  - Temps moyen action→validation (jours, V1.5)
- 1-2 sparklines (SVG natif, pas de lib) : visites 12 semaines, actions validées 12 semaines.
- Drilldown vers Hub / Today.
- Feature flag `ENABLE_PILOTAGE` (default true).

**Dépendances** : peut paralléliser avec C5/C6.

**Risques** :
- R7.1 — sparklines mal calibrées sur dataset vide → fallback EmptyState par sparkline.
- R7.2 — KPI « temps moyen » coûteux si volume actions important → V1.5 ou pré-agrégation.

**Estimation** : **8-12 h** (M+).

---

### Commit 8 — S5-07 : rétention automatique

**Périmètre** :
- Route `POST /api/admin/retention/purge` ADMIN.
- Query `?apply=true` (dry-run par défaut).
- Renvoie `{ teamActivity: N, auditLog: M, notificationsRead: K, notificationsUnread: L }`.
- Constantes éditables : `TEAM_ACTIVITY_RETENTION_DAYS = 180`, `AUDIT_LOG_RETENTION_DAYS = 365`, `NOTIFICATION_READ_RETENTION_DAYS = 90`, `NOTIFICATION_UNREAD_RETENTION_DAYS = 180`.
- Script de cron documenté : `curl -X POST https://<host>/api/admin/retention/purge?apply=true -H "Cookie: …"` (ou avec un token API en V1.5).

**Dépendances** : C2 + C6.

**Risques** : R8.1 — purge accidentelle prod sans backup → dry-run par défaut + log structuré obligatoire.

**Tests** : Vitest avec dataset mocké + dry-run vérifié.

**Estimation** : **6-8 h** (M).

---

### Commit 9 — S5-08 : optimisation perf

**Périmètre** :
- Migration Prisma additive : 3 index (D10).
- Tests perf Vitest : agrégateur Notification + Audit < 50 ms sur 500 rows mockés.
- Audit perf SSR : `/notifications`, `/admin/audit`, `/pilotage` < 200 ms.
- Cache `Cache-Control: private, max-age=30, stale-while-revalidate=60` sur routes API.

**Dépendances** : C2 + C6 (les tables doivent exister pour indexer).

**Risques** : R9.1 — migration index sur SQLite en prod = locks brefs sur petites tables. Acceptable. Documenter.

**Estimation** : **6-8 h** (M).

---

### Commit 10 — S5-RECETTE : tests E2E + SPRINT5-RECETTE.md

**Périmètre** :
- Reproduction de la grille Sprint 4 : accès / fonctionnalités par US / responsive / perf / réserves.
- Scripts : `sprint5-recette-fixtures.ts`, `sprint5-recette-asserts.ts`, `sprint5-recette-cleanup.ts` (reprise pattern Sprint 3 C10).
- Tableau actions pré-prod final.

**Dépendances** : tout.

**Estimation** : **6-8 h** (M).

---

## 5. Estimations globales

| Commit | Min | Max |
|---|---|---|
| C1 DOC | 1 | 2 |
| C2 Notification + helpers | 6 | 8 |
| C3 Génération auto | 8 | 10 |
| C4 Route + agrégateur | 6 | 8 |
| C5 UI Centre + badge | 10 | 14 |
| C6 Audit + filtres | 8 | 10 |
| C7 Dashboard pilotage | 8 | 12 |
| C8 Rétention | 6 | 8 |
| C9 Perf + index | 6 | 8 |
| C10 Recette | 6 | 8 |
| **Total** | **65 h** | **88 h** |

Capacité Sprint : **75 h**.
Marge nette : **-13 à +10 h** selon scope.

**Stratégie de réduction si dépassement** :
1. Reporter `temps moyen action→validation` (C7) — sauve ~2 h.
2. Reporter export CSV audit (C6) — sauve ~2 h.
3. Reduce nombre de tests Vitest C2/C3 à l'essentiel — sauve ~2 h.
4. Reporter sparklines C7 V1.5 — sauve ~3 h.

Soit jusqu'à ~9 h de marge récupérable sans toucher au cœur fonctionnel.

---

## 6. Risques globaux Sprint 5

| # | Risque | Probabilité | Sévérité | Mitigation |
|---|---|---|---|---|
| RG1 | Volumétrie notifs explose (gen auto trop large) | moyenne | élevée | Dédup `dedupKey` strict + monitoring volumes C10 |
| RG2 | Badge non-lues = sur-sollicitation API | élevée | moyenne | Cache HTTP 30 s + polling 60 s |
| RG3 | Rétention purge accidentelle | basse | élevée | Dry-run par défaut + ADMIN only + log structuré |
| RG4 | Multi-équipes mal géré dans génération auto | moyenne | élevée | Dédup `(userId, dedupKey)` unique constraint en DB |
| RG5 | Migration index lock en prod | basse | basse | Volumes SQLite limités, lock bref. Documenter. |
| RG6 | Mobile bottom-nav surchargée (8 entrées) | élevée | basse | Repenser : « Notif » dans header (Icon.Bell badge), pas dans bottom-nav |
| RG7 | Confusion UX entre TeamActivity, Notifs et AuditLog | moyenne | moyenne | Doc utilisateur claire + libellés explicites + EmptyState pédagogique |
| RG8 | RGPD : Notification garde des données personnelles | basse | élevée | Rétention 90/180 j + suppression cascade onDelete User (S5-C2) |
| RG9 | Performance dashboard avec gros volumes | moyenne | moyenne | Mesure C7 + cache + index si nécessaire |
| RG10 | D3 (types notifs) élargi en cours de sprint | basse | élevée | Bloquer C3 tant que D3 non validé |

---

## 7. Stratégie de recette

### 7.1 Fixtures (réutilisables Sprint 4)

Reprendre les fixtures Sprint 3 C10 (`recette-editor-s3`, `recette-user-b-s3`, Site A / B). Ajouter en C10 :
- 3 actions assignées à EDITOR pour générer `ACTION_ASSIGNED_TO_ME`.
- 1 visite terminée sur Site A pour `VISIT_FINISHED_ON_MY_SITE`.
- 1 action validée pour `ACTION_VALIDATED_ON_MY_ACTION`.
- Échéances critiques préexistantes (déjà 72 dans le dataset Sprint 4) pour `ECHEANCE_CRITICAL_ON_MY_PERIMETER`.

### 7.2 Grille C10

| Axe | Vérification |
|---|---|
| Accès | Centre notif (3 rôles), Audit (ADMIN), Pilotage (EDITOR/ADMIN) — cohérence rôles |
| Génération auto | 4 types déclenchés, 1 notif par destinataire (dédup) |
| Centre | Marquage individuel, batch, badge décrémenté, EmptyState |
| Audit | Filtres URL, export CSV, redirection non-ADMIN |
| Pilotage | KPI cohérents, sparklines lisibles, drilldown OK |
| Rétention | Dry-run vs apply, counts cohérents, idempotent |
| Perf | < 200 ms sur 500 rows mockés, audit SSR live |
| Responsive | 320 / 375 / 768 / desktop sur /notifications, /admin/audit, /pilotage |
| Multi-équipes | Notifs ne fuient pas hors périmètre, dédup OK |
| Aucune régression | Today, Hub, Sites, Photos, Activité — tous fonctionnels |

### 7.3 Outils
- 3 cookies curl (USER, EDITOR, ADMIN) à la S3 C10.
- preview MCP screenshots 4 breakpoints.
- Scripts : `sprint5-recette-fixtures.ts` + `asserts` + `cleanup`.
- Vitest run complet (cible ≥ 200 tests).

---

## 8. Critères de succès / DoD Sprint 5

Pour considérer Sprint 5 livré :
1. Centre de notifications accessible aux 3 rôles avec badge non-lu fonctionnel.
2. 4 types d'événements génèrent des notifications automatiquement (D3).
3. Dédup multi-team vérifiée (un événement = max 1 notif par user).
4. Centre d'audit ADMIN consultable avec filtres URL + export CSV.
5. Dashboard pilotage EDITOR/ADMIN avec 4-6 KPI + 1-2 sparklines.
6. Route purge ADMIN avec dry-run par défaut.
7. 3 index Prisma ajoutés, perf < 200 ms / 500 rows.
8. Responsive 320 / 375 / 768 / desktop sur les 3 nouveaux écrans.
9. Vitest ≥ 200 tests verts (177 actuels + ~25 nouveaux).
10. SPRINT5-RECETTE.md livré.
11. Zéro régression sur Today, Hub, Sites, Agents, Photos, Activité.
12. Aucune fonctionnalité audio / push / email.

---

## 9. Hors périmètre Sprint 5

Explicitement **hors** scope, à arbitrer Sprint 6+ :
- Web push browser, email, SMS (cf. D1 + D11).
- Page de préférences utilisateur (opt-out par type de notification, cf. D9).
- Notifications cross-tenant (cas multi-organisation).
- Audit avec graphes (volumes par jour, etc.).
- Dashboard pilotage drilldown complet (uniquement liens vers pages existantes V1).
- Centre d'audit avec recherche full-text.
- Restauration de données purgées (suppression définitive en V1).
- Webhook sortant sur événements (intégration tiers).
- Notifications planifiées (rappels, échéances « demain »).

---

## 10. Validation et démarrage

Une fois D1-D12 arbitrés par le PO, je démarre par **C2** (C1 étant ce document). Démos hebdo à la fin de chaque semaine — fenêtre de validation/correction immédiate.

**Avant tout commit code** : confirmer D1-D12 explicitement.
