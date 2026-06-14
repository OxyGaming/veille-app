# SPRINT3-PLAN.md — Plan d'exécution Sprint 3

> **Périmètre** : préparer le Hub Échéances (Sprint 4) + livrer le flux d'activité équipe + nettoyer la dette critique.
> **Date** : 2026-06-14.
> **Sprint** : Sprint 3 (~75 h de capacité solo + IA).
> **Documents amont** : [memory/business-rules.md](memory/business-rules.md), [memory/decisions.md](memory/decisions.md), [SPRINT2-RECETTE.md](SPRINT2-RECETTE.md).

---

## 0. Décisions PO intégrées

| Item | Décision |
|---|---|
| Audio / vocal | Abandonné définitivement, à neutraliser dans 5 docs amont |
| Astreinte | Abandonnée, retirée du périmètre |
| « Notifications équipe » | **Remplacé** par « Flux d'activité équipe cliquable » |
| `Site.isOccupied` | À modéliser Sprint 3 |
| Multi-équipes sites | UI admin à livrer Sprint 3 |
| Hub Échéances | Conservé pour Sprint 4 |
| Push / email / centre notifs | Hors périmètre Sprint 3 |

## 0.1 Contraintes assumées

- Pas de notifications push, pas d'email, pas de centre de notifications complet.
- Pas d'IA vocale, pas de fonction audio.
- Pas de Hub Échéances complet (reste Sprint 4).
- Pas de refonte du modèle Photo au-delà du strict refactor sécurité.
- Mobile-first (320 / 375 / 768 / desktop).
- Multi-équipes systématique via scopes existants.

---

## 1. Synthèse globale

### 1.1 Ordre optimal des commits

```
SEMAINE 1 — Doc + quick wins + isOccupied (16-20 h)
  C1  S3-DOC : neutralisation audio dans 5 docs amont           2-3 h
  C2  S3-07  : max-w-5xl mx-auto sur /agents/[id] /sites/[id]   1 h
  C3  S3-01  : Site.isOccupied — schéma + migration + UI        8-12 h
  C4  S3-01b : exploitation Site.isOccupied dans Today           4-6 h

SEMAINE 2 — Multi-team UI + modèle activité (16-22 h)
  C5  S3-02  : UI admin SiteTeam (multi-équipes site)            8-12 h
  C6  S3-A1  : modèle TeamActivity + helper recordActivity        6-10 h
       → Démo : Site occupé/inoccupé + multi-team + table activité

SEMAINE 3 — Génération d'événements + affichage (18-22 h)
  C7  S3-A2  : instrumentation 6 routes mutantes MVP             10-14 h
  C8  S3-A3  : composant ActivityFeedSection + EDITOR Today      8-10 h
       → Démo : flux d'activité visible et cliquable

SEMAINE 4 — Photos privées + recette (13-17 h)
  C9  S3-08  : refactor photos privées (route streaming + auth)  12-16 h
  C10 S3-RECETTE : tests E2E + bilan Sprint 3                     1-2 h
```

**Total brut** : 60-82 h.
**Effort net solo + IA estimé** : ~55-75 h.
**Capacité Sprint 3** : 75 h.
**Marge** : ~0-20 h selon scope final.

### 1.2 Dépendances entre commits

```
C1 (DOC)   ─── indépendant
C2 (max-w) ─── indépendant — quick win

C3 (isOccupied schema) ─→ C4 (Today usage)
                       └→ C5 (UI admin site peut ajouter le toggle)
                                                        (pas strict)

C6 (TeamActivity model) ─→ C7 (recordActivity calls)
                         ─→ C8 (display section)

C7 (events generated) ─→ C8 (sans events C8 est vide)

C9 (photos privées) ─── indépendant — peut paralléliser

C10 (recette) ─── dépend de tout
```

### 1.3 Points de démo

- **Fin semaine 1** : Sites paramétrables occupé/inoccupé, cadence dual visible dans Today EDITOR.
- **Fin semaine 2** : UI multi-team site fonctionnelle, table `TeamActivity` créée.
- **Fin semaine 3** : Flux d'activité visible dans Today EDITOR, chaque ligne cliquable.
- **Fin semaine 4** : Photos servies sous auth, recette Sprint 3 validée.

---

## 2. Détail par commit

### Commit 1 — S3-DOC : neutralisation audio dans les 5 docs amont

#### Périmètre précis

Mettre à jour les 5 documents historiques pour rendre visible la décision PO « audio abandonné définitivement ». Approche **non destructive** : on conserve le texte historique pour traçabilité, mais on ajoute des bandeaux explicites et on barre les références V-02 / E9-F1 / US-9.1 / O-I2.

#### Fichiers concernés

| Fichier | Action |
|---|---|
| [BACKLOG-V2.md](BACKLOG-V2.md) | Ajouter bandeau « ⛔ Audio abandonné définitivement (PO 2026-06-14) » au début de l'Epic E9, marquer US-9.1 comme `[ABANDONNÉE]` dans le tableau ROI et le détail |
| [VISION-V2.md](VISION-V2.md) | Idem pour §11.3 reconnaissance vocale, V-02 dans tableaux, KPI cible reconnaissance vocale |
| [AUDIT.md](AUDIT.md) | Marquer O-I2 « Reconnaissance vocale » comme abandonné |
| [AUDIT-PRODUIT.md](AUDIT-PRODUIT.md) | Marquer V-02 comme abandonné dans §4 et §7 (roadmap mois 4-6) |
| [DESIGN-EQUIPEMENT.md](DESIGN-EQUIPEMENT.md) | Retirer la mention « bouton vocal 🎤 disponible » dans §4.1 |

#### Dépendances

- Aucune.

#### Risques

| # | Risque | Mitigation |
|---|---|---|
| R1.1 | Réécriture lourde risquant de fausser le sens historique | Ne pas supprimer, juste annoter. Bandeau visible en haut de chaque section impactée. |
| R1.2 | Liens internes pointant vers sections renommées | Préserver les ancres (titres inchangés, juste ajout de `[ABANDONNÉE]`). |

#### Tests à réaliser

- Lecture diagonale des 5 docs pour s'assurer que l'audio est partout marqué abandonné.
- `grep -i "audio\|vocal\|web speech"` doit ne plus retourner aucune occurrence sans annotation « abandonné ».

#### Estimation

**2-3 h** (S).

---

### Commit 2 — S3-07 : max-w-5xl sur /agents/[id] et /sites/[id]

#### Périmètre précis

Quick win UI : aligner ces 2 pages sur la convention de Today (`max-w-5xl mx-auto`) pour éviter l'étalement sur toute la largeur desktop.

#### Fichiers concernés

| Fichier | Action |
|---|---|
| [src/app/(app)/agents/[id]/page.tsx](veille-app/src/app/(app)/agents/%5Bid%5D/page.tsx) | Le wrapper a déjà `max-w-5xl mx-auto` (vérifié). À confirmer ou cohérence sub-sections. |
| [src/app/(app)/sites/[id]/page.tsx](veille-app/src/app/(app)/sites/%5Bid%5D/page.tsx) | Idem. À vérifier et harmoniser. |

#### Dépendances

- Aucune.

#### Risques

| # | Risque | Mitigation |
|---|---|---|
| R2.1 | Casser un layout interne attendu pleine largeur | Vérifier visuellement aux 4 viewports |

#### Tests à réaliser

- Preview screenshot 1280 px sur les 2 pages.
- Vérifier qu'aucune régression mobile.

#### Estimation

**1 h** (S).

---

### Commit 3 — S3-01 : Site.isOccupied — schéma + migration + UI admin

#### Périmètre précis

Modéliser le champ `Site.isOccupied: Boolean @default(true)` et l'exposer dans le formulaire admin de paramétrage de site.

#### Fichiers concernés

| Fichier | Action |
|---|---|
| [prisma/schema.prisma](veille-app/prisma/schema.prisma) | Ajouter `isOccupied Boolean @default(true)` au modèle `Site` |
| `prisma/migrations/YYYYMMDD_add_site_is_occupied/migration.sql` | **Créer** — `ALTER TABLE Site ADD COLUMN isOccupied INTEGER NOT NULL DEFAULT 1` |
| `src/app/admin/sites/SitesAdminClient.tsx` | Ajouter toggle "Site occupé / inoccupé" dans le formulaire |
| `src/app/api/admin/sites/[id]/route.ts` | Étendre le PATCH pour accepter `isOccupied` |
| `src/lib/today/constants.ts` | Ajouter commentaire indiquant que le champ existe enfin |

#### Dépendances

- Aucune.

#### Risques

| # | Risque | Mitigation |
|---|---|---|
| R3.1 | Défaut à `true` ou `false` ? | Décision : `true` (la majorité des sites SNCF sont occupés). À confirmer PO si non. |
| R3.2 | Migration en production qui ajoute une colonne NOT NULL sans valeur | Default `true` couvre le cas. SQLite tolère l'`ALTER TABLE ADD COLUMN` avec default. |
| R3.3 | Bug C2 multi-équipes scope teamId | Ne touche pas — déjà résolu Sprint 1 |

#### Tests à réaliser

- Vitest : aucun (changement de schéma uniquement).
- Manuel : `npm run db:migrate` réussit ; UI admin affiche le toggle ; sauvegarde + persistance.

#### Estimation

**8-12 h** (M).

---

### Commit 4 — S3-01b : Exploitation Site.isOccupied dans Today

#### Périmètre précis

Mettre à jour `getSitesWithoutVisit` pour utiliser la **double cadence** : trimestrielle 90 j (toujours) + planifiée 180/365 j (selon `isOccupied`). Suivre les deux séparément.

#### Fichiers concernés

| Fichier | Action |
|---|---|
| `src/lib/today/sources.ts` | Refactor `getSitesWithoutVisit` : 2 calculs (trimestrielle / planifiée) ; un site remonte si l'un OU l'autre est dépassé ; le badge précise la cause |
| `src/lib/today/types.ts` | Étendre `WatchlistItem.badges` ou ajouter un champ `overdueType: "quarterly" \| "planned" \| "both"` |
| `src/app/(app)/today/components/WatchlistRow.tsx` | Afficher le badge supplémentaire (rouge si les 2, orange si une) |

#### Dépendances

- C3 (champ `isOccupied`).

#### Risques

| # | Risque | Mitigation |
|---|---|---|
| R4.1 | Double cadence rend la watchlist trop bruyante | Limiter à top 5 + badge clair |
| R4.2 | Sites occupés/inoccupés mal seedés en dev | Seeder un site `isOccupied = false` pour tester |

#### Tests à réaliser

- Vitest : étendre `priority.test.ts` ou ajouter un test sur la nouvelle logique.
- Manuel : voir site inoccupé en retard de 200 j (planifiée) mais à jour trimestrielle.

#### Estimation

**4-6 h** (S-M).

---

### Commit 5 — S3-02 : UI admin SiteTeam (multi-équipes site)

#### Périmètre précis

Permettre à un admin / éditeur d'assigner un site à plusieurs équipes via une UI dédiée.

#### Fichiers concernés

| Fichier | Action |
|---|---|
| `src/app/admin/sites/[id]/page.tsx` | Page de détail site avec section « Équipes affectées » + multi-select |
| `src/app/api/admin/sites/[id]/teams/route.ts` | **Créer** — POST (assign), DELETE (unassign), GET (list) |
| `src/lib/auditLog.ts` ou équivalent | Tracer chaque add/remove dans AuditLog |

#### Dépendances

- Aucune (schéma `SiteTeam` déjà présent).

#### Risques

| # | Risque | Mitigation |
|---|---|---|
| R5.1 | Suppression de toutes les équipes d'un site → site orphelin | UI bloque le retrait de la dernière équipe avec message |
| R5.2 | AuditLog manquant pour cette action | Helper `logAudit` systématique |
| R5.3 | Multi-team déjà mockée dans certains tests Vitest | Préserver `assertTeamAccess` (Sprint 1) |

#### Tests à réaliser

- Manuel : assigner site à 2 équipes, vérifier que les 2 équipes voient le site.
- Vérifier qu'un USER d'une 3ᵉ équipe ne voit pas le site.

#### Estimation

**8-12 h** (M).

---

### Commit 6 — S3-A1 : Modèle TeamActivity + helper recordActivity

#### Périmètre précis

Créer la table `TeamActivity` selon les champs proposés par le PO, plus un helper `recordActivity()` qui sera appelé depuis les routes mutantes en C7.

#### Modèle Prisma proposé

```prisma
model TeamActivity {
  id          String   @id @default(cuid())
  teamId      String
  createdAt   DateTime @default(now())
  actorId     String?
  actorName   String?
  type        String   // SESSION_FINISHED | VISIT_FINISHED | AGENT_NOTE | AGENT_SIGHTED | ACTION_CREATED | ACTION_VALIDATED | ...
  entityType  String   // session | visit | agent | action | equipment | ...
  entityId    String
  entityLabel String?  // libellé court figé au moment de l'event (sert si la cible est supprimée)
  message     String   // texte humain prêt à afficher
  targetUrl   String?  // /sessions/xxx, /agents/xxx, etc. — rend la ligne cliquable
  metadata    String   @default("{}")  // JSON souple

  team   Team  @relation(fields: [teamId], references: [id], onDelete: Cascade)
  actor  User? @relation(fields: [actorId], references: [id], onDelete: SetNull)

  @@index([teamId, createdAt])
  @@index([actorId])
  @@index([type])
}
```

#### Fichiers concernés

| Fichier | Action |
|---|---|
| `prisma/schema.prisma` | Ajouter le modèle `TeamActivity` + ajouter relation `User.activitiesAuthored TeamActivity[]` et `Team.activities TeamActivity[]` |
| `prisma/migrations/YYYYMMDD_add_team_activity/migration.sql` | **Créer** — CREATE TABLE + index |
| `src/lib/activityFeed.ts` | **Créer** — fonction `recordActivity(input)` typée |
| `src/lib/activityFeed.test.ts` | **Créer** — 5 tests (création basique, multi-team, metadata JSON, helper de format, idempotence) |

#### Dépendances

- Aucune.

#### Risques

| # | Risque | Mitigation |
|---|---|---|
| R6.1 | Type `type` libre vs enum | Utiliser une union TypeScript stricte côté code, string en base. Documenter les valeurs admises. |
| R6.2 | Performance d'écriture si trop d'events | Index `(teamId, createdAt)` ; pas de transaction lourde, juste 1 INSERT par event |
| R6.3 | Rétention infinie de la table | Documenter : purge cron à prévoir si volumétrie devient gênante (>1M lignes). Hors Sprint 3. |

#### Tests à réaliser

- Vitest sur `recordActivity` : payload valide, payload avec metadata, payload sans actor (système).
- Manuel : insertion via Prisma Studio, lecture via `prisma.teamActivity.findMany`.

#### Estimation

**6-10 h** (M).

---

### Commit 7 — S3-A2 : Instrumentation des 6 routes MVP

#### Périmètre précis

Appeler `recordActivity()` depuis les 6 routes mutantes du MVP :

| Type event | Route | Message attendu | Target URL |
|---|---|---|---|
| `SESSION_FINISHED` | `POST /api/sessions/[id]/finish` (ou route équivalente) | « Session de veille terminée pour {agent} » | `/sessions/[id]` |
| `VISIT_FINISHED` | `POST /api/visits/[id]/finish` | « Visite {type} de {site} terminée » | `/visits/[id]/report` |
| `AGENT_NOTE` | `POST /api/agents/[id]/sight` (kind=NOTE) | « Commentaire ajouté sur {agent} » | `/agents/[id]` |
| `AGENT_SIGHTED` | `POST /api/agents/[id]/sight` (kind=SIGHT) | « {agent} vu par {auteur} » | `/agents/[id]` |
| `ACTION_CREATED` | `POST /api/actions` (manuelle) | « Action créée sur {agent} : {keyPoint} » | `/agents/[id]` |
| `ACTION_VALIDATED` | `POST /api/actions/[id]/validate` | « Action validée : {keyPoint} » | `/agents/[id]` |

#### Fichiers concernés

Identifier précisément les handlers existants (à faire au début de C7) :

| Fichier (à confirmer) | Action |
|---|---|
| `src/app/api/sessions/[id]/route.ts` (PATCH avec finishedAt) | Appel `recordActivity(...)` après succès |
| `src/app/api/visits/[id]/route.ts` | Idem |
| `src/app/api/agents/[id]/sight/route.ts` | Idem (2 cas : NOTE / SIGHT) |
| `src/app/api/actions/route.ts` ou `[id]/route.ts` | Idem |
| `src/app/api/actions/[id]/validate/route.ts` | Idem |

#### Dépendances

- C6 (helper `recordActivity` disponible).

#### Risques

| # | Risque | Mitigation |
|---|---|---|
| R7.1 | Double event si la route est rappelée | Pas de dedup côté event V1 ; le UI dédupera visuellement si nécessaire |
| R7.2 | Event sur opération qui échoue partiellement | `recordActivity` après succès strict (après commit Prisma) |
| R7.3 | Performance : 1 INSERT supplémentaire par mutation | Acceptable (< 1 ms) |
| R7.4 | Routes finish/PATCH/PUT pas toutes identifiables | Au début de C7, faire un audit `grep` complet pour ne pas oublier |

#### Tests à réaliser

- Manuel : déclencher chaque type d'event via UI, vérifier l'insertion dans `TeamActivity`.
- Vitest : tests d'intégration sur 1 route représentative (ex. `validate`).

#### Estimation

**10-14 h** (M-L).

---

### Commit 8 — S3-A3 : Composant ActivityFeedSection + intégration Today EDITOR

#### Périmètre précis

Afficher le flux d'activité dans la variante EDITOR de `/today`, avec lignes cliquables vers `targetUrl`.

#### Fichiers concernés

| Fichier | Action |
|---|---|
| `src/lib/today/sources.ts` | Ajouter `getTeamActivity(user, now, limit = 15)` qui retourne les N derniers events de l'équipe |
| `src/lib/today/types.ts` | Ajouter `TeamActivityEvent` au `EditorPayload` |
| `src/lib/today/aggregator.ts` | `aggregateEditor` consomme `getTeamActivity` |
| `src/app/(app)/today/components/ActivityFeedSection.tsx` | **Créer** — liste verticale, chaque ligne avec acteur + message + date relative + lien si `targetUrl` |
| `src/app/(app)/today/components/EditorDashboard.tsx` | Intégrer en bas du dashboard EDITOR |

#### Design UX proposé

```
ACTIVITÉ ÉQUIPE                                15 derniers
┌─────────────────────────────────────────────────┐
│  ●  Jessy · il y a 12 min                       │
│     Session de veille terminée pour Bardella J. │  → /sessions/xxx
├─────────────────────────────────────────────────┤
│  ●  Marie · hier 17:22                          │
│     Visite trimestrielle Poste de Lyon terminée │  → /visits/xxx/report
├─────────────────────────────────────────────────┤
│  ●  Système · hier 14:08                        │
│     3 actions générées depuis l'import Excel    │
└─────────────────────────────────────────────────┘
                  [ Voir tout — bientôt ]
```

#### Dépendances

- C6 (modèle `TeamActivity`).
- C7 (events réellement écrits, sinon section vide).

#### Risques

| # | Risque | Mitigation |
|---|---|---|
| R8.1 | Section vide tant que C7 n'instrumente pas | Acceptable, mais `<ActivityFeedSection>` doit gérer empty state |
| R8.2 | Mêmes events visibles pour DPX et assistant → doublon visuel | C'est l'objectif (« voir ce que l'autre a fait »), pas un bug |
| R8.3 | Performance scope team sur multi-team users | `getTeamActivity` utilise `teamId in u.teamIds` |
| R8.4 | Liens cassés si entité supprimée (action archivée, etc.) | `entityLabel` figé au moment de l'event ; lien peut retourner 404 — UI affiche fallback "(supprimé)" |

#### Tests à réaliser

- Manuel : générer events via C7 (clôture session test), voir apparaître dans /today EDITOR.
- Manuel : clic sur ligne → navigation vers `targetUrl`.
- Responsive 320 / 375 / 768 / 1280.

#### Estimation

**8-10 h** (M).

---

### Commit 9 — S3-08 : Refactor photos privées

#### Périmètre précis

Remplacer la mitigation Sprint 1 (path 32 octets + noindex) par le refactor complet : photos hors `public/`, route streaming auth.

#### Fichiers concernés

| Fichier | Action |
|---|---|
| `src/app/api/photos/[id]/file/route.ts` | **Créer** — GET stream avec `requireUser` + `assertTeamAccess` via la relation parent (session/visite/sighting) |
| `src/app/api/photos/route.ts` | Modifier l'écriture pour stocker dans `data/uploads/photos/` au lieu de `public/uploads/photos/` |
| `src/proxy.ts` | Retirer le bypass `/uploads/` (les anciens fichiers cassent volontairement, on les migre ensuite) |
| `next.config.ts` | Retirer le header `X-Robots-Tag` sur `/uploads/*` (plus utile) |
| `scripts/migrate-uploads.ts` | **Créer** — script de migration des fichiers existants `public/uploads/*` → `data/uploads/*` (à exécuter en fenêtre de maintenance) |
| Composants utilisant `<img src="/uploads/...">` | Migrer vers `<img src="/api/photos/{id}/file">` |

#### Dépendances

- Aucune.

#### Risques

| # | Risque | Mitigation |
|---|---|---|
| R9.1 | Migration de fichiers en prod casse les rapports PDF déjà émis | Script `migrate-uploads.ts` testé en pré-prod ; AppShell sert anciens et nouveaux pendant la transition (route streaming résout l'id, retombe sur ancien path si fichier dans `public/uploads/`) |
| R9.2 | Performance × N images par page | Cache HTTP côté route streaming (`Cache-Control: private, max-age=3600`) |
| R9.3 | PDF jspdf : addImage casse si requête asynchrone | Vérifier que chargement attend image avant `doc.save()` |
| R9.4 | Service Worker PWA cache les anciens URLs | Cache busting via versionnement |

#### Tests à réaliser

- Manuel : ouvrir une session avec photos, vérifier qu'elles s'affichent.
- Manuel : tenter d'accéder à une photo sans cookie → 401.
- Manuel : tenter d'accéder à une photo d'une autre équipe → 403.
- Manuel : générer un PDF rapport contenant des photos → photos présentes.
- Script migration : exécuter en dry-run.

#### Estimation

**12-16 h** (L).

---

### Commit 10 — S3-RECETTE : Tests E2E + bilan Sprint 3

#### Périmètre précis

Document de recette + tests manuels finaux, similaire au C12 Sprint 2.

#### Fichiers concernés

| Fichier | Action |
|---|---|
| `SPRINT3-RECETTE.md` | **Créer** — checklist 3 rôles × scénarios + perf + dette résiduelle |
| `memory/decisions.md` | Mettre à jour : Sprint 3 terminé + capacités livrées |

#### Dépendances

- Tous les commits précédents.

#### Risques

- Aucun (pas de code).

#### Tests à réaliser

- Vitest 100 % verts.
- Scénarios manuels des 3 rôles.
- Vérification des 6 events MVP : générer → afficher → cliquer.

#### Estimation

**1-2 h** (S).

---

## 3. Matrice synthétique

| Commit | Titre | Effort | Risque max |
|---|---|---|---|
| C1 | DOC audio | 2-3 h | R1.1 réécriture |
| C2 | max-w-5xl | 1 h | R2.1 layout |
| C3 | Site.isOccupied schema + UI | 8-12 h | R3.1 default value |
| C4 | Site.isOccupied dans Today | 4-6 h | R4.1 bruit |
| C5 | UI admin SiteTeam | 8-12 h | R5.1 site orphelin |
| C6 | Modèle TeamActivity + helper | 6-10 h | R6.1 type enum |
| C7 | Instrumentation 6 routes | 10-14 h | R7.1 dedup |
| C8 | ActivityFeedSection EDITOR | 8-10 h | R8.4 liens cassés |
| C9 | Photos privées refactor | 12-16 h | R9.1 migration |
| C10 | Recette Sprint 3 | 1-2 h | — |
| **Total** | — | **60-86 h** | — |

## 4. Hypothèses à valider dès le démarrage

1. **Default `Site.isOccupied = true`** : la majorité des sites SNCF sont occupés. Si faux, basculer à `false`.
2. **Routes finish/PATCH** pour clôture session/visite : identifier les noms exacts au début de C7 par grep.
3. **`recordActivity()` synchrone** dans le flux de la mutation : acceptable car perf < 1 ms ; alternative job queue hors V1.
4. **Bandeau "Voir tout" du flux d'activité** : disabled V1, page `/activity` complète Sprint 4.
5. **Suppression / archivage d'event** : pas en V1 (append-only).
6. **Affichage flux dans USER ou ADMIN** : V1 = EDITOR uniquement (DPX + assistant). USER/ADMIN restent inchangés.
7. **Migration photos** : en pré-prod d'abord, jamais directement en prod.

## 5. Stratégie de déploiement

- **Fin de chaque semaine** : commit dans `main`.
- **C9 (photos)** : ne **pas** déployer en prod tant que la migration n'a pas été exécutée en pré-prod et validée.
- **Feature flag** : pas nécessaire pour Sprint 3 (les changements sont additifs sauf C9 qui est invasif → flag `PRIVATE_PHOTOS=true` côté env pour activer le nouveau comportement).

## 6. Métriques de succès Sprint 3

- ✅ Tous les Vitest verts.
- ✅ 6 types d'events MVP générés et visibles dans Today EDITOR.
- ✅ Chaque ligne d'activité cliquable mène à la bonne fiche.
- ✅ Site occupé/inoccupé paramétrable et exploité.
- ✅ Site multi-équipes assignable depuis l'admin.
- ✅ Photos servies sous auth (en pré-prod au moins).
- ✅ 5 docs amont nettoyés de l'audio.

---

## 7. Hors périmètre Sprint 3 (rappel)

- ❌ Notifications push.
- ❌ Notifications email.
- ❌ Centre de notifications complet (boîte de réception riche, marquage lu/non lu, préférences).
- ❌ Astreinte.
- ❌ Hub Échéances (Sprint 4).
- ❌ Audio / vocal / IA vocale.
- ❌ Page `/activity` complète (V1 uniquement section dans Today EDITOR).
- ❌ Drill-down ADMIN, EntityCard refactor, /history responsive — reportés Sprint 4+ selon priorisation PO.

---

## 8. Demande de validation

Plan d'exécution Sprint 3 **prêt pour validation**.

**En attente du go pour démarrer le Commit 1 (S3-DOC).**

Modifications de scope possibles :
- Élargir C7 aux 10 events listés (au lieu des 6 MVP) → +4-6 h.
- Ajouter affichage flux dans Today ADMIN → +2-3 h.
- Ajouter purge automatique TeamActivity (cron rétention 6 mois) → +2 h.
- Reporter C9 (photos) en Sprint 4 si capacité serrée → libère 12-16 h.
