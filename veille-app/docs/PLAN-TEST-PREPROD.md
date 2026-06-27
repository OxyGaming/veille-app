# Plan de test préproduction — Veille

> **Objectif** : vérifier en conditions réelles que le **cloisonnement multi-équipes**, la **gestion des équipes**, les **actions logiques** (déduplication / expansion de groupe), les **imports** (actions, planning, pointages) et les **stats** fonctionnent correctement avant mise en production.
>
> **Périmètre** : tests fonctionnels manuels sur l'environnement de préproduction, base remplie avec le jeu de données décrit ci-dessous.
> **Hors périmètre** : tests de charge/performance, tests de sécurité offensifs, audit RGPD.
> **Ne pas modifier le code pendant la campagne** — uniquement consigner les anomalies.

---

## 0. Référentiel métier (rappel des règles validées)

Ces règles servent de base aux **résultats attendus**. Toute divergence observée est une anomalie.

| Domaine | Règle |
|---|---|
| **Cloisonnement actions** | Une action appartient à **une seule équipe** (`teamId`). Filtrage **strict** par `teamId` partout (fiches, hub, stats, admin). |
| **Visite / site partagé** | Une visite d'un site partagé est **visible par les équipes membres du site**. |
| **Planning** | Rattaché à une **équipe** (`teamId`). Chaque équipe importe **son** planning. Import = **overwrite intégral** du périmètre importé. **Agents connus uniquement** (rapprochement par **matricule**). |
| **Contacts** | `teamId = null` ⇒ contact **commun** (visible par tous). |
| **Action logique** | Groupe = même `targetType + targetId + teamId + dedupHash`. `dedupHash` null ⇒ action **seule**. |
| **Expansion serveur** | Valider / obsoléter / remplacer / supprimer **une** occurrence ACTIVE traite **tout le groupe** logique (même équipe, même cible, même hash). |
| **Échéances** | Borne « aujourd'hui 00:00 Europe/Paris ». **En retard** = `dueAt < today0` (strict, J+1). **Critique** = en retard de plus de 7 j (sous-ensemble). **À venir** = `[today0 ; +7 j]`. **Planifiée** = `> +7 j`. **Sans échéance** = null. Comptage **dédupliqué** (en actions logiques). |
| **Statuts action** | `ACTIVE` → `VALIDATED_LOCAL` (validation, pose `realizedAt`) / `OBSOLETE` (obsolescence, depuis ACTIVE ou REPLACED) / `REPLACED` (remplacement). |
| **Auto-validation** | À la clôture d'une veille : action candidate si **même agent + même équipe que la session + `ACTIVE` + `keyPoint.startsWith(point observé)`** (strict, sans normalisation d'accents). L'utilisateur confirme via modale. |
| **Notifications** | Une action validée notifie **uniquement les membres de l'équipe propriétaire** (`action.teamId`), pas toutes les équipes d'un agent/site partagé. |
| **admin/actions (Option B)** | Liste + total + pagination en **occurrences brutes**. Ajout : compteur secondaire « N occurrences · M actions logiques » + badge **×N** sur lignes groupées. Aucune fusion de lignes. |

> ⚠️ **Point de vigilance connu (à confirmer en préprod)** : le contrôle de rôle (`requireRole`) **n'applique pas** le `adminScopeMode`. Le scope d'un **ADMIN « vue équipe »** est donc potentiellement **cosmétique en écriture** : il pourrait muter des données hors de son équipe. → voir scénarios **ADMIN vue équipe** (parcours mutations) et la section multi-équipes.

---

## 1. Jeu de données de préproduction (fixtures)

À provisionner **avant** la campagne. Les identifiants/noms sont indicatifs mais doivent être **stables et reconnaissables**.

### 1.1 Équipes
| Code | Nom | Usage |
|---|---|---|
| **A** | Équipe A (ex. Paris) | équipe principale |
| **B** | Équipe B (ex. Lyon) | équipe de contrôle (cloisonnement) |

### 1.2 Utilisateurs (un par profil)
| Login | Rôle | Équipes | Scope admin | Profil testé |
|---|---|---|---|---|
| `user.a` | USER | A | — | **USER mono-équipe** |
| `user.ab` | USER | A + B | — | **USER multi-équipes** |
| `editor.a` | EDITOR | A | — | **EDITOR mono-équipe** |
| `editor.ab` | EDITOR | A + B | — | **EDITOR multi-équipes** |
| `admin.team` | ADMIN | A | **vue équipe** (MY_TEAMS/TEAM = A) | **ADMIN vue équipe** |
| `admin.global` | ADMIN | A (+ viewAllTeams) | **GLOBAL** | **ADMIN vue globale** |

> Chaque utilisateur doit avoir un **mot de passe connu** et, si possible, un **navigateur/profil dédié** pour tester en parallèle sans collision de session.

### 1.3 Agents
| Code | Matricule | Équipes (memberships) | Usage |
|---|---|---|---|
| `AG-A` | 8000001 | A | agent mono-équipe A |
| `AG-B` | 8000002 | B | agent mono-équipe B |
| `AG-SHARED` | 8000003 | **A + B** | **agent partagé** |
| `AG-UNK` | 8009999 | (aucune / inconnu) | test import planning (agent inconnu) |

### 1.4 Sites & véhicules
| Code | Type | Équipes | Usage |
|---|---|---|---|
| `SITE-A` | site | A | site mono-équipe |
| `SITE-SHARED` | site | **A + B** | **site partagé** |
| `VH-A` | véhicule | A | tournée véhicule (NC → action) |

### 1.5 Actions (états de départ)
| Code | Cible | Équipe | dedupHash | Statut | Échéance | Usage |
|---|---|---|---|---|---|---|
| `ACT-A1` | AG-A | A | h1 | ACTIVE | hier (J-1) | en retard |
| `ACT-A2` | AG-A | A | h2 | ACTIVE | J-30 | critique |
| `ACT-A3` | AG-A | A | h3 | ACTIVE | J+3 | à venir |
| `ACT-A4` | AG-A | A | null | ACTIVE | J+30 | planifiée, **non groupable** |
| `ACT-DUP` ×3 | AG-A | A | hDUP | ACTIVE | J+5 | **3 occurrences même groupe** (badge ×3) |
| `ACT-SH-A` | AG-SHARED | **A** | hsa | ACTIVE | J+2 | action d'équipe A sur agent partagé |
| `ACT-SH-B` | AG-SHARED | **B** | hsb | ACTIVE | J+2 | action d'équipe B sur agent partagé |
| `ACT-VALID` | AG-A | A | h9 | VALIDATED_LOCAL | — | non sélectionnable obsolescence/suppression |
| `ACT-SITE` | SITE-A | A | hs1 | ACTIVE | J+1 | action sur site |

> `ACT-DUP ×3` se crée le plus fidèlement via **double/triple import** du même contenu (cf. parcours **import actions**) afin d'obtenir un vrai `dedupHash` identique.

### 1.6 Planning & pointages
- Fichier planning **équipe A** contenant `AG-A`, `AG-SHARED` (matricules connus) **+ `AG-UNK`** (inconnu, doit être ignoré/listé).
- Fichier planning **équipe B** contenant `AG-B`, `AG-SHARED`.
- Fichier **pointages** couvrant `AG-A` sur une période chevauchant le planning A.

### 1.7 Sessions de veille
- Une session de veille **équipe A** sur `AG-A` dont les points observés correspondent (`startsWith`) à `ACT-A3` (pour tester l'auto-validation).

---

## 2. Matrice profils × parcours

Légende : ✅ doit pouvoir / accès complet · 👁️ lecture seule · 🚫 interdit ou invisible · 🔁 selon scope.

| Parcours | USER mono | USER multi | EDITOR mono | EDITOR multi | ADMIN équipe | ADMIN global |
|---|---|---|---|---|---|---|
| Connexion | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Dashboard | 👁️ A | 👁️ A+B | 👁️ A | 👁️ A+B | 👁️ A | 👁️ tout |
| Aujourd'hui | 👁️ A | 👁️ A+B | ✅ A | ✅ A+B | ✅ A | ✅ tout |
| Hub Échéances | 👁️ A | 👁️ A+B | ✅ A | ✅ A+B | ✅ A | ✅ tout |
| Fiche agent | 👁️ A | 👁️ A+B | ✅ A | ✅ A+B | 🔁 | ✅ tout |
| Fiche site | 👁️ A | 👁️ A+B | ✅ A | ✅ A+B | 🔁 | ✅ tout |
| Création action | ✅ A¹ | ✅ A+B¹ | ✅ A | ✅ A+B | 🔁 | ✅ tout |
| Import actions | 🚫/✅¹ | 🚫/✅¹ | ✅ A | ✅ A+B | 🔁 | ✅ tout |
| Remplacement | ✅¹ | ✅¹ | ✅ A | ✅ A+B | 🔁 | ✅ tout |
| Obsolescence | ✅¹ | ✅¹ | ✅ A | ✅ A+B | 🔁 | ✅ tout |
| Validation | ✅ A | ✅ A+B | ✅ A | ✅ A+B | ✅ | ✅ tout |
| Suppression | 🚫 | 🚫 | 🚫 | 🚫 | ✅ A | ✅ tout |
| Import planning | 🚫 | 🚫 | ✅ A | ✅ A+B | 🔁 | ✅ tout |
| Affichage planning | 👁️ A | 👁️ A+B | 👁️ A | 👁️ A+B | 👁️ A | 👁️ tout |
| Import pointages | 🚫 | 🚫 | 🔁 | 🔁 | 🔁 | ✅ |
| Clôture veille | 👁️ | 👁️ | ✅ A | ✅ A+B | ✅ | ✅ |
| Auto-validation | 👁️ | 👁️ | ✅ A | ✅ A+B | ✅ | ✅ |
| Notifications | ✅ A | ✅ A+B | ✅ A | ✅ A+B | ✅ A | ✅ tout |
| Stats/actions | 👁️ A | 👁️ A+B | 👁️ A | 👁️ A+B | 👁️ A | 👁️ tout |
| admin/actions | 🔁¹ | 🔁¹ | ✅ A | ✅ A+B | ✅ A | ✅ tout |
| Exports | 👁️ | 👁️ | ✅ | ✅ | 🔁 | ✅ |

> ¹ **À CONFIRMER en préprod** : la gestion d'actions (création / remplacement / obsolescence / admin/actions) a été ouverte « à tout utilisateur authentifié », le cloisonnement étant assuré par `teamScope`. Vérifier ce que **USER** peut réellement faire et que le **scope par équipe** est respecté. La **suppression définitive** reste **ADMIN-only**.

---

## 3. Scénarios détaillés par parcours

> Format pour chaque scénario : **Profil(s)** · **Données** · **Étapes** · **Résultat attendu** · **Points de contrôle** · **Anomalies à surveiller**.

### P01 — Connexion
- **Profil(s)** : les 6.
- **Données** : comptes §1.2.
- **Étapes** : 1) se connecter avec chaque compte ; 2) observer la page d'atterrissage ; 3) se déconnecter.
- **Résultat attendu** : connexion réussie ; redirection vers l'app ; identité + rôle corrects affichés.
- **Points de contrôle** : rôle affiché = rôle attendu ; sélecteur/contexte d'équipe cohérent (multi-équipes voit A+B) ; ADMIN voit l'entrée Administration.
- **Anomalies à surveiller** : mauvais rôle ; accès admin visible pour non-admin ; session d'un autre utilisateur réutilisée ; redirection en boucle.

### P02 — Dashboard
- **Profil(s)** : les 6.
- **Données** : actions §1.5 réparties A/B.
- **Étapes** : ouvrir le Dashboard ; lire les KPI (actions à traiter, en retard, etc.).
- **Résultat attendu** : KPI calculés **en actions logiques** sur le **périmètre du profil**. USER/EDITOR mono A → A seul. Multi → A+B agrégés. ADMIN équipe → A. ADMIN global → tout.
- **Points de contrôle** : `ACT-DUP ×3` compte pour **1** action logique ; cohérence Dashboard ↔ Hub Échéances (mêmes définitions « en retard / à venir »).
- **Anomalies à surveiller** : doublons comptés ×3 ; fuite d'actions de l'équipe B chez un mono-A ; divergence Dashboard vs Hub ; KPI calculés avec l'heure du navigateur (décalage de minuit).

### P03 — Aujourd'hui
- **Profil(s)** : les 6.
- **Données** : planning A importé, actions du jour.
- **Étapes** : ouvrir « Aujourd'hui » ; vérifier agents planifiés + actions à traiter du jour.
- **Résultat attendu** : éléments du jour filtrés par équipe ; actions « à traiter » en comptage logique.
- **Points de contrôle** : agents planifiés = ceux du planning de l'équipe ; pas d'agent d'une autre équipe.
- **Anomalies à surveiller** : agent partagé affiché en double ; actions d'une autre équipe ; planning d'une autre équipe visible.

### P04 — Hub Échéances
- **Profil(s)** : les 6.
- **Données** : `ACT-A1` (en retard), `ACT-A2` (critique), `ACT-A3` (à venir), `ACT-A4` (planifiée), `ACT-DUP ×3`.
- **Étapes** : ouvrir le Hub ; parcourir les catégories ; appliquer filtres (statut, équipe, en retard).
- **Résultat attendu** : `ACT-A1` en **En retard** ; `ACT-A2` en **Critique** (et inclus dans en retard) ; `ACT-A3` en **À venir** ; `ACT-A4` en **Planifiée** ; `ACT-DUP` apparaît **groupée** (1 ligne logique) avec indication ×3.
- **Points de contrôle** : bornes calculées **côté serveur** (badge identique quelle que soit l'horloge locale) ; compteurs = nombre d'actions **logiques**.
- **Anomalies à surveiller** : action du jour (`dueAt = today0`) classée « en retard » (doit être « à venir ») ; doublons listés séparément ; filtre équipe qui élargit le périmètre.

### P05 — Fiche agent
- **Profil(s)** : les 6 (focus **AG-SHARED**).
- **Données** : `AG-SHARED` avec `ACT-SH-A` (équipe A) et `ACT-SH-B` (équipe B).
- **Étapes** : ouvrir la fiche `AG-SHARED` avec chaque profil.
- **Résultat attendu** : mono-A ne voit que `ACT-SH-A` ; mono-B ne voit que `ACT-SH-B` ; multi A+B voit les deux ; ADMIN global voit les deux ; ADMIN équipe A voit `ACT-SH-A`.
- **Points de contrôle** : cloisonnement **strict par teamId** même sur agent partagé ; pas de fuite d'action de l'autre équipe.
- **Anomalies à surveiller** : `ACT-SH-B` visible par mono-A ; doublons d'occurrences non groupés ; badges d'échéance incohérents avec le Hub.

### P06 — Fiche site
- **Profil(s)** : les 6 (focus **SITE-SHARED**).
- **Données** : `SITE-SHARED` (membres A+B), `ACT-SITE` (équipe A) ; éventuelle visite sur site partagé.
- **Étapes** : ouvrir la fiche `SITE-SHARED` ; consulter actions + visites.
- **Résultat attendu** : **actions** filtrées strictement par équipe ; **visites** du site visibles par les équipes membres du site (règle visite partagée).
- **Points de contrôle** : distinction nette « actions (strict) » vs « visites (partagées) ».
- **Anomalies à surveiller** : action d'équipe B visible par mono-A ; visite du site invisible alors que l'équipe est membre ; NC d'équipement qui fuit.

### P07 — Création action
- **Profil(s)** : USER (à confirmer), EDITOR mono/multi, ADMIN équipe/global.
- **Données** : `AG-A`, équipe A.
- **Étapes** : créer une action rapide sur `AG-A` (équipe A explicitement choisie) ; pour multi-équipes, tester aussi sélection équipe B.
- **Résultat attendu** : action créée avec le **bon `teamId`** ; visible uniquement par le périmètre de cette équipe ; `dedupHash` calculé.
- **Points de contrôle** : sélecteur d'équipe disponible/forcé pour multi-équipes ; impossibilité de créer hors de ses équipes (sauf ADMIN global).
- **Anomalies à surveiller** : `teamId` par défaut erroné (création NOTE mauvaise équipe) ; multi-équipes sans choix d'équipe → équipe arbitraire ; USER bloqué alors qu'il devrait pouvoir (ou l'inverse).

### P08 — Import actions (Excel)
- **Profil(s)** : EDITOR mono/multi, ADMIN équipe/global (USER à confirmer).
- **Données** : fichier Excel d'actions pour équipe A ; **réimporter le même fichier** pour générer `ACT-DUP`.
- **Étapes** : 1) sélectionner **l'équipe cible** ; 2) importer ; 3) consulter le rapport d'import ; 4) réimporter le **même** fichier.
- **Résultat attendu** : actions créées sur l'équipe choisie ; `dedupHash` identique entre occurrences identiques ; le réimport crée des occurrences du **même groupe logique** (ou met à jour selon la règle d'import).
- **Points de contrôle** : sélecteur d'équipe **explicite** ; rapport (créées/maj/erreurs) ; cohérence du compteur logique après import.
- **Anomalies à surveiller** : import sur la mauvaise équipe ; `dedupHash` divergent pour un contenu identique ; multi-équipes important sans choisir l'équipe.

### P09 — Remplacement action
- **Profil(s)** : EDITOR mono/multi, ADMIN équipe/global.
- **Données** : `ACT-DUP ×3` (groupe), `ACT-VALID` (déjà validée).
- **Étapes** : sélectionner **une** occurrence de `ACT-DUP` ; remplacer (nouveau contenu) ; vérifier le groupe.
- **Résultat attendu** : **tout le groupe** `ACT-DUP` passe `REPLACED` ; **un seul** clone ACTIVE créé (1 par action logique, pas 1 par occurrence) ; `ACT-VALID` **refusée** si sélectionnée.
- **Points de contrôle** : expansion serveur (groupe entier) ; clone unique ; scope respecté (pas d'extension à une autre équipe).
- **Anomalies à surveiller** : 3 clones au lieu d'1 ; occurrences du groupe restées ACTIVE ; remplacement d'une action d'une autre équipe.

### P10 — Obsolescence action
- **Profil(s)** : EDITOR mono/multi, ADMIN équipe/global.
- **Données** : `ACT-DUP ×3`, une action `REPLACED`, `ACT-VALID`.
- **Étapes** : marquer obsolète **une** occurrence de `ACT-DUP` ; tenter sur `ACT-VALID`.
- **Résultat attendu** : **tout le groupe** `ACT-DUP` → `OBSOLETE` ; une `REPLACED` → `OBSOLETE` (telle quelle, sans expansion) ; `ACT-VALID` **refusée** (409/skip).
- **Points de contrôle** : expansion ACTIVE du groupe ; ancre REPLACED obsolétée seule ; audit `groupIds/groupSize`.
- **Anomalies à surveiller** : une seule occurrence obsolétée (groupe non traité) ; validation rendue obsolète ; fuite cross-équipe.

### P11 — Validation action
- **Profil(s)** : les 6 (USER inclus, sur son équipe).
- **Données** : `ACT-DUP ×3` (ACTIVE), action issue d'une NC (pour test clôture NC).
- **Étapes** : valider **une** occurrence de `ACT-DUP` (date de réalisation) ; revalider une occurrence déjà traitée.
- **Résultat attendu** : **tout le groupe** → `VALIDATED_LOCAL` avec `realizedAt` ; **1 `ActionValidation` par occurrence** ; revalidation = **no-op** (pas de doublon) ; NC liée clôturée si applicable.
- **Points de contrôle** : idempotence (revalidation noop) ; notification émise **une seule fois** à l'équipe propriétaire.
- **Anomalies à surveiller** : double notification ; auto-validation cross-team (action d'une autre équipe validée) ; occurrences du groupe non validées.

### P12 — Suppression action (hard delete)
- **Profil(s)** : ADMIN équipe, ADMIN global (les autres : doit être **interdit**).
- **Données** : `ACT-DUP ×3`, `ACT-VALID` (a une validation), motif de suppression.
- **Étapes** : sélectionner une occurrence de `ACT-DUP` ; supprimer avec **motif** (3–500 car.) ; tenter de supprimer `ACT-VALID`.
- **Résultat attendu** : **tout le groupe** ACTIVE supprimé ; `ACT-VALID` **bloquée** (validations rattachées) ; audit avec motif ; non-ADMIN : action indisponible.
- **Points de contrôle** : motif obligatoire ; blocage des actions validées ; expansion du groupe ; scope strict.
- **Anomalies à surveiller** : suppression d'une seule occurrence ; suppression d'une action validée ; **ADMIN « vue équipe » qui supprime une action de l'équipe B** (voir §0 vigilance) ; non-ADMIN capable de supprimer.

### P13 — Import planning par équipe
- **Profil(s)** : EDITOR mono/multi, ADMIN équipe/global.
- **Données** : planning A (avec `AG-UNK` inconnu), planning B.
- **Étapes** : 1) sélectionner **l'équipe** ; 2) importer planning A ; 3) consulter le rapport (agents inconnus) ; 4) réimporter une version modifiée (overwrite).
- **Résultat attendu** : shifts rattachés à l'**équipe A** ; `AG-UNK` **ignoré/listé** (pas de création d'agent) ; réimport = **remplacement intégral** du périmètre.
- **Points de contrôle** : rapprochement par **matricule** ; sélecteur d'équipe explicite ; overwrite (pas de doublons cumulés).
- **Anomalies à surveiller** : planning rattaché à la mauvaise équipe ; création silencieuse d'agents inconnus ; cumul au lieu d'overwrite ; planning A écrasé par import B.

### P14 — Affichage planning multi-équipe
- **Profil(s)** : USER/EDITOR multi, ADMIN global (+ contrôle mono).
- **Données** : planning A **et** B importés, `AG-SHARED` présent dans les deux.
- **Étapes** : ouvrir le planning avec un multi-équipes ; observer `AG-SHARED`.
- **Résultat attendu** : multi A+B voit les shifts A et B ; mono ne voit que son équipe ; `AG-SHARED` correctement attribué par équipe.
- **Points de contrôle** : pas de doublon d'affichage de `AG-SHARED` ; séparation visuelle par équipe si prévue.
- **Anomalies à surveiller** : fuite du planning B chez un mono-A ; double comptage de l'agent partagé.

### P15 — Import pointages
- **Profil(s)** : ADMIN (et EDITOR si autorisé — à confirmer).
- **Données** : fichier pointages couvrant `AG-A`.
- **Étapes** : importer les pointages ; consulter le rapport ; recouper avec le planning.
- **Résultat attendu** : pointages rattachés aux bons agents/équipe ; rapport cohérent.
- **Points de contrôle** : périmètre équipe respecté ; rapprochement agent par matricule.
- **Anomalies à surveiller** : pointages rattachés hors équipe ; agents inconnus créés ; doublons.

### P16 — Clôture de veille
- **Profil(s)** : EDITOR mono/multi, ADMIN.
- **Données** : session de veille équipe A sur `AG-A` avec points observés correspondant à `ACT-A3`.
- **Étapes** : ouvrir la session ; renseigner les observations ; clôturer.
- **Résultat attendu** : session clôturée ; déclenchement de la détection d'auto-validation (cf. P17).
- **Points de contrôle** : statut de session ; génération éventuelle de NC / actions ; rapport de session disponible.
- **Anomalies à surveiller** : clôture sans persistance ; actions d'autres équipes proposées ; erreurs sur NC générées.

### P17 — Auto-validation
- **Profil(s)** : EDITOR/ADMIN.
- **Données** : session A / `AG-A` ; `ACT-A3` (`keyPoint` commençant par le point observé) ; une action d'une **autre équipe** sur `AG-A` avec le même `keyPoint`.
- **Étapes** : à la clôture, ouvrir la liste des candidats à l'auto-validation ; confirmer.
- **Résultat attendu** : `ACT-A3` proposée (même agent + même équipe que la session + ACTIVE + `startsWith`) ; l'action de **l'autre équipe n'est pas proposée** ; chaque action ne remonte qu'**une fois**.
- **Points de contrôle** : matching `startsWith` **strict** (pas de fuzzy, accents sensibles) ; cloisonnement par `teamId` de la session ; dédup par `action.id`.
- **Anomalies à surveiller** : action d'une autre équipe proposée/validée (cross-team) ; faux positifs de matching ; validation sans confirmation.

### P18 — Notifications
- **Profil(s)** : USER/EDITOR mono/multi, ADMIN.
- **Données** : `ACT-SH-A` (équipe A sur agent partagé) ; membres A et membres B.
- **Étapes** : valider `ACT-SH-A` ; observer les notifications reçues par les membres A et par les membres B.
- **Résultat attendu** : **seuls les membres de l'équipe A** sont notifiés ; **aucune** notification aux membres B (agent pourtant partagé) ; **une seule** notification par événement.
- **Points de contrôle** : diffusion limitée à l'équipe propriétaire ; pas de doublon de notification.
- **Anomalies à surveiller** : sur-diffusion (toutes les équipes de l'agent) ; double notification (TEAM_HISTORY_ADDED + notif dédiée) ; notification d'un événement d'une autre équipe.

### P19 — Stats / actions
- **Profil(s)** : les 6.
- **Données** : `ACT-DUP ×3`, mix de statuts/échéances.
- **Étapes** : ouvrir Stats/actions ; lire les compteurs logiques vs occurrences.
- **Résultat attendu** : distinction **actions logiques** vs **occurrences** ; périmètre filtré par équipe ; `ACT-DUP` = 1 logique / 3 occurrences.
- **Points de contrôle** : `countLogicalActions` cohérent avec Dashboard/Hub ; pas de fuite cross-équipe.
- **Anomalies à surveiller** : comptage en occurrences là où on attend du logique (ou l'inverse) ; incohérence avec les autres écrans.

### P20 — admin/actions (Option B)
- **Profil(s)** : EDITOR mono/multi, ADMIN équipe/global (USER à confirmer).
- **Données** : `ACT-DUP ×3`, mix de statuts ; périmètre A et B.
- **Étapes** : ouvrir admin/actions ; appliquer filtres (statut, équipe, recherche, en retard) ; charger « 50 de plus ».
- **Résultat attendu** : liste en **occurrences brutes** (3 lignes pour `ACT-DUP`, **non fusionnées**) ; total = occurrences ; compteur secondaire « N occurrences · M actions logiques » ; **badge ×3** sur les lignes de `ACT-DUP` ; pagination inchangée.
- **Points de contrôle** : `occurrenceCount` calculé sur le **périmètre filtré** (badge ×3 même si une seule occurrence visible sur la page) ; mêmes filtres appliqués à la liste et au compteur logique ; cloisonnement (ADMIN équipe A ne voit pas B).
- **Anomalies à surveiller** : lignes fusionnées ; total faussé ; badge absent/incorrect ; **ADMIN « vue équipe » voyant ou mutant les actions de l'équipe B** ; pagination cassée par l'ajout du compteur.

### P21 — Exports (PDF / Excel / Word)
- **Profil(s)** : EDITOR/ADMIN (lecture pour USER selon écran).
- **Données** : RCI (`.docx`), fiche agent développement (`PDF`), rapport de visite / session / tournée véhicule, export procédures, export audit CSV.
- **Étapes** : générer chaque export disponible depuis le périmètre de l'utilisateur.
- **Résultat attendu** : fichier généré et téléchargeable ; **contenu limité au périmètre de l'utilisateur** (pas de données d'une autre équipe) ; en-têtes `Content-Disposition` corrects.
- **Points de contrôle** : données exportées = données affichées (mêmes filtres/cloisonnement) ; pas de fuite via l'export.
- **Anomalies à surveiller** : export contenant des données d'une autre équipe ; fichier corrompu/vide ; export accessible à un profil non autorisé.

---

## 4. Section spécifique — cas multi-équipes

> Ces cas sont **le cœur du risque**. À tester en priorité, avec deux navigateurs côte à côte (un profil A, un profil B) quand pertinent.

### M01 — Agent partagé entre deux équipes
- **Données** : `AG-SHARED` (A+B), `ACT-SH-A` (A), `ACT-SH-B` (B).
- **Étapes** : ouvrir la fiche `AG-SHARED` avec `user.a`, puis `user.ab`, puis `admin.global`.
- **Résultat attendu** : `user.a` ne voit que `ACT-SH-A` ; `user.ab` voit A+B ; `admin.global` voit tout. La validation de `ACT-SH-A` ne notifie que l'équipe A.
- **Anomalies** : fuite d'action de l'autre équipe ; notification croisée ; agent dupliqué dans les listes.

### M02 — Site partagé entre deux équipes
- **Données** : `SITE-SHARED` (A+B), `ACT-SITE` (A), une **visite** du site.
- **Étapes** : ouvrir `SITE-SHARED` avec un profil A et un profil B.
- **Résultat attendu** : **actions** strictement cloisonnées par équipe ; **visites** visibles par les deux équipes membres.
- **Anomalies** : action B visible par A ; visite invisible pour une équipe membre ; NC d'équipement qui fuit.

### M03 — Action dupliquée par import
- **Données** : import × (2 ou 3) du même fichier → `ACT-DUP` (même `dedupHash`).
- **Étapes** : 1) vérifier le groupe dans Hub/Stats/admin (×N) ; 2) valider **une** occurrence ; 3) vérifier que **tout le groupe** est traité.
- **Résultat attendu** : comptage logique = 1 partout ; admin/actions montre N occurrences + badge ×N ; validation/obsolescence/remplacement/suppression d'une occurrence = traitement du **groupe entier**.
- **Anomalies** : occurrences traitées indépendamment ; comptage logique faux ; clones multiples au remplacement ; `ACT-A4` (hash null) **jamais** regroupée.

### M04 — Utilisateur appartenant à deux équipes
- **Données** : `user.ab` / `editor.ab`.
- **Étapes** : parcourir Dashboard, Hub, fiches, création, planning avec un multi-équipes.
- **Résultat attendu** : agrégation **A+B** sans doublon ; à la création/import, **choix d'équipe explicite** ; pas de mélange involontaire des périmètres.
- **Anomalies** : équipe par défaut imposée arbitrairement ; double comptage des entités partagées ; impossibilité de cibler une des deux équipes.

### M05 — ADMIN en vue globale puis vue équipe
- **Données** : `admin.global` (GLOBAL) et `admin.team` (équipe A).
- **Étapes** : 1) en **vue globale**, consulter et muter des données A et B ; 2) en **vue équipe A**, répéter ; 3) **tenter une mutation sur l'équipe B** en vue équipe (suppression / remplacement / obsolescence via admin/actions).
- **Résultat attendu** : vue globale = accès total ; vue équipe = lecture **et écriture limitées à A**.
- **Anomalies** : ⚠️ **point de vigilance §0** — l'ADMIN « vue équipe » peut potentiellement **muter des données de l'équipe B** (scope cosmétique en écriture). **Documenter précisément** ce qui est réellement bloqué vs autorisé : lecture filtrée mais écriture non scopée ? Classer le résultat dans la checklist Go/No-Go.

---

## 5. Checklist Go / No-Go

> Renseigner après exécution. Une seule anomalie **Bloquante** = **No-Go**.

### 🔴 Bloquant (No-Go immédiat)
- [ ] Fuite de données entre équipes en **lecture** (actions d'une autre équipe visibles par un mono-équipe).
- [ ] Fuite/mutation entre équipes en **écriture** (ex. ADMIN vue équipe modifie/supprime l'équipe B ; USER/EDITOR agit hors de ses équipes).
- [ ] Action logique **non traitée en groupe** (validation/obsolescence/remplacement/suppression d'une occurrence laisse des occurrences ACTIVE).
- [ ] **Auto-validation cross-team** (action d'une autre équipe validée automatiquement).
- [ ] Import planning/actions/pointages sur la **mauvaise équipe** ou **création silencieuse d'agents inconnus**.
- [ ] Suppression d'une action **validée** (perte de traçabilité) ; suppression sans motif.
- [ ] Connexion : usurpation de session / mauvais rôle appliqué.
- [ ] Export contenant des données **hors périmètre** de l'utilisateur.

### 🟠 Majeur (corriger avant prod, No-Go par défaut sauf arbitrage)
- [ ] **Double notification** ou **sur-diffusion** (toutes les équipes d'un agent/site partagé notifiées).
- [ ] Comptage **occurrences vs logique** incohérent entre Dashboard / Hub / Stats / admin.
- [ ] Échéances mal classées (`today0` en « en retard » ; bornes calculées côté navigateur).
- [ ] Remplacement créant **plusieurs clones** pour un même groupe.
- [ ] Overwrite planning non respecté (cumul de doublons) ; planning d'une équipe écrasé par une autre.
- [ ] Badge ×N / compteur secondaire admin/actions faux ; lignes fusionnées ; pagination cassée.
- [ ] Création d'action avec **mauvais `teamId`** par défaut pour un multi-équipes.

### 🟡 Mineur (corriger en prod ou patch rapide)
- [ ] Libellés / wording incohérents (statuts, échéances) entre écrans.
- [ ] Agent/site partagé affiché en double sans impact sur les données.
- [ ] Tri/ordre d'affichage non déterministe.
- [ ] Messages d'erreur peu explicites lors d'un refus métier (409 obsolescence d'une validée).
- [ ] Détails cosmétiques d'export (mise en page, en-têtes).

### 🟢 Acceptable en préprod (à documenter, pas bloquant)
- [ ] Coût de la requête « périmètre logique » sur très gros filtre (perf admin/actions) — surveiller, non bloquant.
- [ ] Absence de couverture de tests chiffrée (outil de coverage non installé).
- [ ] Scope ADMIN « vue équipe » **cosmétique** confirmé **uniquement en lecture** (si l'écriture s'avère correctement bloquée, reclasser ; sinon → Bloquant).
- [ ] Cohérence d'instantané entre deux requêtes non transactionnelles (compteurs indicatifs).

---

## 6. Feuille de suivi (modèle)

| ID | Parcours | Profil | Date | Testeur | Résultat (OK/KO) | Gravité | Anomalie observée | Ticket |
|---|---|---|---|---|---|---|---|---|
| P01 | Connexion | user.a | | | | | | |
| … | … | … | | | | | | |
| M05 | ADMIN équipe → mutation B | admin.team | | | | | | |

> **Conseil d'exécution** : dérouler d'abord **M01→M05** (cœur du risque), puis **P07→P12** (mutations + expansion de groupe), puis les parcours de lecture (P02→P06, P19, P20), enfin imports (P08, P13, P15) et exports (P21). Tester chaque profil avec une **session/navigateur isolé**.
