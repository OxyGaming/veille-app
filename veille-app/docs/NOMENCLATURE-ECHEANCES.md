# Nomenclature & règles métier — Actions et échéances

> Document de référence **figé** (validé le 2026-06-27). Aucune implémentation tant que la nomenclature n'est pas validée.
> Règle d'or : **un mot = un seul calcul**, et **un calcul = un seul mot**. Tout synonyme est interdit (liste plus bas).
> Cf. memory `echeance-vocabulary.md`, `cloisonnement-decisions.md`.

---

## 0. Deux axes orthogonaux (ne jamais les confondre)

Une action a **deux dimensions indépendantes** :

1. **Cycle de vie** (statut de traitement) — porté par `ImportedAction.localStatus`. Valeurs **mutuellement exclusives** : `ACTIVE`, `VALIDATED_LOCAL`, `OBSOLETE`, `REPLACED`. C'est l'état « administratif » de l'action.
2. **État d'échéance** — **dérivé** de `dueAt` par rapport à *maintenant*. **Ne s'applique QU'AUX actions `À traiter`** (`localStatus = ACTIVE`). Une action validée/obsolète/remplacée **n'a pas** d'état d'échéance.

Conséquence : « En retard », « À venir », etc. ne qualifient jamais une action validée ou obsolète. « Validé », « Obsolète », etc. ne dépendent jamais de la date d'échéance.

**Référence temporelle unique** : « aujourd'hui » = **début de la journée courante à 00:00, fuseau Europe/Paris**. Toutes les comparaisons d'échéance utilisent cette borne (jamais l'heure exacte « maintenant »), pour que le résultat soit stable toute la journée.

---

## 1. Définitions — Cycle de vie (localStatus)

### 1.1 À traiter
- **Définition métier** : action ouverte, en attente de traitement. Seul état qui porte une notion d'échéance.
- **Règle de calcul** : `localStatus = ACTIVE`.
- **Requête logique** : `where: { localStatus: "ACTIVE", …scope }`.
- **Couleur** : neutre — **ardoise / gris** (`slate`). La couleur réelle affichée vient de son **état d'échéance** (§2).
- **Priorité (cycle de vie)** : c'est l'état « vivant » ; il est le seul à se sous-décliner en états d'échéance.
- **Où** : Dashboard (compteur backlog), Aujourd'hui, Échéances, Fiche agent, Fiche site, Stats.

### 1.2 Traité  *(décision validée 2026-06-27 : fusion de « Validé » + « Réalisé »)*
- **Définition métier** : action **faite**, quelle que soit l'origine — **validée dans l'application** (l'utilisateur atteste la réalisation) **ou** **réalisée à la source** (fichier Excel, « Date de réalisation » renseignée). Un seul terme UI : **« Traité »**.
- **Règle de calcul** : `localStatus = VALIDATED_LOCAL` **OU** (`localStatus = OBSOLETE` **et** `realizedAt ≠ null`).
- **Requête logique** : `where: { OR: [ { localStatus: "VALIDATED_LOCAL" }, { localStatus: "OBSOLETE", realizedAt: { not: null } } ] }`.
- **Couleur** : **vert** (`emerald`).
- **Priorité** : terminal (positif). Hors backlog « à traiter ».
- **Où** : Fiche agent/site (validations + historique), Stats (taux/délai de validation, validations mensuelles), Notifications (ACTION_VALIDATED), Imports (lignes réalisées).
- **Origine tracée en interne** (non exposée comme deux libellés) : `VALIDATED_LOCAL` = validé app (preuve `ActionValidation`) ; `OBSOLETE + realizedAt` = réalisé Excel. La distinction reste disponible en base/metadata sans créer deux mots UI.

### 1.4 Remplacé
- **Définition métier** : action **remplacée** par une nouvelle (correction de contenu via remplacement par lot). L'originale est conservée mais sortie du suivi actif.
- **Règle de calcul** : `localStatus = REPLACED` (posé par `batch-replace` sur l'originale ; un clone `ACTIVE` la remplace).
- **Requête logique** : `where: { localStatus: "REPLACED" }`.
- **Couleur** : **violet/gris** (`violet`/`slate`).
- **Priorité** : intermédiaire — peut encore transiter vers `OBSOLETE` (mais pas être validée).
- **Où** : back-office actions (filtre statut), historique. Invisible du backlog.

### 1.5 Obsolète
- **Définition métier** : action **retirée du suivi sans avoir été faite** (devenue caduque, obsolescence manuelle, ou NC d'origine supprimée). Conservée en base pour l'historique, jamais supprimée. ⚠️ Une action `OBSOLETE` **avec** `realizedAt` n'est PAS « Obsolète » mais **« Traité »** (§1.2).
- **Règle de calcul** : `localStatus = OBSOLETE` **et** `realizedAt = null`. Origines : obsolescence manuelle (`obsoleteAction`, transition `ACTIVE|REPLACED → OBSOLETE`) ou NC d'origine supprimée.
- **Requête logique** : `where: { localStatus: "OBSOLETE", realizedAt: null }`.
- **Couleur** : **gris foncé / barré** (`slate-500`, texte barré).
- **Priorité** : terminal (neutre). Hors backlog, hors échéances, hors stats actives.
- **Où** : back-office actions (obsolescence), historique.

---

## 2. Définitions — État d'échéance (uniquement pour « À traiter »)

> S'applique seulement à `localStatus = ACTIVE`. Calcul fondé sur `dueAt` vs **aujourd'hui 00:00**.
> Pour le **badge unique** d'une action, on retient l'état de **plus haute priorité** applicable (§3). Pour les **compteurs**, voir la note d'inclusion ci-dessous.

### 2.1 Échéance
- **Définition métier** : la **date limite** de réalisation d'une action (`dueAt`). Ce n'est pas un état mais la donnée source des états ci-dessous.
- **Règle de calcul** : champ `ImportedAction.dueAt` (DateTime, nullable).
- **Couleur** : n/a (donnée).
- **Où** : partout où une action est listée (colonne/élément « Échéance »), tri par défaut du backlog (échéance la plus proche d'abord).

### 2.2 Sans échéance
- **Définition métier** : action à traiter **sans date limite** définie. Ni en retard, ni à venir. À planifier.
- **Règle de calcul** : `localStatus = ACTIVE` **et** `dueAt IS NULL`.
- **Requête logique** : `where: { localStatus: "ACTIVE", dueAt: null }`.
- **Couleur** : **gris clair** (`slate-300`).
- **Priorité** : la plus basse parmi les états d'échéance.
- **Où** : backlog (fiche agent/site). Absente du Hub Échéances (qui exige `dueAt`).

### 2.3 À venir
- **Définition métier** : action à traiter dont l'échéance est **imminente** (dans les 7 prochains jours, échéance non dépassée).
- **Règle de calcul** : `localStatus = ACTIVE` **et** `aujourd'hui00:00 ≤ dueAt ≤ aujourd'hui00:00 + 7 j`.
- **Requête logique** : `where: { localStatus: "ACTIVE", dueAt: { gte: aujourd'hui00:00, lte: aujourd'hui00:00 + 7j } }`.
- **Couleur** : **bleu / indigo** (`indigo`).
- **Priorité** : 3 (au-dessus de « sans échéance », en dessous de « en retard »).
- **Où** : Aujourd'hui, Échéances, Fiche agent/site (« < 7 j »), Stats (« soon »).

### 2.3 bis Planifiée  *(décision validée 2026-06-27)*
- **Définition métier** : action à traiter dont l'échéance est **lointaine** (au-delà de 7 jours) — ni en retard, ni imminente, aucune alerte.
- **Règle de calcul** : `localStatus = ACTIVE` **et** `dueAt > aujourd'hui00:00 + 7 j`.
- **Requête logique** : `where: { localStatus: "ACTIVE", dueAt: { gt: aujourd'hui00:00 + 7j } }`.
- **Couleur** : **neutre** (`slate-400`).
- **Priorité** : 4 (entre « à venir » et « sans échéance »).
- **Où** : backlog (fiche agent/site). Au Hub Échéances, regroupée hors de la fenêtre d'alerte. « À venir » reste **strictement** la fenêtre des 7 jours.

### 2.4 En retard
- **Définition métier** : action à traiter dont **l'échéance est dépassée** (dès le lendemain de l'échéance).
- **Règle de calcul** : `localStatus = ACTIVE` **et** `dueAt < aujourd'hui00:00`. **Inclut** les « en retard critique ».
- **Requête logique** : `where: { localStatus: "ACTIVE", dueAt: { lt: aujourd'hui00:00 } }`.
- **Couleur** : **ambre** (`amber`).
- **Priorité** : 2.
- **Où** : Dashboard, Aujourd'hui, Échéances, Fiche agent/site, Stats (« overdue »).

### 2.5 En retard critique
- **Définition métier** : action **en retard de plus de 7 jours**. Palier d'alerte ; **déclenche l'état rouge** des bannières. C'est un **sous-ensemble** de « En retard ».
- **Règle de calcul** : `localStatus = ACTIVE` **et** `dueAt < aujourd'hui00:00 − 7 j`.
- **Requête logique** : `where: { localStatus: "ACTIVE", dueAt: { lt: aujourd'hui00:00 − 7j } }`.
- **Couleur** : **rouge** (`rose`/`red`).
- **Priorité** : 1 (la plus haute).
- **Où** : Aujourd'hui (déclencheur rouge), Échéances (groupe « critique »), Dashboard (« échéances critiques »).

> **Relation En retard / Critique** *(décision validée 2026-06-27)* : tout critique EST en retard. Pour un **badge** d'action, on affiche « Critique » (rouge) et pas « En retard ». Pour les **compteurs**, format unique retenu : **« En retard : N (dont C critiques) »** — un seul total (critiques inclus), le critique en sous-information ; le critique déclenche le rouge. On **n'officialise pas** de compteur séparé « en retard récent ».

---

## 3. Ordre de priorité (badge unique d'une action)

Quand une action ne peut afficher qu'**un** état, appliquer dans l'ordre :

| Rang | État | Couleur | Condition (premier vrai gagne) |
|---|---|---|---|
| — | **Traité** | vert | `VALIDATED_LOCAL` **ou** (`OBSOLETE && realizedAt != null`) |
| — | **Remplacé** | violet | `localStatus = REPLACED` |
| — | **Obsolète** | gris foncé | `OBSOLETE && realizedAt = null` |
| 1 | **En retard critique** | rouge | `ACTIVE && dueAt < auj − 7j` |
| 2 | **En retard** | ambre | `ACTIVE && dueAt < auj` |
| 3 | **À venir** | indigo | `ACTIVE && auj ≤ dueAt ≤ auj+7j` |
| 4 | **Planifiée** | neutre | `ACTIVE && dueAt > auj+7j` |
| 5 | **Sans échéance** | gris clair | `ACTIVE && dueAt = null` |

Le cycle de vie (haut du tableau) **prime** sur l'état d'échéance : une action `VALIDATED_LOCAL` n'affiche jamais « en retard ».

---

## 4. Nomenclature uniforme (terme canonique ↔ code ↔ synonymes interdits)

| Terme canonique (UI) | Identifiant code | Calcul | Synonymes **INTERDITS** |
|---|---|---|---|
| À traiter | `ACTIVE` | `localStatus=ACTIVE` | « ouvert », « à faire », « en cours » |
| **Traité** | `TREATED` | `VALIDATED_LOCAL` **ou** (`OBSOLETE && realizedAt≠null`) | « validé », « réalisé », « clôturé », « terminé », « fait » (tous fusionnés sous *Traité*) |
| Remplacé | `REPLACED` | `localStatus=REPLACED` | « écrasé », « mis à jour » |
| Obsolète | `OBSOLETE` | `OBSOLETE && realizedAt=null` | « supprimé », « archivé », « annulé » |
| Échéance | `dueAt` | champ `dueAt` | — |
| Sans échéance | `NO_DUE_DATE` | `ACTIVE && dueAt=null` | « non daté », « libre » |
| À venir | `DUE_SOON` | `ACTIVE && auj ≤ dueAt ≤ auj+7j` | « bientôt », « proche », « prochaines » |
| Planifiée | `SCHEDULED` | `ACTIVE && dueAt > auj+7j` | « plus tard », « future » |
| En retard | `OVERDUE` | `ACTIVE && dueAt < auj` | **« échu »**, « dépassé », « retard » |
| En retard critique | `OVERDUE_CRITICAL` | `ACTIVE && dueAt < auj−7j` | « urgent », « bloquant », « grave » |

**Termes à bannir car polysémiques aujourd'hui** :
- **« échu »** → **« en retard »**.
- **« expiré »** → réservé aux **équipements** (péremption), jamais aux actions.
- **« validé », « réalisé », « clôturé », « terminé », « fait »** → **« Traité »** (terme unique).
- **« en retard »** ne désigne plus jamais le seuil − 7 j (c'est « en retard critique »).

---

## 5. Matrice notion × page

✓ = utilisée · — = non · (!) = utilisée mais **calcul actuellement divergent** à corriger.

| Notion | Dashboard | Aujourd'hui | Échéances | Fiche agent | Fiche site | Stats | Exports (CSV/XLSX) | Rapports PDF |
|---|---|---|---|---|---|---|---|---|
| À traiter | ✓ (backlog) | ✓ | ✓ (base) | ✓ | ✓ | ✓ | ✓ (export actions) | — |
| Traité | ✓ (tendance) | ✓ (mon activité) | — | ✓ (validations/historique) | ✓ | ✓ (taux/délai) | ✓ | — |
| Remplacé | — | — | — | (back-office) | (back-office) | — | ✓ | — |
| Obsolète | — | — | — | ✓ (masquées) | ✓ | — | ✓ | — |
| Échéance | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ (visite/tournée : cadence) |
| Sans échéance | — | — | — (exclu) | ✓ | ✓ | — | ✓ | — |
| À venir | — | ✓ | ✓ | ✓ (< 7 j) | ✓ (< 7 j) | ✓ (soon) | — | — |
| Planifiée | — | — | ✓ (hors fenêtre) | ✓ | ✓ | — | ✓ | — |
| En retard | ✓ | (!) seuil −7 j | ✓ | ✓ | ✓ | ✓ (overdue) | — | — |
| En retard critique | ✓ (échéances crit.) | ✓ (rouge) | ✓ (groupe) | — | — | — | — | — |

> Cellules **(!)** = le seul recalcul de fond restant : « En retard » du Today utilise aujourd'hui le seuil − 7 j sous le même libellé que les autres écrans. À aligner sur `OVERDUE` strict (et exposer `OVERDUE_CRITICAL` à part) lors de l'implémentation.
>
> Note transverse : les **Rapports PDF** (session/visite/tournée) ne portent pas la notion d'échéance d'action ; ils utilisent la **conformité** (CONFORME/NON_CONFORME/À revoir) et, pour les visites/équipements, les **cadences** (trimestrielle 90 j, planifiée 180/365 j, péremption équipement) — vocabulaire distinct, à documenter séparément si besoin.

---

## 6. Décisions (toutes tranchées le 2026-06-27)

1. ✅ **« Traité »** : « Validé » (app) et « Réalisé » (Excel) **fusionnés** sous un terme unique « Traité » (vert). Origine conservée en interne, non exposée comme deux libellés.
2. ✅ **« Planifiée »** (`SCHEDULED`) : nom officiel de l'action à traiter d'échéance lointaine (`dueAt > auj+7j`). « À venir » reste strictement la fenêtre 7 jours.
3. ✅ **Compteurs en retard** : un seul total **« En retard : N (dont C critiques) »** ; pas de compteur « en retard récent » distinct. Le critique déclenche le rouge.
4. ✅ **Granularité** : borne unique **« aujourd'hui 00:00 Europe/Paris »** (remplacer les `new Date()` instantanés des requêtes d'échéance).
5. ✅ **Borne haute « à venir »** : **fin du 7ᵉ jour** incluse (`dueAt ≤ auj + 7j à 23:59:59`).

---

## 7. Invariants de cohérence (à garantir une fois implémenté)

- I1 — `À traiter` = `À venir` + `Planifiée` + `En retard` + `Sans échéance` (partition exacte des `ACTIVE` ; `En retard critique` est inclus dans `En retard`, pas un terme de la partition).
- I2 — `En retard critique ⊆ En retard` (jamais l'inverse ; jamais additionnés sous « en retard »).
- I3 — Statuts DB mutuellement exclusifs : `ACTIVE + VALIDATED_LOCAL + OBSOLETE + REPLACED = total`. Projection UI : **Traité** = `VALIDATED_LOCAL ∪ (OBSOLETE ∧ realizedAt≠null)` · **Obsolète** = `OBSOLETE ∧ realizedAt=null` (les deux partitionnent `OBSOLETE`).
- I4 — Un même libellé ⇒ un seul calcul, sur **toutes** les pages (Dashboard = Aujourd'hui = Échéances = Fiche = Stats).
- I5 — Tout compteur d'actions compte des **actions logiques dédupliquées** `(teamId, dedupHash)` (les `dedupHash` nuls comptent à l'unité).
- I6 — Aucune action `VALIDATED_LOCAL/OBSOLETE/REPLACED` ne porte d'état d'échéance.
