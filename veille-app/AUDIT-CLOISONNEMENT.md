# Audit de cloisonnement multi-équipes (teamId)

> Périmètre : `veille-app` (Next.js 16 app-router + Prisma/SQLite).
> Méthode : lecture réelle du code, route par route et page par page, via 9 audits de domaine + vérification de première main des constats critiques.
> Légende preuve : **✓ vérifié** = j'ai lu et confirmé le code moi-même (fichier:ligne cité) · **rapporté** = constat d'un audit de domaine, cohérent avec le modèle mais non relu ligne à ligne dans cette passe.

---

## 0. Modèle de cloisonnement (fondations vérifiées)

Tout repose sur `src/lib/auth.ts` (✓ lu intégralement) :

| Helper | Filtre produit | Sémantique |
|---|---|---|
| `teamScope(u)` (l.185-193) | `{ teamId: { in: [...] } }` ; `{}` si ADMIN global/`viewAllTeams` ; `{ teamId: "__none__" }` si aucune équipe | **STRICT** sur la colonne scalaire `teamId` |
| `agentScope(u)` (l.230-237) | `{ memberships: { some: { teamId: { in } } } }` | Agent scopé via la **join `AgentTeam`** (pas de teamId scalaire fiable) |
| `siteScope(u)` (l.271-278) | idem via `SiteTeam` | Site scopé via join |
| `actionScope(u)` (l.245-265) | `OR[ {teamId}, {agent.memberships.some}, {site.memberships.some} ]` | **LARGE** : visible si l'équipe **OU** l'agent **OU** le site est dans le scope |
| `assertTeamAccess(u, teamId)` (l.217-220) | booléen | `true` si ADMIN/`viewAllTeams` sinon `teamId ∈ u.teamIds` |
| `effectiveTeamIds(u)` (l.171-176) | `string[] | null` | équipes « agissables », `null` = global |

**Le scope ADMIN (`adminScopeMode` GLOBAL/MY_TEAMS/TEAM) n'est honoré QUE par ces helpers** (via `adminScopedTeamIds`, l.141-162) **et seulement pour le rôle ADMIN** (l.142 : retourne `null` si `role !== "ADMIN"`).

### Conséquence structurelle n°1 — `requireRole` ≠ cloisonnement
`requireRole(roles)` (l.121-131) **ne vérifie que `u.role`**. Il ignore totalement `adminScopeMode` et n'applique aucun filtre d'équipe. Donc **toute route gardée uniquement par `requireRole(...)` agit globalement** dès que le rôle passe. Le « périmètre restreint » qu'un ADMIN choisit (MY_TEAMS/TEAM) n'est **pas une frontière de sécurité** : c'est un filtre d'affichage appliqué par les ~3 surfaces qui appellent explicitement les helpers (audit, page actions, page imports). Partout ailleurs, un ADMIN scopé reste tout-puissant.

### Conséquence structurelle n°2 — le rôle EDITOR est global sur tout l'admin
`admin/layout.tsx:39` (✓) laisse entrer **ADMIN et EDITOR**. Le menu masque visuellement certaines entrées aux EDITOR mais le masquage est cosmétique : les pages et routes restent atteignables. Comme `adminScopedTeamIds` renvoie `null` pour un EDITOR, **aucune route admin ouverte à EDITOR n'est cloisonnée pour lui**.

### Conséquence structurelle n°3 — `actionScope` (large) sur des routes mutantes
`actionScope` est correct pour **afficher** des actions (3 chemins de rattachement). Mais utilisé sur des routes qui **modifient/suppriment**, il autorise une mutation cross-équipe via un agent ou un site partagé. C'est le vecteur de fuite indirecte n°1.

### Modèle de données — qui porte un `teamId` ?
- **`teamId` scalaire** : VeilleSession, ImportedAction, ActionImport, ActionValidation, SiteVisit, AgentSighting, SiteSighting, TeamActivity, Rci, VehicleRound, Vehicle (nullable), Contact (nullable).
- **Scope via join uniquement** : Agent (`AgentTeam`), Site (`SiteTeam`), User (`UserTeam`).
- **Aucun teamId (référentiel commun assumé)** : Procedure, ChecklistItem, SiteVisitTemplate, VehicleRoundTemplate, Mnemonique, Abreviation, Link/LinkCategory, Poste, Secteur, SiteEquipment (via siteId), PlanningImport/PlanningShift (scope via AgentTeam au runtime), Notification (per-user), Photo (via parent), IcareEntry (clé refType/refId globale).

---

## 1. Synthèse exécutive

**Le cœur de l'application (sessions, visites, RCI, fiches agent/site, dashboard, today, échéances) est correctement cloisonné en lecture** : le pattern `findFirst({ where: { id, ...scope } })` puis `notFound`, ou `findUnique` + `assertTeamAccess`, est appliqué de façon fiable. Les agrégateurs appliquent le scope **avant** agrégation.

Les failles se concentrent sur **3 axes** :

1. **Routes mutantes utilisant `actionScope` (large)** au lieu de `teamScope` (strict) → modification/suppression cross-équipe via agent/site partagé. **(bugs certains)**
2. **IDOR sur sous-objets** modifiés par leur id propre sans corrélation au parent scopé (non-conformités de visite). **(bug certain)**
3. **Tout l'admin protégé par le seul `requireRole`** → un EDITOR, ou un ADMIN volontairement scopé, agit globalement (création/édition/suppression d'agents, sites, véhicules, users, équipes, historique). **(faille systémique d'élévation)**

S'y ajoutent des fuites de lecture (contacts, liste users de l'historique, photoSync des stats) et une sur-diffusion des notifications d'action.

---

## 2. Cartographie des droits — par page

> Colonnes : **A** = utilisateur 1 équipe · **A+B** = multi-équipes · **Admin G** = admin global · **Admin T** = admin scopé une équipe.
> « Fuite ? » = peut-on voir/agir hors périmètre.

### 2.1 Espace applicatif `(app)` — rôle USER/EDITOR

| Page (URL) | Garde | Voit | Crée/Modifie/Supprime | Scope appliqué | Fuite ? |
|---|---|---|---|---|---|
| `/agents` | layout `(app)` + `getSessionUser` | agents de ses équipes (`agentScope`) | — (lecture) | `agentScope` ✓ | **Non** |
| `/agents/[id]` | `agentScope`→notFound | fiche agent ; **actions/validations scopées** (`teamScope`) ; **sightings + sessions NON scopés** | sight/note/action via API | mixte ✓ | **Oui (MOYEN)** : agent partagé A+B → un user de B voit les sightings (commentaires/photos) et veilles de l'équipe A |
| `/agents/[id]/development` | ADMIN/EDITOR + `agentScope` | agrégat de développement | — | `agentScope` ✓ | Partiel : agrégat mélange les équipes d'un agent multi-équipes |
| `/sessions`, `/sessions/[id]`, `/.../report`, `/new` | `teamScope`→notFound | veilles de ses équipes | crée veille dans `u.teamId` | `teamScope` ✓ | **Non** |
| `/sites`, `/sites/[id]` | `siteScope`→notFound | sites de ses équipes + équipements | équipements via API scopée site | `siteScope` ✓ | **Non** (sauf visites, cf. ci-dessous) |
| `/visits`, `/visits/[id]`, `/.../report`, `/new` | `teamScope` | visites de ses équipes | crée/édite via API | `teamScope` | **Oui (BAS)** : une visite d'un site partagé créée avec `teamId=A` est **invisible** aux membres de B (rupture de visibilité, pas fuite) |
| `/vehicle-rounds`, `/[id]`, `/.../report`, `/new` | `assertTeamAccess` / `teamScope` ✓ | tournées de ses équipes | crée tournée (équipe = véhicule) | `teamScope`/`assertTeamAccess` ✓ | **Non** |
| `/rci`, `/rci/[id]` (+wizard) | `teamScope` / `assertTeamAccess` ✓ | RCI de ses équipes | crée/édite/supprime RCI scopé | `assertTeamAccess` ✓ | **Non** |
| `/today` | `requireUser` | agrégat scopé par rôle | — | sources scopées ✓ | **Non** |
| `/dashboard` | USER→redirigé `/today` ; EDITOR/ADMIN | KPI scopés | — | `teamScope`/`actionScope` ✓ | **Non** (sauf trend `notifications` globale en ADMIN GLOBAL, documenté) |
| `/echeances` | USER→403 ; EDITOR/ADMIN | hub échéances | report/obsolète via API | `actionScope` (large) | **Oui (MOYEN)** : actions d'autres équipes via agent/site partagé + filtre teamId incohérent |
| `/stats` | `requireUser` (tout USER) | stats scopées… | — | `teamScope`/`actionScope` | **Oui (ÉLEVÉ)** : KPI « photoSync » compte les photos de **toutes** les équipes (cf. §7) |
| `/history` | `requireUser` | historique scopé (`teamScope`) | marque Icare | `teamScope` ✓ | **Non** (mais filtres : cf. §7 liste users) |
| `/notifications`, `/account/notifications` | `requireUser` | **ses** notifs uniquement (`userId`) | marque lu | `userId` ✓ | **Non** |
| `/contacts` | **aucune garde dans la page** (layout seul) | **TOUS les contacts (toutes équipes)** | — | **AUCUN** | **Oui (MOYEN)** : `Contact.teamId` existe mais jamais filtré (cf. §7) |
| `/links`, `/procedures` | `requireUser` | référentiel **commun** (pas de teamId) | — | n/a | Non (commun assumé) |

### 2.2 Back-office `/admin` (ADMIN + EDITOR via layout)

| Page (URL) | Rôle réel | Voit | Crée/Modifie/Supprime | Scope appliqué | Fuite/Élévation ? |
|---|---|---|---|---|---|
| `/admin/actions` | ADMIN | actions scopées | obsolescence/batch | `actionScope`/`teamScope` ✓ | **Non** |
| `/admin/imports` | ADMIN | imports de ses équipes | lance import | `effectiveTeamIds`+`agentScope` ✓ | **Non** |
| `/admin/audit` | ADMIN | audit scopé par auteur | — | `resolveAdminScope` ✓ | **Non** (export = global si ADMIN GLOBAL, attendu) |
| `/admin/agents` | **ADMIN+EDITOR** | **TOUS les agents + appartenances équipes** | via API ADMIN-only | **AUCUN** | **Oui (ÉLEVÉ)** : EDITOR voit toutes les équipes |
| `/admin/sites` | **ADMIN+EDITOR** | tous les sites | POST/PATCH memberships | **AUCUN** | **Oui (ÉLEVÉ)** : EDITOR crée/réaffecte des sites cross-équipe |
| `/admin/vehicles` | **ADMIN+EDITOR**, **page RSC sans garde explicite** | tous les véhicules + équipes | via API | **AUCUN** | **Oui (CRITIQUE)** : EDITOR réaffecte un véhicule d'une autre équipe |
| `/admin/teams`, `/admin/teams/[id]`, `/teams/health` | GET ADMIN+EDITOR ; mut. ADMIN | toutes les équipes | crée/édite/supprime équipe ; gère membres | **AUCUN** (`requireRole`) | **Oui (CRITIQUE)** : ADMIN scopé/EDITOR voit/agit hors périmètre ; auto-attribution possible |
| `/admin/users` | **GET ADMIN+EDITOR** ; mut. ADMIN | **TOUS les users (PII)** | crée/édite rôle+équipe ; supprime | **AUCUN** | **Oui (ÉLEVÉ)** : EDITOR liste tous les users ; ADMIN scopé change rôles/équipes globalement (élévation de privilège) |
| `/admin/planning` | ADMIN | import planning | **overwrite GLOBAL** | aucun (par design) | Ambigu : 1 import efface le planning de toutes les équipes |
| `/admin/contacts` | ADMIN+EDITOR | tous les contacts | CRUD (DELETE ADMIN) | **AUCUN** | **Oui (MOYEN)** |
| `/admin/links`, `/admin/procedures(/[id]/new)`, `/admin/visit-templates`, `/admin/vehicle-round-templates` | ADMIN+EDITOR | référentiels **communs** | CRUD | n/a | Non (commun) mais **EDITOR mute le référentiel de toutes les équipes** |

---

## 3. Cartographie des routes API

### 3.1 Actions (`/api/actions`, `/api/admin/actions`)

| Route · méthode | Auth | Scope | teamId création | Fuite/Élévation ? |
|---|---|---|---|---|
| `actions/[id]` **PATCH** | ADMIN/EDITOR | **`actionScope`** puis `update({where:{id}})` | — | **CRITIQUE ✓** : modifie une action d'une autre équipe via agent/site partagé |
| `actions/[id]` **DELETE** `?mode=hard` | ADMIN/EDITOR | **`actionScope`** puis `delete({where:{id}})` | — | **CRITIQUE ✓** : supprime hors équipe |
| `actions/[id]` **DELETE** `?mode=soft` | ADMIN/EDITOR | délègue `obsoleteAction` → `teamScope` | — | OK (strict) — incohérent avec hard |
| `actions/[id]/postpone` POST | ADMIN/EDITOR | **`actionScope`** | — | **ÉLEVÉ** : report d'échéance hors équipe |
| `actions/[id]/obsolete` POST | ADMIN/EDITOR | `teamScope` ✓ | — | OK |
| `actions/[id]/validate` POST | `requireUser` | `findUnique`+`assertTeamAccess` ✓ | validation = `action.teamId` | OK (validation cross-équipe impossible) |
| `actions/[id]/equipment-link` GET | `requireUser` | `assertTeamAccess` ✓ | — | OK |
| `actions/batch-obsolete` POST | ADMIN/EDITOR | `teamScope` ✓ | — | OK |
| `actions/validations/[id]` PATCH/DELETE | USER+ | `teamScope` / `assertTeamAccess` ✓ + auteur+fenêtre 5 min | — | OK |
| `admin/actions` (liste) | ADMIN | `teamScope` ✓ | — | OK |
| `admin/actions/batch-delete` | ADMIN | `teamScope` ✓ | — | OK |
| `admin/actions/batch-replace` | ADMIN/EDITOR | `teamScope` ✓, clone hérite teamId | clone même équipe | OK |
| `admin/actions/import` POST | ADMIN/EDITOR | teamId validé `effectiveTeamIds` ; **agents lookup matricule GLOBAL** | équipe importeur | **ÉLEVÉ** : lie/réécrit le `teamId` d'agents d'autres équipes (cf. §7) |
| `admin/actions/quick` POST | ADMIN/EDITOR | teamId explicite validé `effectiveTeamIds`, agents bornés | équipe explicite | OK (référence) |
| `agents/[id]/actions` POST | `requireUser` | `agentScope` + intersection `agent∩effectiveTeamIds` + choix explicite | intersection vérifiée | OK (référence) |
| `sites/[id]/actions` POST | `requireUser` | `siteScope` ; **teamId = `site.teamId ?? memberships[0] ?? u.teamId`** | ambigu | **MOYEN** : action créée dans une équipe ambiguë |

### 3.2 Agents / Sightings

| Route · méthode | Auth | Scope | Fuite ? |
|---|---|---|---|
| `agents/sparklines` GET | `requireUser` | `agentScope` sur ids ; agrégats par `agentId` seul | BAS : agrégat cross-équipe pour agent partagé |
| `agents/[id]/visibility` POST | `requireUser` | **`findUnique` sans `agentScope`** | FAIBLE : oracle d'existence cross-équipe |
| `agents/[id]/sight` POST | `requireUser` | `agentScope` lecture ; **teamId = `agent.teamId` legacy** | MOYEN : sighting estampillé hors scope du créateur |
| `agents/[id]/development/pdf-log` POST | ADMIN/EDITOR | `agentScope` ✓ | OK |
| `admin/agents` POST | ADMIN | aucun (global assumé) | par design (réserve : ignore adminScopeMode) |
| `admin/agents/[id]` PATCH/DELETE | ADMIN | **`findUnique` sans scope** | MOYEN : ADMIN scopé agit hors périmètre |
| `sightings/[id]` PATCH | ADMIN/EDITOR | `findUnique`+`assertTeamAccess` ✓ | OK |

### 3.3 Sessions / Observations / Photos

| Route · méthode | Auth | Scope | Fuite ? |
|---|---|---|---|
| `sessions` GET/POST | `requireUser` | GET `teamScope` ✓ ; POST `teamId=u.teamId` | voir idempotence ↓ |
| `sessions` POST (idempotence) | — | `findUnique({clientGeneratedId})` **sans `assertTeamAccess`** | MOYEN : renvoie une session d'une autre équipe |
| `sessions` POST/`[id]` PATCH (agentId/posteId/secteurId) | — | écrits **sans `agentScope`** | MOYEN : session liée à un agent d'une autre équipe |
| `sessions/[id]` GET/PATCH/DELETE | `requireUser` | `loadScoped` (`teamScope`) ✓ | OK |
| `sessions/[id]/report` GET | `requireUser` | `findFirst`+scope ✓ | OK |
| `sessions/[id]/auto-validate-candidates` GET | `requireUser` | `assertTeamAccess` ✓ | OK |
| `observations/[id]` PATCH | `requireUser` | remonte session → `assertTeamAccess` ✓ | OK |
| `photos/[id]/file` GET | `requireUser` | remonte parent → `assertTeamAccess` ✓ | OK |
| `photos` POST | `requireUser` | teamId via parent + `teamScope` ✓ | OK |
| `photos/[id]` PATCH/DELETE | `requireUser` | **uniquement `uploaderId`/ADMIN, pas de `assertTeamAccess`** | MOYEN-bas : contrôle d'appartenance ignoré (cf. §7) |

### 3.4 Sites / Visites / Équipements

| Route · méthode | Auth | Scope | Fuite ? |
|---|---|---|---|
| `sites` GET | `requireUser` | `siteScope` ✓ | OK |
| `sites/[id]/equipment` (+`[eqId]`, postpone, import) | `requireUser`/ADMIN-EDITOR | site `siteScope` puis eq par `{id,siteId}` ✓ | OK |
| `sites/[id]/sight` POST | `requireUser` | `siteScope` ; teamId ambigu | MOYEN (ambiguïté équipe) |
| `visits` GET/POST | `requireUser` | GET `teamScope` ; POST `siteScope`, teamId = `site.teamId??…` | MOYEN (ambiguïté) + visite invisible à l'autre équipe du site |
| `visits/[id]` GET/PATCH/DELETE | `requireUser` | `loadScoped` `teamScope` ✓ | OK |
| `visits/[id]/observations(/[obsId])` | `requireUser` | visite scopée + obs par `{id,visitId}` ✓ | OK |
| `visits/[id]/non-conformities/[ncId]` **PATCH/DELETE** | `requireUser` | visite scopée mais **NC mutée par `{id:ncId}` sans `visitId`** | **ÉLEVÉ ✓** : IDOR cross-équipe (cf. §7) |
| `site-sightings/[id]` PATCH | ADMIN/EDITOR | `findUnique`+`assertTeamAccess` ✓ | OK |
| `admin/sites` GET/POST | ADMIN/EDITOR | **aucun** | ÉLEVÉ : EDITOR crée site dans n'importe quelle équipe |
| `admin/sites/[id]` PATCH | ADMIN/EDITOR | **`findUnique` sans scope** | ÉLEVÉ : EDITOR réécrit les `teamIds` d'un site |
| `admin/sites/[id]` DELETE | ADMIN | strict | OK |

### 3.5 Véhicules / Tournées

| Route · méthode | Auth | Scope | Fuite ? |
|---|---|---|---|
| `vehicles` GET | `requireUser` | `teamScope` ✓ | OK |
| `vehicle-rounds` GET/POST | `requireUser` | GET `teamScope` ✓ ; POST véhicule scopé, teamId fallback | MOYEN : véhicule `teamId=null` → tournée dans équipe arbitraire |
| `vehicle-rounds/[id]` GET/PATCH/DELETE | `requireUser` | `assertTeamAccess` ✓ | OK |
| `vehicle-rounds/[id]/observations/[obsId]` PATCH | `requireUser` | `assertTeamAccess`+`roundId` ✓ | OK |
| `admin/vehicles` GET/POST | ADMIN/EDITOR | **aucun** | **CRITIQUE ✓** : EDITOR crée véhicule dans n'importe quelle équipe |
| `admin/vehicles/[id]` PATCH/DELETE | ADMIN/EDITOR | **`findUnique` sans scope**, `teamId` patchable | **CRITIQUE ✓** : EDITOR réaffecte/supprime un véhicule d'une autre équipe |
| `admin/vehicle-round-templates/[id]/items(/[itemId])` | ADMIN/EDITOR | référentiel commun | ÉLEVÉ : EDITOR mute le catalogue de toutes les équipes |
| `stats/vehicle-rounds` GET | `requireUser` | `teamScope`+`actionScope` ; **« dernière tournée » `findFirst` sans scope** | MOYEN : stat d'une autre équipe sur véhicule partagé |

### 3.6 Stats / Today / Échéances (agrégats)

| Route | Auth | Scope | Fuite ? |
|---|---|---|---|
| `stats` (principal) | `requireUser` | `teamScope` avant agrégation ✓ | OK |
| `stats/actions` | `requireUser` | `teamScope`+`actionScope` ; **`photos` non scopé** | **ÉLEVÉ ✓** (cf. §7) + incohérence num/dénom |
| `stats/activity`, `stats/quality`, `stats/veille-site`, `stats/vehicle-rounds` | `requireUser` | scope avant agrégation ✓ | OK (sauf « dernière tournée » ↑) |
| `today` | `requireUser` | sources scopées par rôle ; ADMIN GLOBAL = vue système | OK |
| `echeances` | EDITOR/ADMIN | sources scopées ; actions via `actionScope` | MOYEN (actions cross-équipe via agent/site partagé) |

### 3.7 Notifications / Activité / Push / Cron

| Route | Auth | Scope | Fuite ? |
|---|---|---|---|
| `notifications` GET, `[id]/read`, `read-all` | `requireUser` | `userId` strict (`updateMany where userId`) ✓ | OK (pas d'IDOR) |
| `push/subscribe`, `me/notification-preferences`, `me` | `requireUser` | `userId` de session ✓ | OK |
| `cron/echeances-push` | `x-cron-secret` | scope per-user respecté ✓ | OK |
| `auth/me` | cookie | renvoie l'user courant seul ✓ | OK |

### 3.8 Admin transverse

| Route | Auth | Scope effectif ? | Fuite/Élévation ? |
|---|---|---|---|
| `admin/teams` GET/POST | EDITOR(GET)/ADMIN | **non** | EDITOR voit toutes les équipes |
| `admin/teams/[id]` PATCH/DELETE | ADMIN | **non** | ADMIN scopé édite/supprime n'importe quelle équipe |
| `admin/teams/[id]/members` PATCH | ADMIN | **non** | remplace membres d'une équipe hors périmètre |
| `admin/teams/[id]/members/[kind]/[refId]` POST/DELETE | ADMIN | **non ✓** | CRITIQUE : auto-attribution + rattachement cross-équipe |
| `admin/users` GET/POST | EDITOR(GET)/ADMIN | **non** | EDITOR liste tous les users ; POST rôle/teamId libres |
| `admin/users/[id]` PATCH/DELETE | ADMIN | **non** | élévation de privilège (USER→ADMIN), changement d'équipe |
| `admin/scope-preference` POST | ADMIN | **oui ✓** (teamId validé, soi-même) | OK |
| `admin/planning/import|preview` | ADMIN | **non** (overwrite global) | ambigu/architecture |
| `admin/imports/pointages` POST | ADMIN/EDITOR | **non** | EDITOR injecte historique sur tous agents/sites + crée des users |
| `admin/history/[type]/[id]/delete` POST | ADMIN | **non** | hard-delete d'historique de n'importe quelle équipe |
| `admin/maintenance/purge` POST | ADMIN | **non** (purge globale par date) | transverse (dry-run par défaut) |
| `admin/audit(/export.csv)` GET | ADMIN | **oui ✓** | OK |
| `admin/contacts`, `admin/links(/[id])`, `admin/procedures/*` | ADMIN/EDITOR | n/a (commun) | EDITOR écrit le référentiel global |

### 3.9 RCI / Icare / Référentiel

| Route | Auth | Scope | Fuite ? |
|---|---|---|---|
| `rci` GET/POST | `requireUser` | GET `teamScope` ; POST teamId validé `u.teamIds` ✓ | OK |
| `rci/[id]` GET/PATCH/DELETE | `requireUser` | `findUnique`+`assertTeamAccess` ✓ | OK (pas d'IDOR) |
| `rci/[id]/docx` GET | `requireUser` | **aucun** (génère depuis le body, pas la DB) | FAIBLE : pas de fuite DB mais aucun contrôle d'équipe |
| `icare` POST | `requireUser` | **aucun** (toggle par `refType/refId`) | MOYEN : IDOR d'écriture cross-équipe |
| `history/filters` GET | `requireUser` | agents/sites scopés ; **`user.findMany` non scopé** | MOYEN : liste de tous les users (cf. §7) |
| `procedures`, `links`, `vehicles`, `health` | variable | commun / scopé | OK |

---

## 4. Vérifications transverses (checklist demandée)

| Motif recherché | Résultat |
|---|---|
| Requêtes Prisma sans filtre teamId | **Trouvé** : `stats/actions` photos, `history/filters` users, `contacts` page, `admin/*` (agents/sites/vehicles/teams/users), `planning deleteMany({})` |
| `include()` contournant le scope | Non trouvé de cas franc : les `include` partent d'entités déjà scopées |
| `OR` trop larges | **`actionScope`** (par design) — problématique sur routes mutantes |
| Usage incohérent `actionScope`/`teamScope` | **Trouvé** : `actions/[id]` (lecture actionScope / soft-delete teamScope), `stats/actions` (actions actionScope / validations teamScope) |
| Récupération avant filtrage | `sessions` idempotence (`findUnique` puis renvoi sans check) |
| Filtrage uniquement côté client | menu admin (masquage cosmétique) ; pas de filtrage métier client-only critique trouvé |
| API protégée seulement par le front | **Tout l'admin** : `requireRole` seul, le scope visuel n'est pas appliqué serveur |
| Héritage implicite de teamId | sighting/visite/action-site héritent de `teamId` legacy (`agent.teamId`/`site.teamId`) sans intersection |
| Choix automatique d'équipe ambiguë | `sites/[id]/actions`, `sites/[id]/sight`, `visits` POST, `vehicle-rounds` POST (fallback non déterministe) |
| Création dans la mauvaise équipe | idem ci-dessus |
| Modification d'un objet d'une autre équipe | **`actions/[id]` PATCH ✓, NC `[ncId]` ✓, admin/vehicles ✓, admin/sites, admin/users** |
| Suppression hors périmètre | **`actions/[id]` hard ✓, NC `[ncId]` DELETE ✓, history delete, teams DELETE, vehicles DELETE** |
| Stats mélangeant des équipes | **`stats/actions` photoSync ✓** ; sinon scopé |
| Exports mélangeant des équipes | audit CSV = global si ADMIN GLOBAL (attendu) ; pas d'autre export cross-équipe |
| Notifs à la mauvaise équipe | **`validate`, `agents/[id]/actions`, `sites/[id]/actions`** : diffusion à l'union des équipes de l'agent/site |
| Imports impactant une autre équipe | **`admin/actions/import`** (agents par matricule global) ; `planning` (overwrite global) ; `imports/pointages` |
| Obsolescence hors périmètre | Non (obsolete/batch-obsolete en `teamScope`) ; mais `actions/[id]` hard delete oui |
| Validation d'une action d'une autre équipe | Non (`validate` strict `assertTeamAccess`) |
| Accès indirect via agent partagé | **Oui** : actions visibles/mutables via `agent.memberships` ; fiche agent (sightings/sessions) ; notifs |
| Accès indirect via site partagé | **Oui** : `actionScope` via `site.memberships` ; visite invisible à l'autre équipe |

---

## 5. Simulation des 4 cas utilisateurs

### Cas 1 — Utilisateur de la seule équipe A (USER)
- **Voit** : agents/sites/sessions/visites/tournées/RCI/historique **de A uniquement** (helpers `*Scope` stricts). Today/stats/échéances scopés A.
- **Fuites subies** : (a) **contacts de toutes les équipes** (`/contacts` non filtré) ; (b) sur un **agent partagé A+B**, les sightings et veilles de B apparaissent dans `/agents/[id]` ; (c) le KPI photoSync de `/stats` compte les photos de B ; (d) via `/icare`, peut toggler le flag d'une entité de B (IDOR écriture, à l'aveugle).
- **Ne peut pas** : valider/obsolète (rôle), accéder à l'admin (layout). Validation d'action strictement bornée à A.

### Cas 2 — Utilisateur des équipes A et B (USER ou EDITOR)
- **Voit** : l'union A∪B partout (helpers `in [A,B]`).
- **Crée** : 
  - veille → toujours `u.teamId` (**équipe principale**, pas de choix) ;
  - action sur agent → **intersection agent∩{A,B}**, choix explicite si ambigu (bon) ;
  - action sur **site** / sighting site / visite → **`site.teamId` legacy**, sans intersection → peut atterrir dans A alors qu'il agit pour B ;
  - RCI → teamId validé contre `{A,B}`.
- **Agent multi-équipes** : un agent dans A et B fait remonter ses actions dans le scope A **et** B via `actionScope` ; un EDITOR A+B peut donc **modifier/supprimer (PATCH, hard-delete, postpone)** une action dont le `teamId` est A *ou* B, indistinctement — y compris une action « propriété » d'une équipe à laquelle il n'agit pas pour cette action.

### Cas 3 — Administrateur en vue globale (`adminScopeMode=GLOBAL`)
- **Voit tout** : les helpers renvoient `{}` (aucun filtre). Today bascule sur la « vue système » (`aggregateAdmin`). Audit/stats globaux.
- **Différence avec un multi-équipes** : l'admin global voit **toutes** les équipes même sans membership ; un USER A+B est limité à A∪B. L'admin a aussi accès à tout le back-office mutant.

### Cas 4 — Administrateur scopé une équipe (`adminScopeMode=TEAM`)
- **En lecture** : les **3 surfaces** qui consultent le scope (page actions, page imports, audit) se restreignent correctement à l'équipe choisie.
- **En écriture / partout ailleurs** : **comportement identique à un ADMIN global**. `requireRole("ADMIN")` ignore `adminScopeMode`. Il peut donc créer/éditer/supprimer agents, sites, véhicules, users, équipes, historique de **n'importe quelle** équipe, s'auto-rattacher à une équipe, etc.
- **Donc NON**, ce n'est **pas** équivalent à un utilisateur classique de cette équipe : le scope admin est une préférence d'affichage, pas une contrainte d'autorisation. **C'est l'écart le plus important entre l'intention affichée et la réalité du code.**

---

## 6. Tableau des incohérences

| Gravité | Élément | Problème | Risque | Correctif proposé |
|---|---|---|---|---|
| CRITIQUE | `api/actions/[id]` PATCH & DELETE hard | `actionScope` (large) puis mutation par `id` | EDITOR de B modifie/supprime une action de A via agent/site partagé | Remplacer par `teamScope`, ou `findUnique`+`assertTeamAccess(u,row.teamId)` |
| CRITIQUE | `api/admin/vehicles/[id]` PATCH/DELETE & `admin/vehicles` POST | `requireRole(["ADMIN","EDITOR"])`, aucun scope, `teamId` patchable | EDITOR s'approprie/supprime un véhicule d'une autre équipe | `assertTeamAccess` + valider `teamId ∈ effectiveTeamIds(u)` ; réserver à ADMIN |
| CRITIQUE | `api/admin/teams/[id]/members*` | `requireRole("ADMIN")` sans `assertTeamAccess` sur `teamId` | ADMIN scopé/auto-attribution + rattachement cross-équipe | Garde `adminScopeAllowsTeam(scope,teamId)` ; interdire l'auto-ajout |
| CRITIQUE | `api/admin/users/[id]` PATCH | `role`/`teamId` modifiables sans scope | Élévation de privilège (USER→ADMIN), déplacement d'équipe | Restreindre cible au scope ; gate explicite sur changement de rôle |
| ÉLEVÉ | `api/visits/[id]/non-conformities/[ncId]` PATCH/DELETE | `ncId` muté sans corrélation au `visitId` scopé | IDOR : tout USER modifie/supprime la NC d'une autre équipe (+ obsolète son action) | `findFirst({ where:{ id:ncId, visitId } })` avant mutation |
| ÉLEVÉ | `api/stats/actions` photos | `photo.findMany` sans aucun scope | KPI photoSync compte les photos de toutes les équipes (page `/stats` ouverte à tout USER) | Joindre Photo à une entité scopée (session/visite/sighting) et filtrer |
| ÉLEVÉ | `admin/agents` & `admin/sites` (page + API) | EDITOR voit/édite toutes les équipes (aucun scope) | Fuite de lecture + réaffectation cross-équipe par EDITOR | Scoper, ou réserver à ADMIN |
| ÉLEVÉ | `api/admin/users` GET | `requireRole(["ADMIN","EDITOR"])`, liste complète | EDITOR voit la PII de tous les users | Réserver à ADMIN ou filtrer par scope |
| ÉLEVÉ | `api/admin/actions/import` | lookup agents par matricule **global** + réécriture `teamId` | Lie/capture des agents d'autres équipes | Scoper le lookup ; ne pas réassigner `teamId` d'un agent existant ; signaler matricules hors équipe |
| ÉLEVÉ | `api/admin/imports/pointages` | EDITOR, préchargement global agents/sites + crée des users | Injection d'historique cross-équipe + création de comptes | Réserver à ADMIN ; scoper agents/sites ; bloquer création users |
| ÉLEVÉ | `api/admin/history/[type]/[id]/delete` | hard-delete sans check `teamId` | ADMIN scopé détruit l'historique d'une autre équipe | Charger teamId + `adminScopeAllowsTeam` avant delete |
| ÉLEVÉ | `notifications` (validate, agents/[id]/actions, sites/[id]/actions) | destinataires = union de toutes les équipes de l'agent/site | EDITOR/ADMIN d'une équipe tierce notifié d'une action qui ne lui appartient pas | Cibler `action.teamId` seul (cf. `SESSION_FINISHED`) |
| MOYEN | `api/actions/[id]/postpone` | `actionScope` | report d'échéance cross-équipe | `teamScope` |
| MOYEN | `echeances/sources.ts` | `actionScope` + `context.teamIds` omet `agent.memberships` | actions cross-équipe + filtre teamId erratique | Décider lecture large (compléter teamIds) ou stricte (`teamScope`) |
| MOYEN | `api/photos/[id]` PATCH/DELETE | contrôle `uploaderId`/ADMIN sans `assertTeamAccess` | incohérent avec la lecture ; suppression hors appartenance courante | Ajouter la remontée d'équipe de `file/route.ts` |
| MOYEN | `/contacts` + `admin/contacts` | `Contact.teamId` existe mais jamais filtré ; page sans garde | tout USER voit tel/email/notes de toutes les équipes | Filtrer `teamScope OR teamId:null`, ou retirer `teamId` (décision) |
| MOYEN | `api/history/filters` users | `user.findMany` sans scope (commentaire ment) | liste de tous les users à tout USER | Restreindre aux observateurs du scope ou aux membres `effectiveTeamIds` |
| MOYEN | `api/icare` POST | toggle par `refType/refId` sans `assertTeamAccess` | altération d'état cross-équipe + oracle d'existence | Charger l'entité et vérifier l'accès avant toggle |
| MOYEN | `sessions` POST idempotence + agentId/posteId/secteurId | renvoi/écriture sans contrôle de scope | lecture d'une session d'une autre équipe ; liaison agent cross-équipe | `assertTeamAccess` sur l'existant ; valider les ids via `agentScope`/`siteScope` |
| MOYEN | `sites/[id]/actions`, `sites/[id]/sight`, `visits` POST, `vehicle-rounds` POST | teamId hérité du legacy sans intersection | création dans une équipe ambiguë/non voulue | Calculer `équipes(parent) ∩ effectiveTeamIds(u)`, choix explicite si >1 |
| MOYEN | `stats/vehicle-rounds` « dernière tournée » | `findFirst` sans `teamScope` | stat d'une autre équipe sur véhicule partagé | ajouter `...teamScope(u)` |
| MOYEN | `admin/agents/[id]`, `admin/sites/[id]` | `findUnique` sans scope (ADMIN scopé) | mutation hors périmètre | `assertTeamAccess`/`adminScopeAllowsTeam` |
| FAIBLE | `agents/[id]/visibility`, `rci/[id]/docx` | `findUnique`/aucun scope | oracle d'existence ; docx sans contrôle | `findFirst`+scope ; relire le RCI en DB |
| FAIBLE | `auth-edge.ts` token | `base64(secret:userId)` sans HMAC ni expiration | forge d'identité si secret fuit ; pas de révocation | signer (HMAC+exp) ou session opaque en DB |
| ARCHI | `requireRole` partout en admin | n'applique jamais `adminScopeMode` | scope admin = cosmétique sur l'écriture | garde `requireAdminScopeAccess(u, teamId)` systématique |

---

## 7. Bugs certains (démontrés — relus de première main)

1. **Modification/suppression d'action cross-équipe** — `src/app/api/actions/[id]/route.ts` ✓
   - PATCH l.28-29 : `findFirst({ where: { id, ...actionScope(u) } })` puis l.47-48 `update({ where: { id } })`.
   - DELETE hard l.87-88 puis l.136 `delete({ where: { id } })`.
   - `actionScope` (auth.ts:245) renvoie `true` via `agent.memberships`/`site.memberships`. Chemin : agent partagé A+B → un EDITOR de B trouve l'action `teamId=A` et la mute. La mutation ne re-vérifie jamais `teamId`. **Incohérence interne** : le soft-delete (l.96 `obsoleteAction`) utilise `teamScope` strict, donc soft 404 mais hard supprime.

2. **IDOR sur non-conformité de visite** — `src/app/api/visits/[id]/non-conformities/[ncId]/route.ts` ✓
   - PATCH : visite scopée l.28-29 (`teamScope`), mais l.47-48 `siteVisitNonConformity.update({ where: { id: ncId } })` — `ncId` jamais corrélé à `visit.id`.
   - DELETE : l.106-108 `findUnique({ id: ncId })` sans `visitId`, puis l.112-120 supprime la NC **et marque OBSOLETE l'`ImportedAction` générée** (`nc.generatedActionId`) d'une autre équipe.
   - Exploit : un USER fournit un `visitId` qu'il possède + un `ncId` d'une visite d'une autre équipe.

3. **EDITOR réaffecte/supprime un véhicule d'une autre équipe** — `src/app/api/admin/vehicles/[id]/route.ts` ✓
   - PATCH l.25 `requireRole(["ADMIN","EDITOR"])`, l.43 `findUnique({ where:{ id } })` sans scope, l.46-48 `update({ data: parsed.data })` avec `teamId` dans le schéma (l.16). Exploit : `PATCH /api/admin/vehicles/{idÉquipeB}` body `{"teamId":"<A>"}`.

4. **Rattachement d'équipe sans contrôle de périmètre (auto-attribution)** — `src/app/api/admin/teams/[id]/members/[kind]/[refId]/route.ts` ✓
   - POST l.55 `requireRole("ADMIN")` puis l.85/94/103 `create` sur n'importe quel `teamId`/`refId`, sans `assertTeamAccess`. Un ADMIN scopé TEAM peut s'ajouter (`kind=user`, son id) à toute équipe ou y verser des agents d'autres équipes.

5. **Fuite stat photoSync** — `src/app/api/stats/actions/route.ts` (rapporté, cohérent) : `photo.findMany({ where: { createdAt: {…} } })` sans scope, page `/stats` ouverte à tout USER.

6. **Fuite des contacts** — `src/app/(app)/contacts/page.tsx:8` ✓ : `contact.findMany({ orderBy })` sans `where` ni garde de page ; `Contact.teamId` (schema:619) existe mais n'est jamais filtré ; tel/email/notes/teamId exposés à tout authentifié.

7. **Fuite de la liste des users** — `src/app/api/history/filters/route.ts:20-23` ✓ : `user.findMany({ where:{ isActive:true } })` (scope calculé puis ignoré, `void scope` l.37) alors que le commentaire l.7 annonce un filtrage par scope.

8. **Sur-diffusion des notifications d'action** — `src/app/api/actions/[id]/validate/route.ts:206-251` ✓ : `teamIdSet` = `action.teamId ∪ agent.memberships ∪ site.memberships`, passé à `recordActivitySafe` et `notifyActionValidated`. Idem `agents/[id]/actions` et `sites/[id]/actions` (rapporté). Une action propriété de A notifie les EDITOR/ADMIN de B si l'agent/site est partagé.

9. **Photos mutables sans contrôle d'équipe** — `src/app/api/photos/[id]/route.ts:27,72` ✓ : seul `uploaderId !== u.id && role !== "ADMIN"`. Pas de remontée d'équipe (contraste avec `file/route.ts`). Gravité atténuée (il faut être l'uploader), mais la politique d'accès ne dépend pas de l'équipe.

---

## 8. Comportements ambigus (décision fonctionnelle requise)

1. **Fiche agent multi-équipes** : sightings (commentaires managériaux + photos) et veilles ne sont **pas** filtrés par équipe (`/agents/[id]` l.160-180). Choix « transversal » documenté en commentaire, mais expose du contenu inter-équipes. → Décider : transversal assumé, ou `teamScope` sur sightings/sessions.

2. **`actionScope` (large) par conception** : faut-il qu'une action soit visible par toutes les équipes de son agent/site, ou uniquement par l'équipe propriétaire (`teamId`) ? La réponse conditionne la correction de presque toutes les routes actions/échéances/notifications.

3. **Visites des sites partagés** : actuellement scopées par `teamId` scalaire → invisibles aux autres équipes du site. Incohérent avec « le site est partagé ». → Décider : visite visible par toutes les équipes du site (scope via site) ou propriété stricte d'une équipe.

4. **Planning** : `PlanningShift`/`PlanningImport` n'ont **pas** de teamId (par design, cf. `memory/planning-import-rules.md` « overwrite intégral »). Donc 1 import efface le planning de tout le monde. → Confirmer que le planning est bien une ressource unique partagée, sinon ajouter un teamId.

5. **Contact.teamId** : le champ existe mais n'est jamais utilisé. → Contacts communs (retirer le champ) ou cloisonnés (filtrer) ?

6. **Référentiels édités par EDITOR** : procédures, templates de visite/tournée, liens — un EDITOR mono-équipe modifie le référentiel de toutes les équipes. Acceptable car commun, mais à acter explicitement.

7. **ADMIN GLOBAL = vue système** : Today/dashboard/audit montrent volontairement toutes les équipes. Confirmé par les commentaires ; à valider comme intentionnel.

---

## 9. Améliorations d'architecture (sans changer le métier)

1. **Garde unique `requireAdminScopeAccess(u, teamId)`** combinant `requireRole` + `adminScopeAllowsTeam(resolveAdminScope(u), teamId)`. À appeler dans **toute** route admin mutante après chargement de l'entité. Supprime d'un coup l'écart « scope = cosmétique ».

2. **Helper `assertActionMutable(u, action)`** centralisant le contrôle strict (`assertTeamAccess(u, action.teamId)`) pour PATCH/DELETE/postpone, distinct de `actionScope` réservé à l'affichage. Rendre explicite « scope d'affichage » vs « scope d'autorisation ».

3. **Pattern systématique pour les sous-objets** : tout handler `[child]` doit charger le child filtré par la clé du parent déjà scopé (`findFirst({ id: childId, parentId })`). Le code le fait déjà pour observations/équipements ; à généraliser aux NC, photos, etc. (lint/règle de revue).

4. **Choix d'équipe à la création** : un helper `resolveOwningTeam(u, parentTeamIds)` = intersection `effectiveTeamIds(u) ∩ parentTeamIds`, exigeant un choix explicite si ambigu (le pattern de `agents/[id]/actions` est la référence). À appliquer aux visites, sightings site, actions site, tournées.

5. **Destinataires de notification = équipe propriétaire** : remplacer l'union des memberships par `[entité.teamId]` (le pattern `SESSION_FINISHED` est déjà correct). Pour les entités réellement partagées (visite de site), choisir explicitement.

6. **Pages RSC admin** : ajouter une garde de rôle/scope en tête de chaque page (ne pas dépendre du seul layout) et appliquer les helpers `*Scope` aux `findMany`.

7. **Cookie d'auth** : passer à un jeton signé (HMAC + expiration) ou une session opaque côté DB, pour permettre la révocation et empêcher la forge si le secret fuit.

8. **Décision sur `actionScope`** (cf. §8.2) : si la lecture large est conservée, ajouter `agent.memberships` à `context.teamIds` dans `echeances/sources.ts` pour cohérence du filtre ; sinon, basculer les lectures d'actions sur `teamScope`.

---

### Annexe — surfaces confirmées saines (référence de bon pattern)
`actions/[id]/validate` & `validations/[id]` · `actions/obsolete`/`batch-obsolete`/`batch-delete`/`batch-replace`/`quick` · `agents/[id]/actions` (intersection) · `sessions/[id]` (`loadScoped`) · `observations/[id]` · `photos/[id]/file` · `photos` POST · `rci` + `rci/[id]` · `sightings/[id]` · `site-sightings/[id]` · `admin/scope-preference` · `admin/audit` · notifications lecture (`userId` strict) · cron echeances-push.
