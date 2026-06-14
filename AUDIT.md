# Audit complet — Application Veille

> **Périmètre** : `C:\Users\PC\Desktop\Veille\veille-app\` — Next.js 16 / React 19 / Prisma 7 / SQLite / PWA serwist.
> **Date** : 2026-06-13.
> **Objectif** : audit exhaustif pré-déploiement multi-équipes. Aucun code modifié.
> **Méthode** : analyse statique (lecture exhaustive, grep ciblés) sur 30 pages, 50+ routes API, ~25 modèles Prisma, lib partagée, composants, middleware.

---

## 0. Synthèse exécutive

L'application Veille est **fonctionnellement riche et techniquement saine sur ses fondations** : architecture App Router cohérente, scopes multi-équipes centralisés (`teamScope`/`agentScope`/`siteScope`/`actionScope`), validation Zod quasi systématique, scrypt pour les mots de passe, dynamic imports pour jspdf/xlsx, aucun usage de `any`, aucun SQL raw, aucun `dangerouslySetInnerHTML`.

Trois familles de problèmes **bloquent un déploiement multi-équipes responsable** :

1. **Sécurité / isolation** : photos servies en accès public sans authentification (bypass `/uploads/` du middleware), bug de comparaison de scope `teamId` qui casse l'isolation pour les utilisateurs multi-équipes dans 3 endpoints, token cookie sans signature HMAC ni expiration côté token, pas de rate-limit sur le login, pas de validation MIME/taille à l'upload.

2. **Promesses non tenues** : la chaîne offline (PWA / `syncQueue` / page `/offline` / badge « EN FILE ») est **câblée mais jamais utilisée** par les composants — aucun `fetch` mutant ne passe par `resilientFetch`. Une mutation hors-ligne échoue silencieusement et la donnée est perdue. Sur le terrain (gare, dépôt, local technique), c'est une régression silencieuse.

3. **Cohérence métier** : 4 entrées du menu desktop sont absentes du menu mobile (Sessions, Stats, Liens utiles, Contacts) — alors que l'application est annoncée comme « utilisée en situation opérationnelle sur le terrain » ; un agent en intervention ne peut pas appeler un contact d'astreinte depuis son smartphone. Le bouton « Nouvelle procédure » mène à un 404. Les rapports PDF déjà finalisés ne sont rouvrables qu'en saisissant l'URL. EDITOR voit `/admin/users`, `/admin/teams`, `/admin/agents` mais reçoit un 403 silencieux sur tous les boutons.

L'audit identifie également : 6 routes API jamais appelées, 8 modèles Prisma fantômes ou mortes en lecture, 30+ champs Prisma jamais lus ou jamais écrits, plusieurs feature flags admin (`requireCommentIfKO`, `requirePhotoIfKO`, `requireGeneralComment`) sans implémentation runtime, 13 `confirm()` + 13 `alert()` natifs sans toaster unifié, 2 composants client à 1 000+ lignes, 0 test, 0 migration Prisma versionnée.

Verdict : **3 jours d'effort lèvent les blocants critiques** (bug scope, photos privées, migrations Prisma, branchement syncQueue). **2 sprints** suffisent à industrialiser l'application pour un déploiement à plusieurs équipes en production.

---

## 1. Critiques — Bloquants pour mise en production

### C1. Photos servies publiquement, bypass de l'authentification

- **Description** : `src/proxy.ts:47` ajoute `/uploads/` à la liste de bypass du middleware d'auth. Les photos sont écrites dans `public/uploads/photos/${Date.now()}_${randomBytes(6).toString("hex")}.jpg` (`src/app/api/photos/route.ts:95`). Toute URL connue ou devinée est servie sans cookie ni vérification de scope d'équipe. Les URL apparaissent telles quelles dans les PDF de rapport et dans les vignettes (`<img src="/uploads/...">`).
- **Impact utilisateur** : un opérateur déconnecté, un visiteur, ou un utilisateur d'une autre équipe peut récupérer une photo s'il en obtient l'URL (capture d'écran, partage de PDF).
- **Impact métier** : fuite de données opérationnelles confidentielles (état d'un site, identité de personnes, anomalie sécurité). Bloquant pour un déploiement multi-équipes / multi-établissements. Risque RGPD si des personnes sont identifiables.
- **Difficulté** : 1 jour. Déplacer le dossier hors `public/` (ex. `data/uploads/`), créer une route `GET /api/photos/[id]/file` qui vérifie auth + scope team puis stream le fichier, mettre à jour tous les `<img src>` pour pointer vers cette route, supprimer le bypass `/uploads/` du middleware.
- **Priorité** : **P0**.
- **Recommandation** : implémentation immédiate avant tout déploiement. Profiter du passage pour générer le nom sur 32 octets aléatoires (au lieu de 6) afin d'éviter qu'une fuite de timestamp + brute-force ne suffise à énumérer.

### C2. Bug de comparaison de scope `teamId` pour les utilisateurs multi-équipes

- **Description** : `teamScope(u)` (`src/lib/auth.ts:131`) retourne `{ teamId: { in: [...] } }` pour un utilisateur multi-équipes non-admin. Or trois handlers testent l'égalité directe :
  - `src/app/api/observations/[id]/route.ts:62` : `if ("teamId" in scope && scope.teamId !== obs.procedureObservation.session.teamId)` — comparaison `{in:[...]} !== "team-X"` → **toujours vraie** → 403 systématique.
  - `src/app/api/actions/[id]/validate/route.ts:25` — même bug.
  - Incohérence sur `src/app/api/photos/route.ts:78-87` qui gère le cas `in` correctement.
- **Impact utilisateur** : un USER multi-équipes (cas central du modèle multi-tenant) ne peut pas valider une action ni modifier une observation. Erreur 403 sans explication.
- **Impact métier** : casse fonctionnellement la promesse multi-équipes annoncée dans le schema (`/// "un utilisateur gère une ou plusieurs équipes"`, `schema.prisma:87-100`). Bloque toute la cinématique terrain dès qu'un utilisateur appartient à 2 équipes ou plus.
- **Difficulté** : 0.5 jour. Extraire un helper `assertTeamAccess(u, teamId)` qui gère les 3 formes (`{}`, `{teamId: "__none__"}`, `{teamId: {in: [...]}}`) et l'appliquer dans les 3 endpoints.
- **Priorité** : **P0**.
- **Recommandation** : refactor avec test unitaire couvrant les 3 formes de scope + 3 rôles. Profiter du passage pour ajouter ce helper dans **tous** les endpoints qui font une vérification post-fetch (cf. `src/app/api/photos/[id]/route.ts:28`, `agents/[id]/visibility/route.ts:27`).

### C3. Mode offline câblé mais jamais utilisé

- **Description** : `src/lib/syncQueue.ts` exporte `enqueue`, `replayAll`, `resilientFetch`, `countPending`. **Seule** `countPending` est consommée (par `AppShell.tsx:55` pour afficher le badge « en file »). Aucun composant n'enveloppe ses `fetch` mutants par `resilientFetch`. La promesse PWA / offline (page `/offline`, badge ONLINE/OFFLINE, compteur de file) est en réalité **inerte**.
- **Impact utilisateur** : en intervention hors-couverture (sous-station, local technique, sous-sol), toute saisie échoue silencieusement (`alert("Erreur")`). La promesse "saisie offline" du badge est trompeuse. Le compteur reste à 0.
- **Impact métier** : usage terrain compromis. Risque de perte de données opérationnelles (non-conformité non remontée, validation d'action non enregistrée). Sape la confiance des utilisateurs dans l'outil.
- **Difficulté** : 3-5 jours. Décider entre :
  - (a) Brancher réellement : remplacer `fetch(...)` par `resilientFetch(...)` dans toutes les mutations critiques (SessionClient, VisitClient, AgentActionsClient, NoteModal, photos), envoyer `clientGeneratedId` côté client, ajouter replay automatique à `online`, gérer conflits (PATCH d'une observation déjà modifiée).
  - (b) Retirer la coquille : supprimer badge / page offline / `syncQueue.ts` et assumer une app « online only ».
- **Priorité** : **P0** (décision stratégique requise).
- **Recommandation** : option (a). C'est l'un des arguments de valeur métier les plus différenciants pour un outil terrain.

### C4. Absence de migrations Prisma versionnées

- **Description** : `prisma/migrations/` n'existe pas (vérifié par Glob). Le schéma est appliqué via `prisma db push` (ou les scripts `patch-*.ts` manuels présents à côté). Aucun historique versionné, aucun chemin de rollback.
- **Impact utilisateur** : indirect — risques de panne au déploiement.
- **Impact métier** : interdit le déploiement multi-équipes en environnement régulé. `db push` peut **dropper des colonnes silencieusement** quand le schéma diverge. Pas de reproduction d'environnement possible. Pas d'audit du schéma. Les `patch-*.ts` suggèrent des correctifs manuels en prod — symptôme typique d'absence de migrations.
- **Difficulté** : 0.5 jour. Initialiser un baseline (`prisma migrate dev --name initial`), valider qu'il représente l'état réel (`prisma migrate status`), instaurer la règle "tout changement de schéma = nouvelle migration" en CI.
- **Priorité** : **P0**.
- **Recommandation** : à faire avant tout déploiement. Sans migration, la prochaine évolution risque de corrompre les bases en production.

### C5. Variables CSS fantômes — 4 pages rendues invisibles

- **Description** : `var(--steel)`, `var(--surface)`, `var(--muted)`, `var(--line)`, `var(--muted-2)` sont utilisées dans :
  - `src/app/(app)/sessions/[id]/report/ReportClient.tsx` (l.503, 509, 514, 522, 532, 534, 540, 563, 599)
  - `src/app/admin/procedures/[id]/ProcedureEditClient.tsx` (l.105, 173, 176)
  - `src/app/offline/page.tsx` (l.5, 9)
  - `src/app/not-found.tsx`
  
  Mais le `globals.css` définit `--color-surface`, `--color-text-muted`, `--color-border` (préfixés `--color-`). Les noms ne matchent pas. Résultat : ces blocs rendent **blanc-sur-blanc**, bordures absentes, bouton "Générer PDF" invisible.
- **Impact utilisateur** : l'aperçu du compte-rendu d'une session est illisible (un des deux écrans finaux du parcours veille). Page offline et 404 cassées visuellement.
- **Impact métier** : un agent qui clôture une veille ne voit pas son rapport. Le PDF lui-même est correct (généré via jspdf, pas via CSS), mais la confiance est entamée.
- **Difficulté** : 30 minutes. Soit définir les alias dans `globals.css`, soit refactorer les 4 fichiers vers `--color-*`.
- **Priorité** : **P0**.
- **Recommandation** : ajouter les alias `--steel/--surface/--muted/--line/--muted-2` dans `globals.css` comme premier patch, puis refactorer vers la nomenclature `--color-*` en V2.

### C6. Bouton « Nouvelle procédure » cassé (404)

- **Description** : `src/app/admin/procedures/page.tsx:27` linke vers `/admin/procedures/new`. La route catch-all `[id]/page.tsx` capture `"new"` comme id, `findUnique` ne trouve pas, `notFound()` est appelé.
- **Impact utilisateur** : impossible de créer une procédure depuis l'UI (sauf via import JSON via `/admin/procedures/import`).
- **Impact métier** : la fonctionnalité centrale de paramétrage du référentiel est inaccessible. Seul un admin technique avec accès à `/admin/procedures/import` peut ajouter une procédure.
- **Difficulté** : 0.5 jour. Créer `src/app/admin/procedures/new/page.tsx` qui rend `ProcedureEditClient` en mode création (id vide), ou modifier le lien pour ouvrir une modale de création.
- **Priorité** : **P0**.
- **Recommandation** : prendre l'occasion pour aligner les schémas Zod de `POST` et `PATCH` sur `/api/procedures` — actuellement `POST` n'accepte pas `helpReference`/`helpText` alors que `PATCH` les supporte (cf. C7).

### C7. Tables d'administration coupées sur mobile/tablette

- **Description** : `src/app/admin/users/UsersClient.tsx`, `teams/TeamsClient.tsx`, `agents/AgentsAdminClient.tsx`, `sites/SitesAdminClient.tsx` — tous utilisent `<div className="...rounded-xl overflow-hidden">` puis `<table className="w-full text-sm">` à 7-9 colonnes. **`overflow-hidden` empêche le scroll horizontal** : les colonnes Statut + Actions sont invisibles sur tablette portrait et smartphone.
- **Impact utilisateur** : un manager en déplacement ne peut pas administrer son équipe depuis sa tablette. Aucun indicateur visuel ne signale qu'il manque des colonnes.
- **Impact métier** : limite l'usage admin à un poste fixe. Or les EDITOR sont typiquement des managers terrain (DPX, RSI, COSI).
- **Difficulté** : 1 jour. Remplacer `overflow-hidden` par `overflow-x-auto` partout, ajouter un pattern de transformation en cards empilées sur mobile (`<tr className="block md:table-row">`).
- **Priorité** : **P0** (bloque l'admin terrain).
- **Recommandation** : extraire un composant `<AdminTable>` qui gère le scroll horizontal + le mode card mobile, puis migrer les 5 tables admin existantes.

---

## 2. Majeurs — Importants

### M1. Pas de validation MIME / taille à l'upload de photos

- **Description** : `src/app/api/photos/route.ts:27` accepte tout `instanceof Blob`. Pas de check `file.type`, pas de plafond `byteLength`. L'écriture se fait avant calcul de `byteSize` (l.108).
- **Impact utilisateur** : aucun (utilisation normale).
- **Impact métier** : DoS disque trivial pour un user authentifié — un fichier de plusieurs Go saturera le disque du VPS. Sur SQLite + filesystem partagé, l'app se bloque.
- **Difficulté** : 0.5 jour. Allowlist MIME (`image/jpeg`, `image/png`, `image/webp`), plafond 10 Mo, rejet 415/413.
- **Priorité** : P1.
- **Recommandation** : ajouter aussi `browser-image-compression` déjà présent côté serveur pour normaliser, et alimenter `width/height/byteSize/clientId` qui sont actuellement morts (cf. D2).

### M2. Token cookie sans HMAC ni expiration courte

- **Description** : `src/lib/auth-edge.ts:27` — `encodeToken(userId) = btoa("secret:userId")`. Le secret est encodé dans le token et vérifié par stricte égalité. Pas de signature, pas de timestamp, pas de révocation possible.
- **Impact utilisateur** : aucun (utilisation normale).
- **Impact métier** : si une fuite DB expose un cookie et que le secret est inchangé, le token est rejouable indéfiniment. Une rotation de secret invalide **tous** les utilisateurs à la fois.
- **Difficulté** : 1-2 jours. Refondre vers JWT HS256 court (15 min) + refresh, ou minimalement HMAC(`userId|exp`) avec clé séparée.
- **Priorité** : P1.
- **Recommandation** : transition douce — accepter ancien token en lecture + émettre nouveau format pendant une semaine puis rejeter l'ancien.

### M3. Pas de rate-limit sur `/api/auth/login`

- **Description** : `src/app/api/auth/login/route.ts` traite chaque POST sans throttle.
- **Impact utilisateur** : aucun.
- **Impact métier** : brute-force triviale. Sur SQLite single-writer, un attaquant peut aussi saturer la DB.
- **Difficulté** : 0.5 jour. Compteur en mémoire + back-off exponentiel par IP + email, plus alerte au-delà de N échecs.
- **Priorité** : P1.
- **Recommandation** : journaliser les tentatives échouées dans `AuditLog` (action `LOGIN_FAILED`) — actuellement seul `LOGIN` réussi est tracé.

### M4. `EDITOR` accède à des pages où toutes les actions retournent 403

- **Description** : `src/app/admin/layout.tsx` autorise ADMIN **et** EDITOR. Mais les routes `/api/admin/users`, `/api/admin/teams/*`, `/api/admin/agents/[id]` exigent strictement ADMIN. Un EDITOR voit donc la page, clique sur les boutons et reçoit 403 silencieux.
- **Impact utilisateur** : EDITOR perd confiance dans l'outil (« ça marche pas »). Pas de message explicite.
- **Impact métier** : casse l'attribution claire des rôles. Soit la page doit cacher les actions, soit les routes doivent ouvrir EDITOR.
- **Difficulté** : 1 jour. Choisir la sémantique souhaitée (probablement : EDITOR voit en lecture, n'a pas les boutons d'édition), passer un prop `canEdit` aux client components, conditionner les boutons.
- **Priorité** : P1.
- **Recommandation** : profiter du refactor pour normaliser la sémantique EDITOR sur **toutes** les pages admin (procédures et sites ouverts à EDITOR, users/teams/agents ADMIN-only — décision PO).

### M5. 4 pages absentes du menu mobile (Contacts critique en terrain)

- **Description** : `NAV_MOBILE` (`AppShell.tsx:13-19`) liste 5 entrées. `NAV_DESKTOP` en liste 9. Absentes en mobile : **Sessions**, **Statistiques**, **Liens utiles**, **Contacts**.
- **Impact utilisateur** : un agent en intervention ne peut pas appeler un contact d'astreinte depuis son smartphone (l'usage le plus typique du carnet de contacts). Les sessions en cours ne sont récupérables qu'en passant par la fiche agent. Les liens utiles (PDF, intranet, SIRH) sont inatteignables en terrain.
- **Impact métier** : la principale promesse "mobile-first terrain" est trahie.
- **Difficulté** : 0.5 jour. Remplacer une entrée moins prioritaire (« Histo. » ?) par un menu « ⋯ Plus » qui ouvre un drawer avec Sessions / Stats / Liens / Contacts / Historique.
- **Priorité** : P1.
- **Recommandation** : drawer pleine page (pattern Material « bottom sheet ») avec recherche rapide intégrée.

### M6. Rapports finalisés non rouvrables depuis l'UI

- **Description** : `/sessions/[id]/report` et `/visits/[id]/report` ne sont atteignables que par `router.push` après finalisation. Aucune liste (`SessionsListClient`, `VisitsListClient`) ne propose un bouton « Voir le rapport ».
- **Impact utilisateur** : pour consulter un PDF déjà émis, l'utilisateur doit retrouver l'URL ou attendre une nouvelle finalisation.
- **Impact métier** : friction sur la traçabilité réglementaire. Un manager qui veut vérifier un rapport doit demander à l'auteur.
- **Difficulté** : 0.5 jour. Ajouter un bouton dans les cartes session/visite avec statut `completed`.
- **Priorité** : P1.
- **Recommandation** : profiter pour persister les PDF générés dans `Report` / `SiteVisitReport` (tables déjà définies mais mortes) — historique des exports utile pour audit.

### M7. Cibles tactiles sous le seuil iOS (44 px)

- **Description** : nombreux boutons d'action critiques en `text-[10px]`/`text-[11px]` + `py-0.5`/`py-1` → cible ≈ 22-26 px haut. Concernés :
  - Boutons « Archiver / Trash » sur listes session/visite (`SessionsListClient.tsx:108`, `VisitsListClient.tsx:158`)
  - Boutons de statut Conforme/Non conforme dans `SessionClient.tsx:493` et `VisitClient.tsx:464`
  - Bouton Icare dans `HistoryClient.tsx:468`
  - Filtres gravité dans `ProceduresClient.tsx:137`
- **Impact utilisateur** : précision exigée du doigt, taux d'erreur élevé surtout avec gants.
- **Impact métier** : ralentit la saisie terrain, source d'erreurs (mauvais statut sélectionné).
- **Difficulté** : 1 jour. Revue Tailwind systématique : passer à minimum `text-xs` + `py-1.5` + pictogramme.
- **Priorité** : P1.
- **Recommandation** : définir un composant `<TouchButton size="sm|md">` qui garantit ≥40 px de cible touch.

### M8. Modales sans `max-h` + scroll interne — boutons cachés par le clavier mobile

- **Description** : les modales `ValidateModal`, `ManualActionModal`, `SightingModal`, `NoteModal`, `TeamPicker` n'ont pas de `max-h-[85vh] overflow-y-auto`. Quand le clavier mobile s'ouvre (saisie d'un commentaire de validation), le footer « Annuler / Confirmer » sort de l'écran.
- **Impact utilisateur** : l'utilisateur ne peut pas valider une action depuis son smartphone si le clavier s'ouvre. Doit fermer le clavier d'abord, perdre la saisie, etc.
- **Impact métier** : friction sur le geste métier le plus fréquent (valider une action).
- **Difficulté** : 0.5 jour. Ajouter `max-h-[85vh] overflow-y-auto` + footer sticky sur chaque modale.
- **Priorité** : P1.
- **Recommandation** : extraire un composant `<Modal>` réutilisable.

### M9. N+1 dans la génération de NC d'inventaire à la clôture d'une visite

- **Description** : `generateInventoryNonConformities` (`api/visits/[id]/route.ts:149-207`) — boucle séquentielle qui pour chaque observation en écart fait `findFirst` puis `$transaction([create action, create NC])`. Avec 50 équipements, 100+ round-trips SQLite séquentiels.
- **Impact utilisateur** : la clôture d'une visite INVENTORY prend plusieurs secondes — l'agent reste sur un écran en attente.
- **Impact métier** : effet de loupe avec la croissance du catalogue d'équipements par site.
- **Difficulté** : 0.5 jour. Un seul `findMany` puis un seul `$transaction` avec `createMany` actions + `createMany` NCs.
- **Priorité** : P1.
- **Recommandation** : test de non-régression sur l'idempotence (replay de clôture).

### M10. Import CSV pointages : 5 000 INSERT séquentiels

- **Description** : `api/admin/imports/pointages/route.ts:158-290` — boucle `await prisma.agentSighting.create(...)` ligne par ligne. ~30 s pour un fichier de 5 000 lignes.
- **Impact utilisateur** : import lent en admin.
- **Impact métier** : occupation longue du writer SQLite — bloque les utilisateurs concurrents pendant la durée de l'import.
- **Difficulté** : 0.5 jour. Pré-fetch des refs déjà fait correctement, refactorer en `createMany` batchés.
- **Priorité** : P1.
- **Recommandation** : ajouter une UI de progression côté admin.

### M11. AuditLog quasi inerte

- **Description** : la table `AuditLog` est dotée d'une structure complète (action, entity, entityId, details JSON, userId). **Une seule** écriture dans tout le code : `LOGIN` (`api/auth/login/route.ts:35`). Aucune création/modification/suppression sensible n'est tracée (users, teams, sites, agents, actions, validations, photos, imports).
- **Impact utilisateur** : aucun.
- **Impact métier** : non-conformité auditeur. Aucune traçabilité de qui a supprimé quoi, qui a changé un rôle, qui a importé quel fichier. Bloque la certification ou audit interne.
- **Difficulté** : 1-2 jours. Helper `logAudit(action, entity, entityId, before, after)`. Appel systématique sur les routes mutantes sensibles.
- **Priorité** : P1.
- **Recommandation** : prévoir une page `/admin/audit` (filtres action / entité / utilisateur / date). Politique de purge (≥1 an de rétention).

### M12. Fallback team arbitraire pour les multi-équipes

- **Description** : plusieurs endpoints (ex. `api/visits/route.ts:89`, `api/agents/[id]/sight/route.ts:54`) utilisent `teamId = u.teamId ?? u.teamIds[0]` quand le contexte est ambigu. Un utilisateur multi-équipes peut donc créer une donnée dans la mauvaise équipe sans s'en rendre compte.
- **Impact utilisateur** : un manager qui visite un site relevant de son équipe B pendant qu'il est connecté à son équipe A par défaut va voir sa visite créée pour A.
- **Impact métier** : pollution des statistiques par équipe, NC mal attribuées.
- **Difficulté** : 1 jour. Ajouter un sélecteur d'équipe actif dans le AppShell (déjà la table `UserTeam` existe avec `role MANAGER`). Forcer `?teamId=` ou erreur 400.
- **Priorité** : P1.
- **Recommandation** : composant `<TeamSwitcher>` dans le sidebar, persistance dans le cookie.

### M13. Filtres `<select>` natifs ingérables avec 500+ agents

- **Description** : `/history` et `/stats` proposent des filtres Agent/Site comme `<select>` natifs HTML qui listent **tous** les agents et sites (`HistoryClient.tsx:294`, `StatsClient.tsx:295`). Avec un référentiel de plusieurs centaines d'agents, inutilisable.
- **Impact utilisateur** : impossible de filtrer en pratique.
- **Impact métier** : feature stats / historique sous-exploitée.
- **Difficulté** : 0.5 jour. Le composant `AgentAutocomplete` existe déjà — l'utiliser ici. `SiteAutocomplete` à créer sur le même patron.
- **Priorité** : P1.
- **Recommandation** : profiter pour mémoriser les derniers filtres utilisés par utilisateur (localStorage).

### M14. Champs `requireCommentIfKO`, `requirePhotoIfKO`, `requireGeneralComment` non implémentés runtime

- **Description** : ces champs sont éditables en admin (`ProcedureEditClient.tsx`), persistés en DB, mais **aucun code côté session ne les vérifie** (`SessionClient.tsx:173-181` ne lit pas `procedure.requireGeneralComment` à la clôture).
- **Impact utilisateur** : l'agent peut saisir un NON_CONFORME sans commentaire ni photo alors que la procédure l'exige.
- **Impact métier** : feature flag mort — règle métier non appliquée. Données dégradées.
- **Difficulté** : 1 jour. Ajouter la validation côté serveur (PATCH observation et PATCH session/finish) + feedback UI.
- **Priorité** : P1.
- **Recommandation** : remonter explicitement les violations au moment de la clôture (« 3 observations sans commentaire requis »).

### M15. `User.viewAllTeams` non toggleable par l'utilisateur

- **Description** : la spec dit *« Permet à un USER d'utiliser temporairement la vue cross-équipe »* (`schema.prisma:25`). Mais seul un ADMIN peut toggler le champ via `/admin/users`. Aucun toggle dans la barre utilisateur. Donc fonctionnellement détourné.
- **Impact utilisateur** : un manager USER ne peut pas basculer entre vue équipe / vue cross-équipe à la volée.
- **Impact métier** : détourne `viewAllTeams` en privilège ADMIN, alors qu'il était prévu pour les managers terrain.
- **Difficulté** : 0.5 jour. Toggle dans le sidebar utilisateur. Route `PATCH /api/auth/me/preferences` (ou réutiliser `/api/auth/me` qui est actuellement orpheline).
- **Priorité** : P1.
- **Recommandation** : le couplant avec `<TeamSwitcher>` (M12) : si « Toutes les équipes » sélectionné, ne pas demander de teamId à la création.

### M16. Création d'agents impossible hors import Excel

- **Description** : `/admin/agents` n'a pas de bouton « + Nouvel agent ». Le PATCH ne supporte que `isVisible` + équipes — pas matricule/nom/prénom/poste/secteur.
- **Impact utilisateur** : un EDITOR ne peut pas ajouter un agent ponctuel (nouveau venu, prestataire) sans re-jouer un import Excel complet.
- **Impact métier** : friction sur les flux RH ponctuels.
- **Difficulté** : 1 jour. Modale de création + extension du PATCH.
- **Priorité** : P1.
- **Recommandation** : intégrer la création d'agent dans le flux import via une étape "ajouter manuellement" (l'API est presque toute là).

### M17. Sightings (Vus / Notes) append-only

- **Description** : `POST /api/agents/[id]/sight` et `POST /api/sites/[id]/sight` créent des `AgentSighting` / `SiteSighting`. **Aucun PATCH, aucun DELETE**.
- **Impact utilisateur** : impossible de corriger une note erronée ou de supprimer un vu mal placé.
- **Impact métier** : pollution de l'historique. Pas de respect du droit de rectification (RGPD).
- **Difficulté** : 0.5 jour. PATCH (auteur ou ADMIN) + DELETE (ADMIN).
- **Priorité** : P1.
- **Recommandation** : tracer la modification dans AuditLog (cf. M11).

### M18. Tile « Sessions » du dashboard admin sort de la zone admin

- **Description** : `src/app/admin/page.tsx:31` — la tile « Sessions » pointe vers `/sessions` (page utilisateur), pas vers une vue admin dédiée. Crée un saut de contexte (l'admin perd son sidebar).
- **Impact utilisateur** : confusion sur la navigation.
- **Impact métier** : visibilité réduite sur les sessions en cours par équipe.
- **Difficulté** : 1 jour. Créer une page `/admin/sessions` (toutes équipes pour ADMIN, scopées EDITOR) — ou retirer la tile et la remplacer par un lien moins prominent.
- **Priorité** : P2.
- **Recommandation** : profiter du refactor pour aligner le dashboard avec la sidebar (Agents/Sites/Templates/Liens/Contacts manquent en tiles).

### M19. Templates de visite : 100 % read-only

- **Description** : `/admin/visit-templates` est une page de consultation. **Aucun endpoint** `POST/PATCH/DELETE` sur `SiteVisitTemplate`, `SiteVisitSection`, `SiteVisitItem`. Le commentaire de la page précise « l'édition viendra dans une version ultérieure ».
- **Impact utilisateur** : impossible d'ajouter une nouvelle grille de visite ou de modifier une grille existante sans intervention DB.
- **Impact métier** : empêche l'évolution opérationnelle du référentiel par les EDITOR/ADMIN métier.
- **Difficulté** : 3-5 jours. CRUD complet sur les 3 entités + UI d'édition. Réutiliser la mécanique de `ProcedureEditClient`.
- **Priorité** : P2 (P1 si une nouvelle grille de visite est attendue dans le déploiement multi-équipes).
- **Recommandation** : commencer par exposer la duplication d'un template existant (`POST /api/visit-templates/:id/duplicate`) — plus simple et débloque 80 % des cas.

### M20. Conflit z-index header sticky / top-bar mobile

- **Description** : `VisitClient.tsx:219` et `SessionClient.tsx` posent un `sticky top-0 z-20`. Or `AppShell.tsx:168` a `sticky top-0 z-30`. Le top-bar mobile masque le header de page (« ← retour »).
- **Impact utilisateur** : sur mobile, certains contrôles de page sont chevauchés.
- **Impact métier** : ergonomie dégradée sur smartphone — perte de confiance.
- **Difficulté** : 0.5 jour. Décaler le header de page sous le top-bar (`top: 56px` ou `z-30` + offset).
- **Priorité** : P2.

### M21. Composants client à 1000+ lignes (perf et maintenabilité)

- **Description** :
  - `VisitReportClient.tsx` : 1 381 lignes (PDF visite)
  - `StatsClient.tsx` : 1 030 lignes (5 onglets, 5 useEffect indépendants)
  - `VisitClient.tsx` : 777 lignes
  - `ReportClient.tsx` : 639 lignes
- **Impact utilisateur** : surcoût bundle (les chunks pages sont gros), TTI dégradé sur mobile bas de gamme.
- **Impact métier** : maintenance coûteuse — un bug dans l'un de ces fichiers exige une compréhension globale.
- **Difficulté** : 3-5 jours. Découper par responsabilité (toolbar / preview / pdf-builder), passer en server components quand possible.
- **Priorité** : P2.
- **Recommandation** : `StatsClient` est le meilleur candidat — séparer en 5 onglets distincts dans `src/app/(app)/stats/(tabs)/`.

### M22. Pas de tests

- **Description** : aucun framework (Jest, Vitest, Playwright), aucun fichier `*.test.*`, pas de script `test` dans `package.json`.
- **Impact utilisateur** : indirect — risque de régressions silencieuses.
- **Impact métier** : élevé pour une app gérant auth, multi-tenant, import xlsx complexe, génération automatique d'actions.
- **Difficulté** : 2-3 jours pour un socle de tests. 
  - Vitest + tests unitaires des helpers (`auth.ts:teamScope/agentScope/siteScope/actionScope`, `tags.ts`, `pdfFilename.ts`, `auth-edge.ts`).
  - Playwright pour le flow login → démarrage veille → validation → clôture.
- **Priorité** : P2.

### M23. Pas de backup automatique SQLite

- **Description** : pas de cron, pas de `VACUUM INTO`, pas d'export documenté.
- **Impact utilisateur** : aucun (jusqu'au crash disque).
- **Impact métier** : risque de perte définitive de données opérationnelles + historique d'actions.
- **Difficulté** : 0.5 jour. Script `VACUUM INTO 'backup-YYYYMMDD.db'` quotidien + retention 30 jours, rsync vers stockage distant.
- **Priorité** : P1.
- **Recommandation** : avant tout, tester la procédure de restauration sur un environnement séparé.

### M24. Photos sans `next/image` ni `loading="lazy"`

- **Description** : tous les `<img>` (vignettes agent / site / visite) sont en HTML brut sans `loading="lazy"`, sans `srcset`. Sur une fiche agent avec 30 vignettes, 30 requêtes parallèles à l'ouverture.
- **Impact utilisateur** : ouverture lente sur connexion 4G.
- **Impact métier** : moindre.
- **Difficulté** : 1 jour. Adopter `next/image` ou minimalement `loading="lazy" decoding="async"`.
- **Priorité** : P2.

### M25. Filtres de dates de `/history` débordent horizontalement sur mobile

- **Description** : `HistoryClient.tsx:247` — bloc « Du / au » non `flex-wrap`, ~340 px de large. Overflow horizontal sur mobile portrait.
- **Impact utilisateur** : filtres inutilisables en terrain.
- **Difficulté** : 30 minutes. `flex-wrap` + `w-full` sur les inputs.
- **Priorité** : P2.

---

## 3. Mineurs — Améliorations de confort

### m1. Confusion lexicale "Veille"

- **Description** : le mot « Veille » désigne au moins 4 concepts (catalogue, session en cours, type de visite INVENTORY, marque produit). « Visite » et « Veille de site » désignent la même chose. « Observateur » / « Créateur » / « Auteur » désignent le même rôle.
- **Difficulté** : 1-2 jours.
- **Priorité** : P3.
- **Recommandation** : choisir un terme cible par concept et le diffuser :
  - `/procedures` → **Catalogue** ou **Procédures**
  - `/sessions` → **Mes veilles** (la vraie veille = la sortie terrain)
  - Visite INVENTORY → **Inventaire** ou **Inspection inventaire** (pas « Veille de site »)
  - User auteur → **Observateur** partout (pas « Créateur »)

### m2. Statuts en anglais affichés tels quels

- **Description** : `active`, `completed`, `draft`, `archived` apparaissent en majuscules dans l'UI (`{status.toUpperCase()}`). Ailleurs des libellés français existent.
- **Difficulté** : 0.5 jour.
- **Priorité** : P3.
- **Recommandation** : helper `formatStatus(s)` qui mappe en français.

### m3. `ONLINE / OFFLINE` vs `EN LIGNE / HORS LIGNE`

- **Description** : `AppShell.tsx:187` mobile vs `:136` desktop.
- **Difficulté** : 5 minutes.

### m4. Icônes ambiguës

- **Description** : `Icon.ClipboardCheck` pour Veilles ET Sessions. `Icon.Building` pour Sites ET Équipes. `Icon.FileText` pour Visites ET Sessions admin.
- **Difficulté** : 0.5 jour.
- **Recommandation** : tableau d'attribution d'icônes (un concept = une icône).

### m5. `<style jsx>` avec `:global(.input)` dans `UsersClient.tsx`

- **Description** : surcharge la classe globale `.input` depuis un composant.
- **Difficulté** : 30 minutes.
- **Recommandation** : déplacer dans `globals.css`.

### m6. Site Code non éditable

- **Description** : `SitesAdminClient` ne propose pas le champ Code en édition (le POST le supporte, le PATCH également).
- **Difficulté** : 30 minutes.

### m7. `UserTeam.role` (MEMBER / MANAGER) non assignable

- **Description** : le champ existe en DB mais aucune UI ne permet d'assigner un MANAGER d'équipe.
- **Difficulté** : 1 jour.
- **Recommandation** : intégrer dans `/admin/teams/[id]` (case à cocher par membre).

### m8. Création d'utilisateurs « import » en silence

- **Description** : l'import pointages CSV crée des `User` avec email `@import.local` et mot de passe aléatoire jamais communiqué.
- **Difficulté** : 0.5 jour.
- **Recommandation** : marquer ces comptes comme `isActive=false` par défaut, alerter l'admin sur le rapport d'import.

### m9. Validation `?mode=hard|soft` non stricte

- **Description** : `api/sessions/[id]/route.ts:127` : `mode = url.searchParams.get("mode") ?? "soft"` puis branchement sur `hard` — tout autre valeur tombe en soft sans 400.
- **Difficulté** : 30 minutes.

### m10. Lien « Admin → Sites » visible aux USER

- **Description** : `/sites/page.tsx` affiche un lien admin sans guard de rôle (le layout admin le bloquera ensuite).
- **Difficulté** : 5 minutes.

### m11. Dossier vide `src/app/(auth)/`

- **Description** : à supprimer.
- **Difficulté** : 1 minute.

### m12. Boutons « Modifier » et « Trash » à `text-[10px]` 

- **Description** : voir M7. À grouper.

### m13. `<Link href={\`hover:${palette.ring}\`}>` non purgé par Tailwind

- **Description** : `LinksListClient.tsx:256` — interpolation dynamique non détectée par le JIT, classes invalides.
- **Difficulté** : 30 minutes.

### m14. Pas d'`inputMode` ni `autoCapitalize` sur les inputs métier (matricules, codes)

- **Description** : clavier alphabétique systématique sur mobile.
- **Difficulté** : 1 heure.

### m15. Compteur "affichées / sélectionnées" masqué sur mobile

- **Description** : `ProceduresClient.tsx:111` — `hidden md:flex`. Acceptable (relais par la barre flottante) mais signale une dette d'ergonomie.

### m16. `hidden md:flex` sur des coordonnées dans `/admin/contacts`

- **Description** : sur mobile, l'admin ne voit pas les coordonnées sans cliquer « Modifier ».
- **Difficulté** : 30 minutes.

### m17. Imports répétés dans le projet (utilitaires non extraits)

- **Description** : `initialsOf`, `slug`, `normalize`, `paletteFor`, `parseFrenchDate`, `formatDateFR`, `freshness` dupliqués entre 2-13 fichiers.
- **Difficulté** : 1 jour.
- **Recommandation** : `src/lib/strings.ts`, `src/lib/dates.ts`.

### m18. `STATUS` array dupliqué 6 fois

- **Description** : 5-entry mapping (CONFORME, NON_CONFORME, A_REVOIR, NA, NON_OBSERVE) avec classes Tailwind redéfini dans 6 fichiers.
- **Difficulté** : 0.5 jour.
- **Recommandation** : `src/lib/statuses.ts`.

### m19. `Stat({label,value,tone})` redéfini 6 fois

- **Description** : `agents/[id]`, `sites/[id]`, `SiteEquipmentsClient`, `PointagesImport`, `ImportClient`, `ImportExportToolbar`.
- **Difficulté** : 30 minutes.

### m20. Pattern `requireUser → try/catch` répété sur 40 routes

- **Description** : `requireUser` jette une `Response`, anti-pattern. 
- **Difficulté** : 1 jour.
- **Recommandation** : helper `withAuth(handler)` qui wrap.

### m21. `dedupHash` calculé selon 4 signatures différentes

- **Description** : 4 endpoints reconstruisent le hash de dédup d'action de façon non identique.
- **Difficulté** : 1 jour.
- **Recommandation** : `src/lib/dedupHash.ts` unique.

### m22. Pages détail agents et sites à 80 % dupliquées

- **Description** : `agents/[id]/page.tsx` 357 lignes et `sites/[id]/page.tsx` 335 lignes presque identiques (header, 3 stats, sections actions / validations / vu).
- **Difficulté** : 1 jour.
- **Recommandation** : composant `<EntityDetailLayout>` paramétré.

### m23. `*ListClient.tsx` répété sur 4 entités

- **Description** : ~250 lignes de duplication entre agents / sites / sessions / visits.
- **Difficulté** : 1-2 jours.
- **Recommandation** : composant générique `<EntityList<T>>`.

### m24. Cascade de validations côté client par fetch séquentiel

- **Description** : `AgentActionsClient.tsx:80-91` — `for (const aid of ids) { await fetch(...) }` — 10 round-trips pour valider un groupe de 10.
- **Difficulté** : 0.5 jour.
- **Recommandation** : endpoint batch `/api/actions/batch-validate`.

### m25. Confirmations / alertes natives non unifiées

- **Description** : 13 `confirm()` + 13 `alert()` natifs aux textes incohérents.
- **Difficulté** : 1-2 jours.
- **Recommandation** : adopter `sonner` (déjà dans l'écosystème React 19) + composant `<ConfirmDialog>`.

### m26. Sites/Procedures servis en SSR et via API GET dupliquée

- **Description** : `GET /api/visit-templates` et `GET /api/procedures` ne sont jamais appelés côté client (chargement SSR). Soit supprimer, soit migrer côté client.
- **Difficulté** : 30 minutes (suppression).

### m27. Pas de pagination sur agents / sites / sessions / visits

- **Description** : `findMany({ take: 100 })` ou pas de `take`. Inutilisable au-delà.
- **Difficulté** : 1-2 jours.
- **Recommandation** : cursor-based avec `useInfiniteQuery` ou pagination simple.

### m28. Inconsistance ADMIN vs ADMIN+EDITOR

- **Description** : `api/admin/agents/[id]` exige ADMIN strict, `api/admin/sites/[id]` accepte EDITOR. Pas de doc.
- **Difficulté** : 0.5 jour.
- **Recommandation** : convention documentée + cohérence.

### m29. PATCH/DELETE photo orphelins

- **Description** : `api/photos/[id]` PATCH/DELETE non appelés. Aucune UI pour éditer une légende ou supprimer une photo.
- **Difficulté** : 0.5 jour pour livrer l'UI, ou 5 minutes pour supprimer les endpoints.

### m30. PATCH/DELETE action et annulation de validation orphelins

- **Description** : `api/actions/[id]` PATCH/DELETE et `api/actions/validations/[id]` PATCH/DELETE non appelés. Code de retour `/// Réservé ADMIN/EDITOR` suggère UI prévue mais non livrée.
- **Difficulté** : 1 jour pour livrer l'UI d'annulation.

---

## 4. Opportunités — Évolutions recommandées (vue Product Owner senior)

### 4.1 Quick wins (forte valeur, faible effort)

#### O-QW1. Toaster unifié + composant ConfirmDialog
- **Valeur** : feedback uniforme, perception "qualité de l'outil".
- **Effort** : 1-2 jours.
- **Bénéfice métier** : élimine 26 `alert/confirm` natifs. Réduit le stress utilisateur.

#### O-QW2. Bouton « Voir le rapport » dans les listes sessions / visites
- **Valeur** : élimine un cas de "page invisible".
- **Effort** : 0.5 jour.

#### O-QW3. Drawer mobile "Plus" pour Sessions / Stats / Liens / Contacts
- **Valeur** : restitue 4 fonctions invisibles en mobile, dont Contacts (critique terrain).
- **Effort** : 0.5 jour.

#### O-QW4. Persister le compte rendu PDF (`Report` / `SiteVisitReport`)
- **Valeur** : traçabilité réglementaire des exports.
- **Effort** : 0.5 jour (modèles existent déjà).
- **Bénéfice métier** : auditabilité, débat « quel rapport a été envoyé à qui ».

#### O-QW5. Sélecteur d'équipe actif `<TeamSwitcher>` dans le sidebar
- **Valeur** : élimine les ambiguïtés multi-équipes (M12).
- **Effort** : 1 jour.

#### O-QW6. Toggle `viewAllTeams` par l'utilisateur lui-même
- **Valeur** : libère les managers terrain (M15).
- **Effort** : 0.5 jour.

#### O-QW7. AuditLog systématique sur 10 actions sensibles
- **Valeur** : conformité auditeur, dispute avec utilisateurs (« je n'ai pas fait ça »).
- **Effort** : 1-2 jours.

#### O-QW8. Endpoint batch `/api/actions/batch-validate`
- **Valeur** : valide un groupe de doublons en 1 round-trip au lieu de N.
- **Effort** : 0.5 jour.

#### O-QW9. Renommer les libellés pour lever la confusion lexicale
- **Valeur** : réduction de la friction onboarding nouveaux utilisateurs.
- **Effort** : 0.5 jour (recherche/remplace globale + relecture).

### 4.2 Évolutions moyennes (UX significative)

#### O-M1. CRUD complet des templates de visite
- **Valeur** : autonomie métier sur l'évolution du référentiel (M19).
- **Effort** : 3-5 jours.

#### O-M2. UI d'annulation de validation + édition d'action
- **Valeur** : élimine un cas où l'utilisateur peut "se planter" sans recours (m30).
- **Effort** : 1-2 jours.

#### O-M3. Création manuelle d'agent (sans Excel)
- **Valeur** : flux RH ponctuel (M16).
- **Effort** : 1 jour.

#### O-M4. Page "Mes archives" avec restauration
- **Valeur** : reverse-find pour les utilisateurs (« j'ai archivé par erreur »).
- **Effort** : 1 jour.

#### O-M5. Vue admin des sessions et visites (avec filtres équipe)
- **Valeur** : tableau de bord managérial centralisé.
- **Effort** : 2 jours.

#### O-M6. Notifications utilisateur (actions en retard, NC ouvertes, équipements à renouveler)
- **Valeur** : passage en mode "push" — l'app va vers l'utilisateur.
- **Effort** : 3-5 jours (push web ou centre de notifications in-app).

#### O-M7. Historique d'observation (`ObservationHistory`) visible
- **Valeur** : table déjà alimentée, jamais lue. Tracer « qui a modifié quoi ».
- **Effort** : 1 jour.

#### O-M8. Branchement réel `resilientFetch` sur 6 mutations critiques (cf. C3)
- **Valeur** : promesse offline tenue.
- **Effort** : 3-5 jours.

#### O-M9. Pages détail unifiées (composant `<EntityDetailLayout>`)
- **Valeur** : maintenance réduite, cohérence visuelle.
- **Effort** : 2-3 jours.

#### O-M10. Filtres recherchables (`AgentAutocomplete` / `SiteAutocomplete`) dans `/history` et `/stats`
- **Valeur** : usage stats réellement possible (M13).
- **Effort** : 0.5 jour.

#### O-M11. Refonte tables admin → cards empilées sur mobile + scroll horizontal sur tablette
- **Valeur** : administration possible depuis tablette/smartphone (C7 + bonus).
- **Effort** : 2-3 jours.

#### O-M12. Validation runtime des règles métier procédure (commentaire/photo obligatoires)
- **Valeur** : feature payée non livrée (M14).
- **Effort** : 1 jour.

### 4.3 Évolutions structurantes (déploiement multi-équipes / multi-sites)

#### O-S1. Migration SQLite → PostgreSQL
- **Valeur** : permet déploiement multi-process, concurrent writers, cluster.
- **Effort** : 5-8 jours.
- **Justification** : SQLite single-writer bloque les utilisateurs concurrents pendant un import Excel (~5 s pour 17 000 lignes selon le commentaire de `actionImport.ts`). Au-delà de ~50 utilisateurs simultanés, devient un goulot.

#### O-S2. Hierarchie organisationnelle (Établissement → Unité → Équipe)
- **Valeur** : reflète l'organisation réelle (déjà partiellement modélisée dans `ImportedAction.establishment/unit/secteur` mais non exploitée).
- **Effort** : 5-10 jours.
- **Bénéfice** : agrégation stats par établissement, droit de regard hiérarchique (manager d'unité voit toutes les équipes de son unité).

#### O-S3. Rôles plus fins (ADMIN_SYSTEME, ADMIN_REFERENTIEL, MANAGER_EQUIPE, MANAGER_SITE, USER)
- **Valeur** : sépare l'admin technique de l'admin métier. Délégation possible.
- **Effort** : 3-5 jours.
- **Justification** : actuellement EDITOR voit tout l'admin avec des 403 mélangés. Une séparation claire libère cette ambiguïté (M4).

#### O-S4. SSO / OIDC (Microsoft / Keycloak)
- **Valeur** : intégration SI entreprise, plus de mot de passe à gérer.
- **Effort** : 5-8 jours.
- **Bénéfice** : provisionnement automatique des utilisateurs, déprovisionnement à la sortie.

#### O-S5. Centre de notifications (badge + page dédiée)
- **Valeur** : remontée pro-active des items à traiter (actions en retard, équipements à renouveler, visites attendues, NC non clôturées).
- **Effort** : 5-8 jours.

#### O-S6. Workflow d'approbation des rapports
- **Valeur** : un rapport visite/session devient « brouillon → vérifié → publié → diffusé ». Trace de qui a validé quoi.
- **Effort** : 5-8 jours.

#### O-S7. Tableau de bord conformité par site / équipe (cron + alerte)
- **Valeur** : exploite `SiteVisitTemplate.expectedFrequencyDays` (jamais utilisé). Identifie les visites en retard.
- **Effort** : 3-5 jours.

#### O-S8. API publique / Webhooks pour intégration SI
- **Valeur** : connecter Veille à un GMAO, un SIRH, un ERP.
- **Effort** : 5-10 jours.

#### O-S9. Multi-langue
- **Valeur** : déploiement multi-pays si pertinent (filiales).
- **Effort** : 3-5 jours.

#### O-S10. Plan de tests + CI/CD
- **Valeur** : sécurise les déploiements futurs.
- **Effort** : 3-5 jours (socle Vitest + Playwright + GitHub Actions).

#### O-S11. Observabilité (Sentry + logs structurés + healthchecks)
- **Valeur** : voir les bugs avant que les utilisateurs ne les reportent.
- **Effort** : 1-2 jours.

#### O-S12. Backup automatisé + plan de reprise
- **Valeur** : continuité d'activité (M23).
- **Effort** : 1 jour.

### 4.4 Évolutions innovantes (non demandées, forte valeur métier)

#### O-I1. Vidéo / annotations sur photos
- **Description** : annoter directement sur une photo (cercle rouge sur défaut, flèche, légende positionnée). Utile pour expliciter une NC.
- **Valeur** : qualité du rapport métier.
- **Effort** : 5 jours.

#### ~~O-I2. Reconnaissance vocale → commentaire~~ — ⛔ ABANDONNÉE DÉFINITIVEMENT (PO 2026-06-14)

> Toute fonctionnalité audio / dictée / vocale est abandonnée définitivement. Voir [memory/business-rules.md](memory/business-rules.md) §Audio. Section conservée à titre historique.

~~- **Description** : sur le terrain (mains occupées, gants), parler plutôt que taper.~~
~~- **Valeur** : drastiquement plus rapide.~~
~~- **Effort** : 3 jours (Web Speech API native, déjà supportée par les navigateurs modernes).~~

#### O-I3. Scan QR code site → ouverture directe `/sites/[id]`
- **Description** : QR code apposé sur le poste d'aiguillage / gare. Scan = ouverture de la fiche, démarrage d'une visite.
- **Valeur** : élimine la recherche de site, garantit l'identification.
- **Effort** : 2-3 jours.

#### O-I4. Détection automatique d'équipement par photo (LLM vision)
- **Description** : prise de photo d'un extincteur → reconnaissance type + date de péremption (OCR du libellé) → préfill observation INVENTORY.
- **Valeur** : énorme sur la fréquence des inventaires.
- **Effort** : 5-10 jours (selon LLM choisi : Claude vision, ou Gemini).

#### O-I5. Suggestions intelligentes basées sur l'historique
- **Description** : "Cette procédure a été le plus souvent NON_CONFORME sur le point 'Affichage signalisation' sur ce poste — y prêter attention".
- **Valeur** : transforme l'outil de saisie en outil d'aide à la décision.
- **Effort** : 3-5 jours.

#### O-I6. Mode "binôme" — deux utilisateurs sur la même visite
- **Description** : un observateur dicte, un autre saisit. Sync temps réel via WebSocket.
- **Valeur** : reflète la réalité terrain (les visites se font souvent à 2).
- **Effort** : 8-10 jours.

#### O-I7. Plan interactif d'un site avec localisation des équipements
- **Description** : upload du plan, drag & drop des SiteEquipment dessus, parcours guidé pendant la visite.
- **Valeur** : réduit les oublis, parcours optimisé.
- **Effort** : 5-8 jours.

#### O-I8. Comparaison de plusieurs visites du même site
- **Description** : timeline visuelle "ce qui était NC il y a 3 mois est-il toujours NC ?".
- **Valeur** : pilotage de l'amélioration continue.
- **Effort** : 3-5 jours.

#### O-I9. Génération automatique du plan d'action depuis les NC
- **Description** : à la clôture d'une visite, agréger toutes les NC par responsable et envoyer un email de plan d'action personnalisé.
- **Valeur** : élimine le travail manuel post-visite.
- **Effort** : 3 jours.

#### O-I10. Auto-évaluation de la qualité de saisie
- **Description** : indicateur "saisie complète à 92 %" basé sur nombre de commentaires/photos vs items NON_CONFORME.
- **Valeur** : feedback formateur pour l'observateur.
- **Effort** : 2 jours.

---

## 5. Annexes

### 5.1 Matrice des rôles (extraite de l'audit)

| Domaine | USER | EDITOR | ADMIN |
|---|---|---|---|
| Procédures (catalogue) | Lire | Lire / Créer / Modifier / Export-Import | + Supprimer |
| Sessions de veille | Créer / Modifier / Archiver (scope) | + cross-équipe | + Hard delete |
| Visites de site | Créer / Modifier / Clôturer (scope) | + cross-équipe | + Hard delete |
| Agents (publics) | Lire scope + masquer perso + Vu/Note + créer action | + Lire admin (mais 403 actions) | + tout CRUD |
| Sites (publics) | Lire scope + Vu/Note | + tout CRUD | + Hard delete |
| Site Equipment | Lire | + CRUD | + tout |
| Actions importées | Lire + Valider *(bug 403)* + créer action manuelle | + Modifier / Annuler validation / Quick add / Import | + tout |
| Photos | Upload + supprimer ses photos | + suppression ses photos | + suppression toutes |
| Contacts | Lire | + Créer / Modifier | + Supprimer |
| Liens | Lire | + CRUD | + Supprimer hard |
| Utilisateurs | — | Voir page (mais 403 actions) | + CRUD complet |
| Équipes | — | Voir page (mais 403 actions) | + CRUD complet |
| Templates visite | Lire | Lire | Lire (pas d'UI d'édition) |
| Imports | — | + CSV pointages, Excel actions, JSON procédures | + |
| Stats / History | Lire scope | + cross-équipe | + |
| AuditLog | — | — | — (pas d'UI) |
| Mnémoniques / Abréviations / Postes / Secteurs | — | — | — (pas d'UI) |

### 5.2 Matrice CRUD par entité (résumé)

Légende : ✅ disponible · ⚠ partiel · ❌ absent

| Entité | C | R | U | D | Archive | Restore | Export | Import | Historique |
|---|---|---|---|---|---|---|---|---|---|
| User | ✅ | ✅ | ✅ | ⚠ | ✅ | ⚠ | ❌ | ⚠ (silencieux) | ⚠ (LOGIN seul) |
| Team | ✅ | ✅ | ✅ | ✅ | ✅ | ⚠ | ❌ | ❌ | ❌ |
| Agent | ⚠ (import seul) | ✅ | ⚠ (visibilité+équipes) | ⚠ | ✅ | ⚠ | ❌ | ✅ | ✅ |
| Site | ✅ | ✅ | ✅ | ✅ | ✅ | ⚠ | ❌ | ⚠ | ✅ |
| SiteEquipment | ✅ | ✅ | ✅ | ✅ | ✅ | ⚠ | ❌ | ✅ | ❌ |
| VeilleSession | ✅ | ✅ | ✅ | ⚠ | ✅ | ❌ | ⚠ (PDF) | ❌ | ⚠ (ObsHistory écrit non lu) |
| SiteVisit | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ⚠ (PDF) | ❌ | ✅ |
| Procedure | ⚠ (lien cassé) | ✅ | ✅ | ✅ | ✅ | ⚠ | ✅ JSON | ✅ JSON | ⚠ |
| SiteVisitTemplate | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| ImportedAction | ✅ | ✅ | ✅ | ⚠ | ✅ | ⚠ | ❌ | ✅ | ✅ |
| ActionValidation | ✅ (bug 403 USER) | ✅ | ⚠ (API non UI) | ⚠ (API non UI) | — | — | ❌ | — | ✅ |
| Contact | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Link | ✅ | ✅ | ✅ | ✅ | ⚠ | ❌ | ❌ | ❌ | ❌ |
| Photo | ✅ | ✅ | ✅ (API non UI) | ✅ (API non UI) | ❌ | ❌ | ❌ | ❌ | ❌ |
| AgentSighting / SiteSighting | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ pointages | ✅ |
| AuditLog | ⚠ (LOGIN seul) | ❌ | — | — | — | — | ❌ | — | — |
| Mnemonique / Abreviation / Poste / Secteur | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |

### 5.3 Routes API potentiellement orphelines

| Route | Statut |
|---|---|
| `GET /api/auth/me` | Jamais appelée |
| `GET /api/procedures` (collection) | Données servies via SSR |
| `GET /api/visit-templates` | Données servies via SSR |
| `PATCH /api/actions/[id]` | Aucune UI |
| `DELETE /api/actions/[id]` | Aucune UI |
| `PATCH /api/actions/validations/[id]` | Aucune UI |
| `DELETE /api/actions/validations/[id]` | Aucune UI |
| `PATCH /api/photos/[id]` | Aucune UI |
| `DELETE /api/photos/[id]` | Aucune UI |

### 5.4 Modèles Prisma morts ou quasi-morts

| Modèle | Statut |
|---|---|
| `Mnemonique` | Aucune lecture / écriture |
| `Abreviation` | Aucune lecture / écriture |
| `Poste` | Lu via relation `agent.poste` uniquement, aucune CRUD |
| `Secteur` | Idem Poste |
| `Comment` | Lu uniquement pour comptage avant suppression utilisateur, jamais créé |
| `Report` | Aucune lecture / écriture |
| `SiteVisitReport` | Aucune lecture / écriture |
| `ObservationHistory` | Écrit fidèlement, jamais lu |
| `AuditLog` | Écrit pour LOGIN uniquement |

### 5.5 Champs Prisma morts

| Champ | Statut |
|---|---|
| `Agent.rawLabel` | Écrit à l'import, jamais lu |
| `User.viewAllTeams` | Lu par scopes mais non toggleable par l'utilisateur |
| `SiteVisitTemplate.metaSchema` | Jamais lu |
| `SiteVisitTemplate.expectedFrequencyDays` | Affiché mais aucun calcul de retard |
| `SiteVisitParticipant.signature` | V1 = null, prévu V2 |
| `Photo.clientId/byteSize/width/height/syncStatus` | Prévu offline, jamais écrit |
| `VeilleSession.clientGeneratedId` | Prévu offline, jamais écrit |
| `ImportedAction.actionPlan/transferredTo/initialOwner/sharedWith/establishment/unit/space/observedElement/veilleType/veilleGroup` | Remplis à l'import, partiellement affichés |
| `Procedure.requireGeneralComment` | Édité admin, non vérifié runtime |
| `ChecklistItem.requireCommentIfKO/requirePhotoIfKO/historicConformPct/historicSampleSize` | Édités admin, non vérifiés runtime |

### 5.6 Plan d'action recommandé (synthèse)

**Sprint 1 — Lever les blocants (5 jours)**
- C5 (CSS fantôme) + C6 (procedures/new) + C7 (tables admin) — 1 jour.
- C2 (bug scope teamId) — 0.5 jour.
- C1 (photos privées) — 1 jour.
- C4 (migrations Prisma) — 0.5 jour.
- M1 (validation upload) + M3 (rate-limit login) + M23 (backup) — 1 jour.
- C3 (décision offline) — 0.5 jour de décision, puis Sprint 2 si retenu.
- Total : ~5 jours.

**Sprint 2 — Industrialisation (10 jours)**
- C3 / O-M8 (branchement syncQueue) — 5 jours.
- O-QW1 (toaster) + O-QW3 (drawer mobile) + O-QW5 (TeamSwitcher) + O-QW6 (viewAllTeams toggle) — 3 jours.
- M11 (AuditLog systématique) + O-QW7 — 2 jours.

**Sprint 3 — UX et cohérence (10 jours)**
- M4 (EDITOR/ADMIN cohérence) — 1 jour.
- M7 (cibles tactiles) + M8 (modales scroll) — 1 jour.
- M13 / O-M10 (filtres recherchables) — 0.5 jour.
- M14 (validation runtime règles métier) — 1 jour.
- O-M3 (création agent manuel) + O-M4 (page archives) + O-M2 (annulation validation) — 4 jours.
- M21 (découper StatsClient) — 2 jours.
- Quick wins lexicaux (m1 m2 m3 m4) — 0.5 jour.

**Sprint 4 — Évolutions moyennes (10 jours)**
- O-M1 (CRUD templates visite) — 5 jours.
- O-M5 (vue admin sessions) — 2 jours.
- O-M9 (composant detail unifié) + O-M11 (refonte tables mobiles) — 3 jours.

**Sprint 5+ — Structurantes**
- O-S1 (migration Postgres) — pré-requis avant scaling.
- O-S2 (hiérarchie) — feature stratégique.
- O-S3 (rôles fins) — feature stratégique.
- O-S10 (tests + CI) — sécurise la suite.

---

## 6. Sources

- Audit responsive : analyse statique de 30 pages × 5 breakpoints, variables CSS, Tailwind, AppShell.
- Audit navigation : cartographie de 30 routes + 50 routes API, grep `fetch`/`Link`/`href`/`router.push`.
- Audit CRUD/permissions : lecture des 25 modèles Prisma + 50 routes API + composants admin, croisement avec helpers `requireUser`/`requireRole`/`*Scope`.
- Audit UX / code mort : grep sur les libellés, comptage des `useEffect`, détection des `fetch` orphelins.
- Audit technique : revue ciblée de `src/lib/*.ts`, `src/proxy.ts`, `src/app/api/auth/*`, `syncQueue.ts`, recherche `any`, `dangerouslySetInnerHTML`, `$queryRaw`.
- Aucune exécution de l'app — analyse 100 % statique. Certaines conclusions (par ex. comportement exact d'un guard) gagneraient à être vérifiées en environnement réel.
