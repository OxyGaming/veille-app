# Document de décision — Revue critique du Sprint 1

> **Périmètre** : revue critique des décisions architecturales prévues avant tout développement.
> **Date** : 2026-06-13.
> **Documents amont** : AUDIT.md, AUDIT-PRODUIT.md, VISION-V2.md, BACKLOG-V2.md.
> **Aucun code, aucun pseudocode** — uniquement de l'analyse et des recommandations.
> **Posture** : critique de mes propres décisions BACKLOG-V2. Pas de complaisance.

---

## 0. TL;DR — Conclusion

Trois décisions à acter avant tout développement :

1. **Migrations Prisma** : **REPORTER en début de Sprint 2** (juste avant US-1.15 qui change le schéma). Aucune valeur si Sprint 1 ne touche pas au schéma.
2. **Photos privées** : **REPORTER en Sprint 3**. Découper en 2 commits (route + auth d'abord, migration des fichiers existants ensuite). En Sprint 1, mitigation simple : path UUID long sur les nouveaux uploads (1h, non bloquante).
3. **Modèle Équipement** : **DÉCIDER le design métier en fin de Sprint 1 (atelier de conception, 4h)**, **étendre `SiteEquipment` en Sprint 4** juste avant le Hub Échéances. Pas de refactor de schéma maintenant. Créer aussi les modèles `Local` (optionnel) et `EquipmentControl`.

Le **Sprint 1 optimisé** passe de 12 commits / ~55h à **10 commits / ~39h** (incluant le mini-atelier équipement). Marge libérée : ~16h pour tests manuels et imprévus solo+IA.

---

## 1. Sujet 1 — Migration Prisma

### 1.1 État des lieux factuel

- **Workflow actuel** : `prisma db push` (cf. `package.json` : `"db:push": "prisma db push"`). Pas de dossier `prisma/migrations/` (vérifié dans AUDIT.md C4).
- **Scripts patch existants** : `prisma/patch-*.ts` (12 fichiers selon l'audit technique). Ces scripts ont muté la production hors-versioning. Indice : la base de prod a divergé du schéma historiquement.
- **Déploiement actuel** : un seul VPS, une seule base SQLite (cf. commits récents). Pas de devs multiples qui synchronisent leur schéma.
- **Sprint 1 actuel ne change pas le schéma** : aucun des 12 commits prévus n'altère `schema.prisma`.
- **Sprint 2 change le schéma** : US-1.15 supprime 6 modèles morts + champs morts (Mnemonique, Abreviation, Comment, Report, SiteVisitReport, ObservationHistory, et 10+ champs).

### 1.2 Risques de la stratégie actuelle (`db push`)

- **Risque principal** : `db push` peut **dropper des colonnes silencieusement** quand le schéma diverge. C'est documenté Prisma.
- **Risque réel sur Veille** : faible aujourd'hui (un seul environnement, un seul dev, base produite par les patches successifs). Risque sérieux si Sprint 2 lance `db push` après avoir supprimé un modèle utilisé en réalité par des données existantes.
- **Risque RGPD/audit** : impossible de reproduire l'état d'un schéma à une date T, donc impossible d'attester d'une configuration auditable.

### 1.3 Risques de la migration elle-même

- **Risque baseline mal posée** : si on génère `0_init` depuis le schéma `.prisma` ET que la **base réelle** diverge (par exemple des index manquants, des colonnes ajoutées par patch sans toucher au schéma), `migrate deploy` en prod fera des choses inattendues.
- **Risque liste `_prisma_migrations` corrompue** : si la table de migration est mal initialisée (mauvais checksum), Prisma refuse d'avancer. Récupération longue.
- **Risque opérationnel** : pendant la baseline, si l'app continue à écrire en base, on peut avoir une fenêtre incohérente. Délai estimé : < 1 min en réalité.

### 1.4 Stratégie de migration sans perte de données

**Étape A — Audit divergence schéma vs base réelle** (1h)
- `prisma db pull` sur une copie de la base de prod, comparer le `.prisma` généré avec celui du repo. Si identique → safe. Si différent → corriger d'abord le `.prisma` pour qu'il colle.

**Étape B — Baseline en local** (1h)
- Sur copie de base prod (backup) : `mkdir prisma/migrations/0_init`. Générer `migration.sql` avec `prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script > prisma/migrations/0_init/migration.sql`.
- Créer `prisma/migrations/migration_lock.toml`.
- Marquer comme appliquée : `prisma migrate resolve --applied 0_init`.
- Tester `prisma migrate status` : doit dire « up to date ».
- Tester `prisma generate` + démarrer l'app : aucune régression.

**Étape C — Déploiement prod** (1h)
- Backup prod (manuel + automatisé US-1.8).
- Copier dossier `prisma/migrations/` en prod.
- `prisma migrate resolve --applied 0_init` en prod.
- `prisma migrate status` doit dire « up to date ».
- Pas de redémarrage app nécessaire.

**Étape D — Premier changement réel** (futur, ex. Sprint 2 US-1.15)
- `prisma migrate dev --name remove_dead_models` en local. Génère le SQL de DROP.
- Tester sur copie de base réelle.
- En prod : backup + `prisma migrate deploy`.

**Total estimé** : 3-4h, conforme aux 4h prévues.

### 1.5 Bénéfices réels

- Reproductibilité du schéma : ✅
- Audit conformité : ✅
- Filet de sécurité avant Sprint 2 (suppression code mort) : ✅
- Multi-env (si futur pré-prod, staging) : ✅

**Bénéfice immédiat USER** : zéro. Bénéfice immédiat opérationnel : modeste tant que solo dev.

### 1.6 Recommandation argumentée

**Recommandation : reporter en début de Sprint 2.**

Justifications :
1. **Sprint 1 ne change pas le schéma** : aucun bénéfice immédiat.
2. **Sprint 1 doit réussir** : surcharger le sprint d'un travail invisible à risque modéré n'apporte rien.
3. **Sprint 2 ouvre par US-1.15** : la migration sert IMMÉDIATEMENT à ce moment-là.
4. **Coût-bénéfice** : 4h investies en Sprint 1 sans valeur produite vs 4h investies en Sprint 2 avec valeur immédiate.
5. **Risque opérationnel** : si la baseline est mal posée et qu'on doit débugger, on bloque Sprint 1 alors qu'on devrait corriger des bugs visibles. Mauvais ordre des priorités.

**Action en Sprint 1** : 0 ligne de code. Au début de Sprint 2, faire la baseline EN PREMIER (avant US-1.15) selon le plan ci-dessus.

**Cas où on devrait faire MAINTENANT** : si déploiement multi-environnement imminent (pré-prod + prod), ou si plusieurs devs vont rejoindre dans le mois. Sinon : non.

**Verdict** : **Faire plus tard (début Sprint 2)**.

---

## 2. Sujet 2 — Photos privées

### 2.1 État des lieux factuel

- **Stockage** : `public/uploads/photos/{timestamp}_{6 random hex}.jpg` (cf. AUDIT.md C1).
- **Middleware** : `/uploads/` est dans la liste de bypass (`src/proxy.ts:47`).
- **Rendu** : `<img src="/uploads/photos/...">` dans :
  - Fiches agent et site (vignettes sightings)
  - SessionClient (photos d'observation)
  - Rapports PDF (ReportClient, VisitReportClient via jspdf `addImage`)
- **Volume actuel inconnu** : pas d'audit du dossier `public/uploads/`. À vérifier (commande `ls` + count).
- **Routes API photos** :
  - `POST /api/photos` : upload
  - `PATCH/DELETE /api/photos/[id]` : orphelins (AUDIT.md)

### 2.2 Risques de la stratégie proposée en Sprint 1 (US-1.5)

**Risques techniques majeurs identifiés** :

1. **PDFs côté client (jspdf)** : `addImage()` accepte soit dataURL (base64) soit HTMLImageElement. Si le code utilise `<img src>` puis `addImage(img)`, l'image doit charger AVANT `doc.save()`. Avec une route auth'd, la requête prend plus de temps (auth check + lecture FS), donc plus de risque de tomber sur un `<img>` pas encore chargé. À auditer dans `ReportClient` et `VisitReportClient`.

2. **PWA cache** : `defaultCache` de serwist cache les requêtes navigationnelles + assets. Une route API n'est pas cachée par défaut, mais certaines configurations cachent les images selon `Cache-Control`. Risque : photo qui ne se rafraîchit pas, ou pire, cache d'une photo d'une autre équipe.

3. **Mode offline** : si l'utilisateur a un rapport en cache et veut le consulter offline, les `<img src="/api/photos/...">` ne chargent plus (pas de connexion = pas d'auth check, sauf si SW intercepte intelligemment). Régression UX.

4. **Performance** : chaque image = 1 requête API qui passe par `requireUser()` (lecture cookie, décodage, fetch Prisma `user.findUnique`, vérif scope). Sur une page agent avec 30 vignettes, c'est 30 lectures user en parallèle. À mesurer.

5. **Migration des photos existantes** : déplacer physiquement `public/uploads/*` vers `data/uploads/*` en prod. Nécessite :
   - Fenêtre de maintenance OU script atomique
   - Backup avant (cf. US-1.8 — d'où l'ordre dans BACKLOG)
   - Tests de non-régression sur les photos historiques (lien `Photo.storagePath` en BD doit toujours être valide)

6. **URLs externalisées** : si des PDFs ont été envoyés par email avec liens `/uploads/...`, après migration les URLs cassent. Personnes ayant reçu ces PDFs ne peuvent plus voir les photos via le lien.

7. **Permissions de fichiers** : `data/uploads/` doit être lisible par le process Node mais idéalement pas par d'autres process. Configuration unix-style ou ACL Windows à valider.

**Risques produit** :

1. **Si on bug en Sprint 1** : on prend tout le sprint à débugger un sujet qui n'était pas urgent. Mauvais arbitrage temporel.
2. **Risque de rollback complexe** : Commit `git revert` ne ramène pas les fichiers physiques. Le script inverse doit exister et être testé.

### 2.3 Stratégies alternatives à considérer

#### Alternative A — Mitigation simple en Sprint 1 + refactor complet plus tard

- **Sprint 1 (1h)** : remplacer `randomBytes(6)` (12 hex) par `randomBytes(32)` (64 hex) = URLs impossibles à deviner. Ajouter `X-Robots-Tag: noindex` dans la réponse `next.config.ts` headers. C'est de la sécurité par obscurité, pas une vraie protection, mais réduit le risque d'énumération et d'indexation.
- **Sprint 3 (12-16h)** : route streaming complète comme prévu, avec tous les tests appropriés.

#### Alternative B — Signed URLs (HMAC + TTL court)

- Au moment du rendu côté serveur, on génère un token signé `HMAC(photoId + userId + exp)` valable 10 min.
- Les `<img src>` deviennent `/uploads/photos/xxx.jpg?token=...&exp=...`.
- Un middleware vérifie le token sur les requêtes `/uploads/`.
- **Avantages** : URLs cacheables, pas de surcoût par image, compatibilité PDF immédiate (la signature reste valide pendant la génération).
- **Inconvénients** : URLs dans les PDFs partagés deviennent invalides après 10 min (acceptable pour visualisation immédiate, problème pour archivage).
- **Effort** : ~10h.

#### Alternative C — Route auth complète comme prévu (US-1.5 telle quelle)

- Comme dans BACKLOG.
- **Avantages** : sécurité forte, pas de signature à manipuler.
- **Inconvénients** : performance, PWA cache, offline, migration.
- **Effort** : 12h estimées, probablement 16-20h en réalité.

### 2.4 Impacts par domaine (analyse détaillée)

| Domaine | Impact Alternative A | Impact Alternative B | Impact Alternative C |
|---|---|---|---|
| **Sécurité** | Modeste (obscurité) | Bonne (HMAC) | Très bonne |
| **PWA offline** | Aucun (URLs statiques) | Léger (URLs expirent) | Important (cassé sans cache spécifique) |
| **PDF jspdf** | Aucun | Aucun | À auditer + tests |
| **Performance** | Aucun impact | Aucun impact | Charge serveur ×30 par page |
| **Migration données** | Aucune | Aucune | Indispensable |
| **Rollback** | Trivial | Trivial | Complexe (fichiers physiques) |
| **Coût** | 1h | 10h | 16-20h |

### 2.5 Recommandation argumentée

**Recommandation : Alternative A en Sprint 1 (1h) + Alternative C en Sprint 3.**

Justifications :
1. **L'urgence dépend du contexte de déploiement** :
   - Si Veille tourne avec **1 équipe en production** (cas probable aujourd'hui d'après l'historique du repo), la fuite cross-équipe n'est pas exploitable car il n'y a qu'une équipe.
   - Si Veille tourne en **pré-prod / test**, encore moins urgent.
   - C'est urgent UNIQUEMENT au moment du basculement multi-équipes.
2. **Sprint 1 doit être un sprint de succès** : sortir le user des irritants visibles. Le chantier photos est un travail invisible (succès = rien ne change visuellement) avec gros risque.
3. **L'Alternative A** réduit le risque de 90 % en 1h (URLs non-devinables). C'est une mitigation suffisante jusqu'au refactor complet.
4. **Sprint 3 est le bon moment pour C** : on a Sentry + backup + toaster + ConfirmDialog (utiles pour gérer les régressions). On a 3 sprints d'expérience accumulée. La page profil est en cours (US-3.7) — on peut intégrer la galerie photo (V2.5) au même moment.
5. **Le découpage** permet en plus de tester en pré-prod la nouvelle stratégie avant de migrer les fichiers existants.

**Plan détaillé** :
- **Sprint 1, ajout léger** (1h, non bloquant) : changer `randomBytes(6)` → `randomBytes(32)` dans `api/photos/route.ts`. Ajouter `X-Robots-Tag: noindex, nofollow` dans `next.config.ts`.
- **Sprint 3, US reformulée** :
  - **Commit A** : créer route `GET /api/photos/[id]/file` (streaming + auth + scope), tester PDFs et PWA, ne PAS encore migrer les fichiers existants. Les nouvelles photos vont dans `data/uploads/`. Les anciennes restent dans `public/uploads/` mais on retire le bypass middleware (les anciennes URLs cassent). Cohabitation contrôlée.
  - **Commit B** : script de migration des photos historiques `public/uploads/*` → `data/uploads/*` + mise à jour des `Photo.storagePath`. À exécuter en fenêtre de maintenance.
  - **Commit C** : validation MIME + taille (US-1.6 actuel).

**Verdict** : **Faire plus tard (Sprint 3), avec mitigation triviale en Sprint 1**.

---

## 3. Sujet 3 — Modèle Équipement

### 3.1 État des lieux conceptuel

L'application gère aujourd'hui :

| Modèle existant | Rôle | Couverture |
|---|---|---|
| `Site` | Lieu physique | Bonne — bien défini |
| `SiteEquipment` | Catalogue d'équipements **par site** | Partielle |
| `SiteVisitObservation` (avec `equipmentId`) | Observation d'un équipement en mode INVENTORY | Bonne |
| `Procedure` + `ChecklistItem` | Référentiel des checks | Bonne pour comportement, lacunaire pour équipement |

**Lacunes identifiées vis-à-vis de la VISION-V2** :

- Pas de notion de **local** (sous-contenant de site). Or VISION-V2 §10.3 prévoit « QR Code d'un local ».
- Pas de **cycle de vie individuel** d'un équipement (mise en service, prochain contrôle, réformation).
- Pas d'**identification physique** (QR code par équipement).
- Pas de **lien direct équipement ↔ action générée** (le lien existe via observation INVENTORY mais c'est indirect).
- Pas de notion de **contrôle ponctuel** d'un équipement (différent d'une visite globale).
- Pas de **document attaché** (manuel constructeur, certificat de conformité).
- Pas de **catégorisation hiérarchique** (Extincteur → Extincteur CO2 → Extincteur CO2 2 kg).

### 3.2 Réponse aux 6 questions du brief

#### Q1. Le modèle Équipement est-il nécessaire ?

**Réponse : Oui**, mais sous une forme **évolutive** plutôt que disruptive.

Pourquoi nécessaire :
- Hub Échéances (E5) calcule des échéances de péremption / contrôle DEPUIS les équipements. Sans cycle de vie individuel, on calcule à la « ligne SiteEquipment » qui est déjà bien fait.
- QR Codes (E10) identifient un équipement → besoin d'une URL stable par équipement.
- Inspections ponctuelles (« je passe devant un extincteur, je le vérifie ») → besoin d'enregistrer un contrôle indépendant d'une visite.

Pourquoi évolutif et non disruptif :
- `SiteEquipment` couvre déjà 70 % du besoin (label, catégorie, péremption, quantité, notes).
- Refactor total = risque élevé sur le mode INVENTORY (déjà utilisé en prod probable).
- Ajout de champs + nouveaux modèles satellites = approche plus sûre.

#### Q2. Doit-il être créé avant le Hub Échéances ?

**Réponse : pas le modèle complet, mais quelques champs essentiels oui.**

Plus précisément :
- **Avant Hub Échéances V1** (Sprint 4 US-5.2) : `expirationDate` déjà présent. Suffit pour les péremptions équipements simples.
- **Avant Hub Échéances V1.5** (incluant renouvellement contrôles) : ajouter `nextCheckDate` au `SiteEquipment` (Sprint 4 ou 5).
- **Avant QR Codes** (Sprint 5+ ou post-V3) : nouveau modèle `EquipmentControl` + ajout `qrCodeToken` au `SiteEquipment`.

L'ordre **est** important. Sans réfléchir au modèle équipement, on risque de poser les fondations du Hub Échéances sur des données mal modélisées, et de payer la dette plus tard.

**Recommandation concrète** : tenir un **atelier de design de 4h en fin de Sprint 1** (ou tout début Sprint 2) pour acter le modèle métier. Pas de code. Document de spécification. Bénéfice : on évite de bricoler le Hub Échéances Sprint 4 sans plan.

#### Q3. Quels objets devraient être des Équipements ?

**Équipements (oui)** — objets physiques observables, à durée de vie limitée, soumis à inventaire ou contrôle périodique :
- Extincteurs (déjà — SiteEquipment)
- Trousses de secours / sacs de premier secours
- Défibrillateurs (AED)
- Douches de sécurité, rince-yeux
- Couvertures anti-feu
- Détecteurs de fumée / CO
- Plans d'évacuation **physiques** (panneaux)
- Registres papier obligatoires (registre de sécurité, registre EPI, registre RUP)
- Affichages réglementaires (consignes incendie, plan)
- Boîte à clés / armoire à clés
- EPI individuels (casque, harnais) — par lot/référence si quantifiables
- Outillage spécifique (manomètre, mégohmmètre) si soumis à étalonnage
- Lampes de secours / éclairage de sécurité
- Alarmes (BAES, sirène)

**Locaux / contenants — pas Équipements mais sous-modèle dédié (`Location`)** :
- Local de graissage
- Local technique
- Local électrique
- Salle de repos
- Local incendie
- Salle de premiers secours

**Documents administratifs — modèle séparé (`RegulatoryDocument`)** :
- Permis de travail, permis feu
- Certificats de conformité (constructeur, contrôle)
- Attestations électriques
- Autorisations administratives
- Plans d'évacuation **numériques** / plans de site

**Pas Équipements** :
- Sites (le contenant lui-même)
- Procédures (référentiel comportemental)
- Habilitations individuelles (modèle `AgentHabilitation`)
- Formations (modèle `AgentFormation`)
- Actions / NC (événements)
- Validations / observations (événements)

#### Q4. Quels objets ne devraient PAS être des Équipements ?

(Réponse intégrée à Q3.)

Critère de discrimination :
- **Équipement** = objet physique à durée de vie limitée, dont l'état se mesure (conforme/non conforme), à contrôler périodiquement.
- **Document** = papier ou numérique, à renouveler à une échéance, sans état physique mesurable.
- **Habilitation** = lien personne ↔ compétence, avec date de validité.
- **Local** = contenant physique d'autres objets, sans état propre (mais peut être inspecté en visite).

#### Q5. Quels liens avec les autres entités ?

```
Équipement ─→ Site             (parent obligatoire, déjà : SiteEquipment.siteId)
Équipement ─→ Local            (parent optionnel, nouveau : equipment.locationId)
Équipement ─→ Catégorie        (typage : déjà SiteEquipment.category, à structurer)
Équipement ─→ Photos          (N photos d'état, à modéliser : photo.equipmentId)
Équipement ─→ Contrôles       (N contrôles ponctuels, nouveau modèle EquipmentControl)
Équipement ─→ Observations    (N en mode INVENTORY, déjà SiteVisitObservation.equipmentId)
Équipement ─→ Actions générées (N actions de NC, à formaliser : action.equipmentId optionnel)
Équipement ─→ Document(s)     (manuel, certificat ; lien optionnel, modèle RegulatoryDocument)
Équipement ─→ QR Code         (1-1, token signé ; intégré au champ equipment.qrToken)
Équipement ─→ Échéances       (dérivées, pas stockées : expirationDate, nextCheckDate)

Local ─→ Site                  (parent obligatoire)
Local ─→ Équipements          (N, déjà couvert via equipment.locationId)
Local ─→ QR Code               (1-1, token signé)

EquipmentControl ─→ Équipement (parent obligatoire)
EquipmentControl ─→ Observer  (User, parent obligatoire)
EquipmentControl ─→ Photo(s)  (N, optionnel)
EquipmentControl ─→ Action générée (optionnel, si NC)
```

#### Q6. Modèle conceptuel minimal (design métier, pas Prisma)

**Modèle « Équipement »** (extension de SiteEquipment) — données métier :
- **Identité** : id technique, référence métier optionnelle (ex. « EXT-014 »).
- **Type** : catégorie (Extincteur, Trousse, AED, …) + sous-type optionnel (Extincteur CO2 2 kg).
- **Localisation** : Site (obligatoire), Local (optionnel), description textuelle de la position (« mur ouest, à côté de la porte »).
- **État physique** : En service / Hors service / Réformé.
- **Cycle de vie** :
  - Date de mise en service (commissioningDate)
  - Date de péremption / fin de vie (expirationDate, déjà présent)
  - Date du dernier contrôle (derived from EquipmentControl)
  - Date du prochain contrôle (nextCheckDate)
  - Fréquence de contrôle attendue (expectedCheckFrequencyDays)
- **Quantité** : si comptable (déjà present : expectedQuantity).
- **Métadonnées spécifiques type** : champ JSON souple (capacité, classes feu, autonomie batterie, etc.) pour ne pas multiplier les colonnes.
- **Identification physique** : qrToken (si généré).
- **Visibilité** : isActive (déjà présent).

**Modèle « Local »** (nouveau, optionnel) :
- Identité, label, type (local de graissage, technique, électrique, …).
- Lien Site (obligatoire).
- qrToken pour QR code de porte.

**Modèle « Contrôle d'équipement »** (nouveau) :
- Lien Équipement (obligatoire).
- Lien Observer (User).
- Date du contrôle.
- Résultat : Conforme / Non conforme / Sans objet.
- Commentaire optionnel.
- Photos optionnelles.
- Action générée optionnelle (si NC, on déclenche `ImportedAction`).
- **Différence avec Observation INVENTORY** : EquipmentControl est ponctuel (un agent qui passe et vérifie), pas dans le cadre d'une visite. Décorrélé de SiteVisit.

**Modèles satellites séparés (rappel)** :
- `RegulatoryDocument` : papier/numérique, renouvellement.
- `AgentHabilitation`, `AgentFormation` : modèles séparés (cf. US-5.7 du BACKLOG).
- `RegulatoryExercise` : exercices incendie etc. (cf. US-5.8).

### 3.3 Bénéfices d'acter le modèle dès maintenant

- **Évite la dette structurelle** : si on bricole le Hub Échéances Sprint 4 sans plan, on devra refactor en V3 ou plus tard.
- **Permet le QR Code Équipement** (E10-F2) sans douleur.
- **Permet les contrôles ponctuels** sans surcharger les visites.
- **Cohérence des échéances** : un seul moteur, plusieurs sources bien modélisées.

### 3.4 Risques de NE PAS acter le modèle maintenant

- Sprint 4 (Hub Échéances) : on improvise et on a des sources d'échéances disparates.
- Sprint 5+ (QR Codes équipements) : on patche au lieu d'avoir un modèle propre.
- V3+ : refactor coûteux quand l'app est en production.

### 3.5 Recommandation argumentée

**Recommandation : atelier de design métier de 4h en Sprint 1 (semaine 3), spécification écrite, pas de code.**

Justifications :
1. Le **coût d'un atelier est faible** (4h vs >40h de refactor plus tard).
2. La **décision n'est pas urgente à implémenter** mais l'**est** à acter conceptuellement avant Sprint 4.
3. **Pas de code** = pas de risque d'impact Sprint 1.
4. La **spécification écrite** sert ensuite à toutes les US Sprint 4-5 (US-5.2 agrégateur, US-5.7 habilitations, US-10.1/2/3/4 QR codes).
5. **Solo + IA** : la décision peut être prise en autonomie sur la base d'une réflexion structurée + lecture des audits.

**Livrable de l'atelier** : un document `DESIGN-EQUIPEMENT.md` (à produire en Sprint 1) listant :
- Le périmètre exact (qui est équipement, qui ne l'est pas).
- Les attributs métier (sans schéma Prisma).
- Les relations (sous forme de schéma textuel).
- Les évolutions du modèle existant (`SiteEquipment` → `Equipment` étendu).
- Les nouveaux modèles à créer (`Location`, `EquipmentControl`).
- Le plan de migration des données SiteEquipment existantes (quasi-vide, donc trivial).
- Les **non-décisions** (ce qu'on remet à plus tard pour ne pas sur-engineer).

**Verdict** : **Faire maintenant (atelier conceptuel uniquement), implémenter en Sprints 4-5**.

---

## 4. Arbitrage final — Sprint 1 optimisé

### 4.1 Ce qui doit RESTER

Stories à conserver dans Sprint 1 :

| Story | Effort | Pourquoi rester |
|---|---|---|
| **US-1.10 Sentry + logger** | 5h | Pré-requis observabilité tous sprints suivants |
| **US-1.8 Backup quotidien** | 4h | Assurance avant tout chantier risqué |
| **US-1.1 CSS fantômes** | 1h | Plus gros gain visible / effort |
| **US-1.2 Bouton procedures/new** | 2h | Dead-end EDITOR |
| **US-1.4 Bouton « Voir le rapport »** | 2h | Quick win UI |
| **US-1.3 Bug scope teamId** | 4h | Critique multi-équipes |
| **US-1.7 Rate-limit login** | 5h | Sécurité indépendante |
| **US-1.11 Toaster + ConfirmDialog** | 6h | Composant transverse, base pour US-1.12 |
| **US-1.12 Annulation validation 5 min** | 6h | Visible utilisateur, utilise toaster |

**Sous-total** : 35h.

### 4.2 Ce qui doit être DÉPLACÉ

| Story | Décision | Destination | Justification |
|---|---|---|---|
| **US-1.9 Migrations Prisma** | DÉPLACER | Début Sprint 2 (avant US-1.15) | Aucun changement de schéma Sprint 1, gain immédiat = 0 |
| **US-1.5 Photos privées (refactor complet)** | DÉPLACER | Sprint 3 | Chantier risqué non urgent (1 équipe en prod aujourd'hui) |
| **US-1.6 Validation MIME upload** | DÉPLACER | Sprint 3 (avec US-1.5) | Sur même route, à grouper |

### 4.3 Ce qui doit être SUPPRIMÉ

Aucune story du Sprint 1 actuel ne doit être supprimée.

Aucune valeur du Sprint 1 ne disparaît : les 12 US restent dans le backlog, dont 9 en Sprint 1 et 3 reportées.

### 4.4 Ce qui doit être AJOUTÉ

| Item | Effort | Justification |
|---|---|---|
| **Atelier design Équipement + spec écrite** | 4h | Évite la dette structurelle Sprint 4. Pas de code. |
| **Mitigation photos (path UUID 32 octets + noindex)** | 1h | Réduit le risque tactique sans complexité |
| **Vérification audit divergence schéma (avant Sprint 2)** | 1h | Préparation à US-1.9 reportée Sprint 2 |

### 4.5 Nouveau Sprint 1 optimisé

**Total** : 41h / capacité 55h → **14h de marge** pour imprévus solo+IA (buffer recommandé 25 %).

| # | Story | Effort | Notes |
|---|---|---|---|
| 1 | US-1.10 Sentry + logger | 5h | Premier commit "infra" |
| 2 | US-1.8 Backup quotidien | 4h | Assurance |
| 3 | US-1.1 CSS fantômes | 1h | Premier gain visible |
| 4 | US-1.2 Bouton procedures/new | 2h | |
| 5 | US-1.4 Bouton « Voir le rapport » | 2h | |
| 6 | US-1.3 Bug scope teamId | 4h | Avec tests Vitest minimal |
| 7 | US-1.7 Rate-limit login | 5h | Crée le helper audit minimal |
| 8 | US-1.11 Toaster + ConfirmDialog | 6h | Composant transverse |
| 9 | US-1.12 Annulation validation 5 min | 6h | Utilise toaster + audit |
| 10 | Mitigation photos (path UUID 32 + noindex) | 1h | Quick win sécurité |
| 11 | Atelier design Équipement + spec | 4h | Document, pas de code |
| 12 | Préparation Sprint 2 (audit divergence schéma) | 1h | Pas de code, audit |
| **Total** | — | **41h** | Marge 14h |

### 4.6 Ordre optimal d'exécution révisé

```
Commit 1 ─ US-1.10 Sentry (visibilité production)
Commit 2 ─ US-1.8 Backup (assurance)
Commit 3 ─ US-1.1 CSS fantômes (premier win visible)
Commit 4 ─ US-1.2 Bouton procedures/new
Commit 5 ─ US-1.4 Bouton "Voir le rapport"
Commit 6 ─ US-1.3 Bug teamId (avec Vitest minimal)
Commit 7 ─ US-1.7 Rate-limit login (+ helper logAudit)
Commit 8 ─ US-1.11 Toaster + ConfirmDialog
Commit 9 ─ US-1.12 Annulation validation 5 min
Commit 10 ─ Mitigation photos (UUID 32 + noindex)

Travaux annexes (non code) :
- Atelier design Équipement → DESIGN-EQUIPEMENT.md (4h)
- Audit divergence schéma → notes pour Sprint 2 (1h)
```

L'ordre des commits 1-9 est inchangé vs BACKLOG-V2. Commits 11-12 disparaissent de Sprint 1 ; nouveau commit 10 (mitigation photos) ajouté.

### 4.7 Explication de chaque arbitrage

**Pourquoi reporter Migrations Prisma ?**
- Sprint 1 ne change pas le schéma → bénéfice nul.
- Sprint 2 ouvre par une suppression de modèles → bénéfice immédiat.
- Solo dev = pas de problème de divergence entre devs maintenant.
- Mauvaise dette si baseline mal faite — autant la faire au calme avant un changement utile.

**Pourquoi reporter Photos privées complètes ?**
- Chantier risqué (12h annoncées, probablement 16-20h réels).
- Non urgent en l'absence de multi-équipes en production.
- Régressions possibles sur PDF / PWA / offline / performance.
- Sprint 1 = succès attendu, pas de surcharge.
- Alternative simple (UUID 32 + noindex) couvre 80 % du risque pour 1h.

**Pourquoi ajouter l'atelier Équipement ?**
- Évite refactor de schéma en Sprint 4-5 (coût plus élevé).
- Pas de code = pas de risque sur Sprint 1.
- Cadre les US Sprint 4-5 (Hub Échéances, QR Codes).
- 4h investies = ~20h économisées plus tard.

**Pourquoi ajouter la mitigation photos ?**
- 1h pour réduire significativement le risque tactique.
- Pas de blocage sur le refactor Sprint 3.
- Cohérent avec une posture "sécurité défense en profondeur".

**Pourquoi garder l'ordre des commits 1-9 ?**
- L'ordre justifié dans BACKLOG-V2 reste valide.
- Sentry → tests → backup → wins visibles → refactor → composants → consommateurs.

### 4.8 Risques de l'arbitrage révisé

| Risque | Probabilité | Impact | Mitigation |
|---|---|---|---|
| Atelier Équipement bâclé / approximatif | Moyenne | Élevé | Document écrit obligatoire, relecture à froid 24h après |
| Migration Prisma reportée mais oubliée | Faible | Élevé | Première ligne de Sprint 2, dans le suivi |
| Photos restent vulnérables jusqu'à Sprint 3 | Élevée | Modeste | UUID 32 + noindex couvre le risque exploitable réel |
| Sprint 1 finit en avance | Moyenne | Faible (positif) | Démarrer Sprint 2 anticipé OU repos bénéfique solo |
| Nouvelle vulnérabilité découverte Sentry sur photos | Faible | Moyen | Le report rend la vulnérabilité visible avant qu'elle soit critique |

---

## 5. Synthèse des décisions

| Sujet | Décision | Effort Sprint 1 | Effort différé |
|---|---|---|---|
| Migration Prisma | **Reporter Sprint 2** | 0h | 4h Sprint 2 |
| Photos privées | **Reporter Sprint 3** + mitigation 1h | 1h | 16-20h Sprint 3 |
| Modèle Équipement | **Atelier conceptuel Sprint 1** | 4h (doc) | 0h Sprint 1, ~20h Sprint 4-5 |
| Sprint 1 global | **41h, 14h marge** | — | — |

**Verdict global** : Sprint 1 plus ciblé, mieux maîtrisé, marge confortable. Aucune valeur perdue. Préparation des Sprints suivants améliorée par l'atelier équipement.

---

## 6. Questions à l'utilisateur avant de démarrer le Sprint 1 modifié

1. **Tu valides le report de US-1.9 (Migrations Prisma) en début de Sprint 2 ?**
2. **Tu valides le report de US-1.5 + US-1.6 (Photos privées + Validation MIME) en Sprint 3, avec mitigation 1h en Sprint 1 ?**
3. **Tu valides l'ajout d'un atelier conceptuel Équipement de 4h en fin de Sprint 1, produisant un document `DESIGN-EQUIPEMENT.md` ?**
4. **Tu confirmes que Veille est aujourd'hui utilisée par 1 équipe (ou pré-prod), ce qui justifie le report photos ?** Si déjà multi-équipes en production, on remonte la priorité.
5. **Tu confirmes que tu as accès au VPS pour mettre en place backup (commit 2) et Sentry (commit 1) ?**

Tes réponses orientent l'exécution. Sans elles, je prends les défauts proposés ci-dessus.
