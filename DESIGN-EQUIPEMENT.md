# DESIGN-EQUIPEMENT.md — Modèle métier Équipement

> **Atelier de conception métier**.
> **Aucun code, aucun schéma Prisma, aucune migration.**
> **Date** : 2026-06-13.
> **Documents amont** : AUDIT.md, AUDIT-PRODUIT.md, VISION-V2.md, BACKLOG-V2.md, DECISIONS-SPRINT1.md.
> **Posture** : architecte logiciel + responsable métier conformité terrain.
> **Objectif** : fixer le périmètre, les concepts et les relations du modèle Équipement **avant** Sprint 4 (Hub Échéances) et Sprint 5 (QR Codes), pour éviter la dette structurelle.

---

## 0. TL;DR

**Oui, un modèle Équipement étendu est nécessaire** et doit être pensé comme une **évolution incrémentale** de `SiteEquipment` (et non un refactor).

**Quand** : début Sprint 4, juste avant US-5.2 (agrégateur Hub Échéances).

**Périmètre MVP** (Sprint 4) :
- Étendre `SiteEquipment` avec **3 champs** : `commissioningDate`, `nextCheckDate`, `expectedCheckFrequencyDays`.
- **Garder** `expirationDate`, `expectedQuantity`, `category` existants.
- **Renommer** mental `SiteEquipment` → **Équipement** sans renommer la table (compatibilité).

**Périmètre Sprint 5** :
- Nouveau modèle **EquipmentControl** (contrôle ponctuel hors visite).
- Ajout `qrToken` à `SiteEquipment` pour QR codes.

**À ne PAS faire en MVP** :
- Modèle **Local** : reporter V3+ (aucun cas d'usage validé aujourd'hui).
- Catégorisation hiérarchique de types : `category` texte libre suffit.
- Document attaché à un équipement (manuel, certificat) : modèle `RegulatoryDocument` séparé en V3.
- Historique de remplacement (équipement remplacé par un autre) : V3+.

**Bénéfice attendu** : Hub Échéances Sprint 4 alimenté par 3 sources clairement modélisées (péremption, contrôle périodique, renouvellement). QR Codes Sprint 5 cohérents. Pas de refactor V3.

---

## 1. Pourquoi un modèle Équipement ?

### 1.1 Problèmes actuels qu'il résout

**Problème 1 — Le catalogue d'équipement existe déjà mais sans vie**

`SiteEquipment` permet de lister « ce qui devrait être présent sur le site » (extincteurs, trousses, plans, etc.), mais le modèle ne porte que :
- Une **péremption** (`expirationDate`) — utile mais figée.
- Une **quantité attendue** (`expectedQuantity`).
- Un état d'**activité administratif** (`isActive`) — pas un état physique observable.

Il manque la notion de **cycle de vie observable** : quand a-t-il été mis en service ? Quand doit-on le contrôler à nouveau ? Quel est son état physique aujourd'hui ?

**Problème 2 — Les observations d'équipement sont noyées dans les visites**

Aujourd'hui, un agent ne peut « contrôler un extincteur » que dans le contexte d'une **visite de site** (mode INVENTORY) qui exige de cocher tous les équipements du site. Or la réalité terrain est différente : un agent qui passe devant un extincteur veut le vérifier en 10 secondes, **sans démarrer une visite formelle**.

Le manque : un **contrôle ponctuel** d'un équipement, indépendant des visites.

**Problème 3 — Aucune identification physique des équipements**

Un extincteur n°7 du local technique de POS-LYON ne peut être identifié que par un libellé textuel (« Extincteur N°7 CO2 2 kg »). Il n'a pas d'**identité technique stable** réutilisable. Conséquences :
- Pas de QR code par équipement (impossible à générer sans token).
- Pas de lien direct depuis une action vers « cet extincteur précis » (l'action référence le site, pas l'équipement).
- Pas de comparaison « photos de cet extincteur au fil du temps ».

### 1.2 Problèmes futurs qu'il résout (cadrage VISION-V2)

VISION-V2 ouvre 4 ambitions qui exigent un modèle Équipement plus riche :

**Ambition Hub Échéances (E5)** : agréger automatiquement les échéances de péremption + de contrôle + de renouvellement.
- Sans modèle Équipement étendu, le Hub ne peut produire que les péremptions (déjà couvert par `expirationDate`).
- Pour produire « extincteur à recontrôler dans 7 jours », il faut `nextCheckDate` ou un dérivé.

**Ambition QR Codes (E10)** : scanner un QR sur un objet physique → ouvrir sa fiche.
- Sans token stable par équipement, impossible.
- Le QR code d'un **site** ouvre la fiche site (OK avec modèle actuel). Le QR code d'un **équipement** exige `qrToken` ou équivalent.

**Ambition contrôles réglementaires** : enregistrer la vérification d'un objet périodiquement, avec preuve (photo, signature, audit).
- Sans modèle de contrôle, on est obligé de tout passer par les visites.

**Ambition conformité terrain** : taux de conformité par équipement, par site, par catégorie.
- Sans modèle d'événement de contrôle, les statistiques se reconstruisent imparfaitement à partir des `SiteVisitObservation` mode INVENTORY (trop chers à interroger en agrégat).

### 1.3 Que deviendraient les sujets V2 sans modèle Équipement ?

**Hub Échéances sans modèle étendu** :
- Couvre uniquement les péremptions (`SiteEquipment.expirationDate`) et les visites en retard (`SiteVisitTemplate.expectedFrequencyDays`).
- **Ne couvre pas** les contrôles périodiques d'équipement individuel ni les renouvellements.
- Conséquence : le manager doit ouvrir chaque site et faire le calcul mentalement. Promesse Hub Échéances trahie pour 50 % des cas.

**QR Codes sans modèle Équipement étendu** :
- QR Code de site : OK avec modèle actuel.
- QR Code d'équipement : **impossible**. Une URL `/qr/equipment/{id}?token=...` exige un `qrToken` côté équipement.
- Alternatives bricolées : QR redirige vers `/sites/{siteId}#equipement-{id}` ? Fragile, non sécurisé.

**Contrôles réglementaires sans modèle EquipmentControl** :
- Le seul moyen d'enregistrer une vérification reste la visite formelle.
- Pas de moyen pour un agent de tracer un contrôle ad-hoc.
- Impossibilité d'attester d'une vérification ponctuelle en cas d'incident.

**Verdict** : sans modèle Équipement étendu, V2 livre 50 % de la promesse VISION. Avec, on livre 90 %. La dette d'attente est dommageable.

---

## 2. Quels objets sont des Équipements ?

Critère de discrimination métier : un **Équipement** est un **objet physique** :
- **Observable** (on peut voir son état).
- **Contrôlable** (on peut vérifier sa conformité).
- **Soumis à une obligation** (réglementaire, sécurité, qualité).
- **Avec un cycle de vie** (mise en service, durée de vie, péremption ou recontrôle, fin de vie).
- **Identifiable** (par lui-même ou par lot).

### 2.1 Classement détaillé

| Élément | Catégorie | Justification |
|---|---|---|
| **Extincteur** | ✅ Équipement | Physique, observable (pression, plomb, état), contrôlable (vérification annuelle), réglementaire, cycle de vie clair (péremption + révision annuelle) |
| **Trousse de secours** | ✅ Équipement | Physique, contenu observable, péremption des compresses/médicaments, contrôle périodique, réglementaire |
| **AED / Défibrillateur** | ✅ Équipement | Physique, état observable (batterie, électrodes), contrôle mensuel obligatoire, péremption pads, réglementaire critique |
| **Douche de sécurité** | ✅ Équipement | Physique, contrôle mensuel obligatoire (jet, débit), équipement de sécurité |
| **Détecteur incendie** | ✅ Équipement | Physique, contrôle périodique, vérification trimestrielle, péremption batterie |
| **Alarme** | ✅ Équipement | Physique, contrôle périodique, test mensuel obligatoire |
| **Affichage obligatoire** (consignes, plan d'évacuation) | ✅ Équipement | Physique, observable (présent / dégradé / illisible), contrôle visuel périodique, réglementaire. *Cas particulier : un affichage est un équipement physique au sens contrôle. Un plan d'évacuation est un type d'affichage.* |
| **Registre papier** (sécurité, EPI, RUP) | ✅ Équipement | Cas particulier : objet physique (le cahier), observable (présent / à jour / lisible), contrôlable. *À traiter comme Équipement, pas comme document numérique.* |
| **EPI** (casque, harnais, lampe frontale) | ⚠ Cas particulier | Équipement **par lot** ou **par référence**, pas individuellement. Si un agent porte ses propres EPI, ils sont liés à un Agent + une habilitation. Si stock collectif (vestiaire), c'est de l'équipement de site. *Décision MVP : EPI collectifs uniquement (par lot). EPI individuels = reporté V3 avec habilitation.* |
| **Outillage soumis à contrôle** (manomètre, mégohmmètre étalonné) | ✅ Équipement | Physique, contrôle d'étalonnage périodique, certificat à conserver |
| **Local technique** | ❌ Non équipement | Contenant, pas contenu. Modèle `Local` séparé (optionnel V3) |
| **Local télécom** | ❌ Non équipement | Idem |
| **Poste** (au sens poste d'aiguillage SNCF) | ❌ Non équipement | C'est un **Site** au sens métier (déjà modélisé) |
| **Site** | ❌ Non équipement | Modélisé séparément, parent de l'équipement |
| **Agent** (personne) | ❌ Non équipement | Personne, modélisé séparément |
| **Habilitation** | ❌ Non équipement | Lien personne ↔ compétence avec date de validité. Modèle séparé (`AgentHabilitation`, prévu Sprint 5+) |
| **Formation** | ❌ Non équipement | Idem habilitation. Modèle séparé (`AgentFormation`, prévu post-V3) |
| **Procédure** (de veille) | ❌ Non équipement | Référentiel comportemental. Modèle séparé (existant) |

### 2.2 Cas limites explicitement traités

**Plan d'évacuation** : papier collé au mur → Équipement (affichage). Plan numérique consultable → Document.

**Manuel constructeur** d'un extincteur → Document attaché à l'équipement (V3, pas MVP). En attendant, champ `notes` de l'équipement peut contenir un lien.

**Certificat de conformité** d'une douche de sécurité → Document. Reporté V3.

**Bouteilles de gaz** (CO2, azote) → Équipement physique mais avec péremption stricte + recontrôle réglementaire. Couvert par MVP.

**Réserves de produits** (savon, désinfectant) → **Non équipement**. Consommables, à modéliser séparément si besoin (post-V3, probablement jamais).

**Batterie d'AED** → Cas particulier : c'est une **pièce remplaçable** de l'AED. Décision MVP : pas de sous-pièce, on suit la péremption au niveau AED entier. Si la batterie est changée, on met à jour `commissioningDate` ou `notes`.

**Documents obligatoires** (registre de sécurité, plan d'évacuation papier, consignes incendie) : déjà traités au-dessus → Équipement (objet physique).

### 2.3 Synthèse

**Équipement** = objet physique observable contrôlable.

Les autres catégories (Local, Document, Habilitation, Formation, Exercice, Procédure) sont des **modèles satellites distincts** ayant leur propre cycle de vie.

---

## 3. Modèle conceptuel

> Description en français métier. Aucun champ technique, aucun type SQL.

### 3.1 Équipement

**Définition** : objet physique présent sur un site, observable, contrôlable, soumis à un cycle de vie réglementaire.

**Attributs métier nécessaires** :

| Attribut | Rôle |
|---|---|
| **Identité technique** | Identifiant interne stable (déjà présent : id Prisma) |
| **Référence métier** | Code optionnel saisi par l'utilisateur (« EXT-014 », « TRS-N°2 ») pour identifier humainement |
| **Libellé** | Texte affiché (déjà présent : label) |
| **Type / catégorie** | Famille métier (Extincteur, Trousse, AED, Affichage, Registre, …) (déjà présent : category) |
| **Sous-type** (optionnel) | Précision (Extincteur CO2 2 kg, AED LifePak 1000) |
| **Site de rattachement** | Site parent (déjà présent : siteId, obligatoire) |
| **Local de rattachement** | Optionnel — local précis dans le site (V3+) |
| **Position descriptive** | Texte libre (« mur ouest », « derrière la porte ») — utile sans modèle Local |
| **État physique** | En service / Hors service / Réformé. *Différent de `isActive` qui est administratif.* |
| **Date de mise en service** | Quand cet équipement a été installé / déposé |
| **Quantité attendue** | Pour les équipements comptables (déjà présent : expectedQuantity) |
| **Périssable** | Booléen (déjà présent : isPerishable) |
| **Date de péremption** | Déjà présent (expirationDate) |
| **Date du dernier contrôle** | Dérivé du dernier EquipmentControl |
| **Date du prochain contrôle** | Calculée ou saisie (nextCheckDate) |
| **Fréquence de contrôle attendue** | En jours (expectedCheckFrequencyDays). Ex. 30 pour AED, 90 pour extincteur visuel, 365 pour révision extincteur |
| **Métadonnées spécifiques** | JSON souple pour les attributs propres au type (capacité L, classes feu, autonomie batterie). Évite la multiplication des colonnes nulles. *À éviter sauf besoin réel — MVP s'en passe.* |
| **Token QR** | Identifiant signé permettant le scan (V5, pas MVP). HMAC interne, non révélé hors PDF. |
| **Notes** | Texte libre (déjà présent : notes) |
| **Sort order** | Ordre d'affichage dans la catégorie (déjà présent) |
| **Visibilité administrative** | isActive (déjà présent) — différent de l'état physique |
| **Horodatages** | createdAt, updatedAt (déjà présents) |

**Cycle de vie métier** (états physiques possibles) :

```
[créé en catalogue] ──(mise en service)──→ [en service]
                                              │
                  ┌───────────────────────────┤
                  │                           │
                  ▼                           ▼
            [péremption]                [retiré du service]
                  │                           │
                  └───────────┬───────────────┘
                              ▼
                         [réformé]
                              │
                              ▼
                   [supprimé du catalogue]
                      (soft delete)
```

### 3.2 Site

**Lien avec Équipement** : un Site est **parent obligatoire** d'un Équipement. Un Équipement appartient à **un seul Site** (un extincteur n'est pas partagé entre 2 sites — s'il est déplacé, on le crée à nouveau sur l'autre site).

**Question : un site sans équipement, possible ?** Oui. Site peut être créé sans aucun équipement (déjà le cas).

**Question : un équipement sans site, possible ?** Non. Toujours rattaché.

**Évolution V3 possible** : pool d'équipements mobiles (transportables entre sites). Pas pour MVP.

### 3.3 Local

**Définition** : sous-contenant d'un site. Permet de regrouper les équipements par zone (local technique, local de graissage, salle de repos, local incendie).

**Faut-il créer ce concept ?** 

**Réponse MVP : non.**

Justifications :
1. Aujourd'hui les sites de Veille ont **3-15 équipements** chacun (extincteur, trousse, plan, registre). Une dénomination textuelle dans `position` suffit pour les distinguer.
2. Aucune fonctionnalité MVP ne requiert un objet Local distinct.
3. Modéliser Local en MVP = sur-engineering : il faudrait UI de création de local, lien obligatoire/optionnel, choix par défaut, etc.

**Quand réintroduire Local ?**
- Quand un site dépasse 30+ équipements et que les utilisateurs réclament un regroupement.
- Quand on veut un QR code dédié sur la porte d'un local (cf. VISION-V2 §10.3).
- Quand on a besoin de tracer l'entrée dans un local (audit physique).

**Décision** : non en MVP, **probable en V3** quand les QR codes équipements seront en service depuis 6+ mois et qu'un retour utilisateur le justifiera.

**Alternative pour MVP** : champ `position` texte libre sur l'équipement. Les utilisateurs écrivent « Local de graissage » ou « Salle de repos » comme ils veulent. Pas filtrable mais lisible.

### 3.4 Contrôle d'équipement (EquipmentControl)

**Définition** : événement ponctuel de vérification d'un équipement par un observateur, à une date précise, produisant un résultat (conforme / non conforme / sans objet) avec éventuellement photo(s), commentaire, et création d'une action corrective si NC.

**Différence avec une observation INVENTORY** :

| Critère | EquipmentControl | SiteVisitObservation INVENTORY |
|---|---|---|
| Contexte | Ponctuel, isolé | Dans une visite complète |
| Périmètre | 1 équipement | Tous les équipements d'un site |
| Durée | Quelques secondes | 30-60 min |
| Déclencheur | Initiative agent ou scan QR | Visite planifiée |
| Saisie | Modale rapide | Wizard de visite |
| Cas d'usage | « Je passe et je vérifie » | « Visite trimestrielle obligatoire » |

**Attributs métier nécessaires** :

| Attribut | Rôle |
|---|---|
| Identité | Id technique |
| Équipement contrôlé | Lien Équipement (obligatoire) |
| Observateur | User qui contrôle (obligatoire) |
| Date du contrôle | Horodatage (par défaut now) |
| Date attestée | Date que l'observateur attribue au contrôle (peut être différente de createdAt si saisie a posteriori) |
| Résultat | Conforme / Non conforme / Sans objet |
| Type d'écart | Si NC : Manquant / Périmé / Quantité insuffisante / Endommagé / Autre (champ libre) |
| Commentaire | Texte libre (obligatoire si NC, recommandé sinon) |
| Photos | 0 à N photos liées (Photo.equipmentControlId) |
| Action générée | Lien optionnel vers ImportedAction (si NC, action créée automatiquement) |
| Horodatages | createdAt |

**Comportement métier** :
- Un contrôle conforme met à jour le **dernier contrôle** de l'équipement (dérivé) et **avance le prochain contrôle** (`nextCheckDate = controlDate + expectedCheckFrequencyDays`).
- Un contrôle non conforme génère automatiquement une `ImportedAction` avec :
  - `equipmentId` = équipement contrôlé
  - `siteId` = hérité
  - `description` = formatée depuis le type d'écart + commentaire
  - `dueAt` = date du contrôle + N jours selon gravité (à paramétrer ou défaut 7 jours)
  - `responsible` = manager du site (à dériver)
  - `tags` = inclut « équipement » et la catégorie
- L'équipement reste « en service » jusqu'à validation manuelle de réformation (séparé de la NC).

### 3.5 Échéance

**Définition** (rappel VISION-V2 §8) : représentation unifiée des choses à faire / à traiter. **Pas une entité de base de données stockée** — c'est une **vue dérivée** calculée par l'agrégateur Hub Échéances.

**Sources d'échéances générées depuis un Équipement** :

1. **Péremption** :
   - Condition : `expirationDate < today + N` (N selon urgence).
   - Urgence : retard si déjà passé, P0 si < 7 j, P1 si < 30 j, P2 si < 90 j.
   - Label : « Extincteur N°7 — péremption le {date} ».
   - CTA : « Inventaire » ou « Remplacer ».

2. **Contrôle périodique à faire** :
   - Condition : `nextCheckDate < today + N`.
   - Urgence : retard si dépassé, P0 si < 7 j.
   - Label : « Trousse local repos — contrôle prévu le {date} ».
   - CTA : « Contrôler maintenant » (ouvre la modale EquipmentControl).

3. **Renouvellement / révision réglementaire** :
   - Condition : équipement avec `commissioningDate + duréeVieMaxLégale < today + N`.
   - *Implémentation avancée — peut attendre V3.*

**Comportement de la dérivation** :
- L'agrégateur Hub Échéances scanne `SiteEquipment` chaque exécution (pas de table échéance stockée).
- Filtres : par site, par catégorie, par responsable.
- Tri : par urgence puis priorité.

**Décision MVP** : 2 types d'échéances (péremption + contrôle périodique). Le renouvellement réglementaire arrive en V3.

### 3.6 QR Code

**Définition** : token signé HMAC attaché à un équipement, permettant l'identification physique via scan.

**Modèle métier** :
- Stocké comme un attribut `qrToken` de l'équipement (string court ~16 caractères, signé).
- URL générée : `https://veille.app/qr/equipment/{token}` (le serveur résout le token vers l'équipement).
- Le token est **stable** (pas régénéré à chaque visite) sauf si l'admin force une régénération (équipement volé, vandalisé).

**Pourquoi token et non `equipment.id` directement ?**
- Sécurité : l'id Prisma (`cuid`) est devinable séquentiellement à grande échelle. Le token HMAC est non devinable.
- Révocabilité : on peut invalider un token sans changer l'id.

**Comportement métier** :
- À la création d'un équipement : token non généré (équipement non scannable).
- L'admin choisit explicitement de générer un QR pour un équipement (`/admin/qr-codes` permet la génération par site / par catégorie).
- Le PDF imprimable contient le QR + libellé + position pour faciliter le collage physique.
- Au scan, l'app résout le token, vérifie sa validité, redirige vers `/equipment/{id}` avec un bandeau « 🎯 Équipement identifié ».

**Décision MVP (Sprint 5, pas Sprint 4)** : ajout du champ `qrToken` au modèle Équipement, génération possible depuis `/admin/qr-codes` (E10-F1).

### 3.7 Photo

**Comment relier les photos à un équipement ?**

Aujourd'hui, `Photo` est polymorphe (peut être rattachée à observation, sighting, agent sighting, site sighting). Il faut ajouter deux nouvelles relations :

1. `Photo.equipmentId` (optionnel) : photo générique de l'équipement (état actuel, photo de référence prise par admin à la mise en service).
2. `Photo.equipmentControlId` (optionnel) : photo d'un contrôle ponctuel (preuve de NC).

**Cas d'usage des photos d'équipement** :
- Référence : photo prise à la mise en service, sert de base de comparaison.
- Contrôle : photo prise lors d'un EquipmentControl, prouve l'état au moment T.
- Observation INVENTORY : photo prise lors d'une visite (déjà couvert par `Photo.observationId`).

**Décision MVP** : ajouter les 2 nouvelles relations. La galerie photo par équipement (V-07 du backlog) consomme ces relations + l'historique observation INVENTORY.

### 3.8 Action corrective

**Comment relier les actions correctives à un équipement ?**

Aujourd'hui, `ImportedAction.siteId` lie une action à un site. Mais pas à un équipement spécifique. Conséquence : une action « extincteur N°7 à remplacer » est attachée au site, pas à l'extincteur, et la fiche de l'extincteur n'a pas connaissance de l'action ouverte.

**Évolution MVP** : ajouter `ImportedAction.equipmentId` (optionnel).

**Sources de création d'action liée à équipement** :
1. EquipmentControl avec résultat NC → action générée automatiquement.
2. SiteVisitObservation mode INVENTORY avec écart → action générée (cas déjà existant — étendre pour porter equipmentId).
3. Création manuelle depuis la fiche équipement (« Signaler un problème »).

**Comportement métier** :
- Une action liée à un équipement est visible **à la fois** sur la fiche site (cohérent avec l'existant) et **sur la fiche équipement** (nouveau).
- Validation d'action : si l'action a un equipmentId, la validation peut optionnellement mettre à jour l'état de l'équipement (ex. « extincteur remplacé » → mise à jour `commissioningDate`).

**Décision MVP** : ajout du champ `equipmentId` à `ImportedAction`. Logique de mise à jour état équipement reportée V3.

---

## 4. Cas d'usage détaillés

> 5 scénarios métier complets, vu côté utilisateur, sans détail technique.

### 4.1 Contrôle d'une trousse de secours

**Contexte** : Pierre, agent à l'EIC RA, passe devant la trousse de secours dans la salle de repos du poste de Peyraud. Il a 2 minutes, il décide de vérifier.

**Parcours** :
1. Pierre ouvre l'app Veille sur son smartphone.
2. Sur l'écran « Aujourd'hui » ou « Mon contrôle », il appuie sur **« 📷 Scanner un QR »**.
3. Il vise le QR collé sur la trousse → vibration de confirmation.
4. L'app ouvre `/equipment/{id}` avec bandeau **« 🎯 Trousse de secours · Salle de repos · POS-Peyraud »**.
5. La fiche affiche :
   - Photo de référence de la trousse (prise à l'installation).
   - Date du dernier contrôle (il y a 26 jours).
   - Prochain contrôle attendu (dans 4 jours).
   - Liste du contenu attendu (compresses 10×10 cm, sparadrap, sérum physiologique, paire de gants vinyle, couverture de survie).
   - Bouton **« ✓ Contrôler maintenant »** en CTA flottant.
6. Pierre tape sur « Contrôler maintenant ».
7. Une modale (bottom-sheet) s'ouvre :
   - Question : « Conforme ? »
   - 3 boutons grands : ✓ Conforme · ✗ Non conforme · — Sans objet.
   - Si NC : champ « Type d'écart » (Manquant / Périmé / Endommagé / Quantité insuffisante / Autre).
   - Champ commentaire optionnel.
   - Bouton « 📷 Photo » optionnel.
8. Pierre constate qu'il manque 2 compresses. Il tape **✗ Non conforme**, choisit « Quantité insuffisante », ajoute le commentaire « 3 compresses sur 5 », prend une photo de l'intérieur de la trousse.
9. Il tape **« Enregistrer »**.
10. Toast vert : « Contrôle enregistré · Action créée pour réapprovisionnement ».
11. La fiche équipement se met à jour :
    - Dernier contrôle = maintenant.
    - Prochain contrôle = aujourd'hui + 30 jours.
    - Section « Actions ouvertes » : 1 action « Réapprovisionner trousse : compresses » créée, échéance dans 7 jours.
12. Pierre referme l'app. Total : 90 secondes.

**Effets de bord** :
- AuditLog : entrée EQUIPMENT_CONTROL_CREATED + ACTION_AUTO_GENERATED.
- Notifications : le responsable du site est notifié de la nouvelle NC (Sprint 5 push).
- Échéances : la NC apparaît dans l'écran « Aujourd'hui » du responsable jusqu'à clôture.

### 4.2 Contrôle d'un extincteur

**Contexte** : Marie, responsable d'équipe, fait sa tournée trimestrielle. Elle vérifie tous les extincteurs du poste de Lyon.

**Parcours** :
1. Marie ouvre Veille sur sa tablette.
2. Elle va sur la fiche du site POS-LYON.
3. Section « Équipements » : 4 extincteurs listés avec badge couleur (vert / jaune / rouge selon péremption et prochain contrôle).
4. Elle tape sur le premier extincteur EXT-001.
5. La fiche montre : photo de référence, position « Hall d'entrée », pression nominale, dernière révision il y a 11 mois.
6. Elle tape **« Contrôler »** en CTA.
7. Modale bottom-sheet :
   - 5 checks rapides à cocher : Pression OK / Plomb intact / Étiquette lisible / Sans obstruction / Sans dommage visible.
   - Bouton « Tout cocher » si tout est OK (raccourci pour les 95 % des cas).
   - Bouton **« ✓ Conforme »** s'active quand tout est coché.
   - Bouton **« ✗ Non conforme »** ouvre détail (type d'écart + commentaire + photo obligatoire).
8. Marie coche tout, tape « ✓ Conforme ».
9. Toast vert : « Contrôle enregistré ».
10. Retour automatique à la liste des équipements du site, l'extincteur EXT-001 passe en vert. Elle enchaîne sur EXT-002.

**Différences avec une visite formelle** :
- Pas de header de visite à ouvrir / clôturer.
- Pas de saisie de participants.
- Pas de NC formelle à composer si tout est OK.
- Ne s'inscrit pas dans une visite (mais peut être agrégé statistiquement).

### 4.3 Contrôle périodique d'un équipement (déclenché par échéance)

**Contexte** : le système identifie que le contrôle mensuel d'un AED arrive demain.

**Parcours** (côté manager) :
1. Cron quotidien 7h détecte : AED LifePak du site POS-LYON a `nextCheckDate = demain`, `expectedCheckFrequencyDays = 30`.
2. L'agrégateur Hub Échéances génère une échéance « Contrôle AED » P1 pour aujourd'hui (visible aujourd'hui = anticipation 1 j).
3. Email matin 7h au responsable POS-LYON : « 1 échéance équipement aujourd'hui ».
4. Push notification (Sprint 5) au même moment.
5. Le manager ouvre Veille → écran « Aujourd'hui » : carte « À traiter aujourd'hui » avec **« 🟠 AED LifePak · contrôle mensuel · aujourd'hui »**.
6. Tap → ouvre la fiche équipement avec contexte d'échéance.
7. Le manager tape **« Contrôler maintenant »** ou délègue à un agent (assignation).
8. Une fois le contrôle effectué (cas 4.2), l'échéance disparaît automatiquement de l'écran « Aujourd'hui ».
9. `nextCheckDate` est mis à jour : aujourd'hui + 30 jours.

**Effets de bord** :
- Si le manager ignore l'échéance plusieurs jours : passe en retard, P0, bannière rouge.
- Si manager change de personnel pendant le contrôle (autre agent l'effectue), l'auteur du EquipmentControl est l'agent qui a saisi, pas le manager.

### 4.4 Scan QR Code

**Contexte** : un agent intervient sur un site qu'il ne connaît pas bien. Il veut identifier rapidement un équipement.

**Parcours** :
1. L'agent ouvre Veille → écran « Aujourd'hui ».
2. Il tape le raccourci **« 📷 Scanner QR »**.
3. La caméra arrière s'ouvre, viseur ciblant le QR.
4. L'agent vise le QR sur l'extincteur → décodage automatique.
5. L'URL résolue est `/qr/equipment/{token}`.
6. Le serveur vérifie le token HMAC, identifie l'équipement, retourne `/equipment/{id}` avec contexte.
7. La fiche s'ouvre avec bandeau **« 🎯 Extincteur EXT-014 · POS-LYON · Hall d'entrée »**.
8. CTA proposés contextuels :
   - **« ✓ Contrôler »** (si dernier contrôle > 7 jours).
   - **« 📋 Voir l'historique »** (sinon).
   - **« 🚨 Signaler un problème »** (création action manuelle).

**Cas spéciaux** :
- **QR de site** : ouvre `/sites/{id}` avec propositions Démarrer visite / Démarrer veille / Vu / Note.
- **QR de local** (V3) : ouvre `/sites/{id}#local-{localId}` avec la liste des équipements du local pré-déroulée.
- **Token invalide ou expiré** : page d'erreur « QR code non reconnu. Contactez l'admin. »
- **Token de site d'une autre équipe** : page d'erreur « Ce site n'est pas dans votre périmètre. »

**Logs** :
- Chaque scan génère une entrée AuditLog (qui a scanné quoi quand). Permet de tracer la fréquentation physique des sites.

### 4.5 Création automatique d'une action

**Contexte** : un EquipmentControl avec résultat NC déclenche la création d'une action corrective.

**Parcours** (vue système) :
1. Pierre (cas 4.1) saisit un contrôle NC sur la trousse (« 3 compresses sur 5 »).
2. À l'enregistrement, l'app appelle le service de création d'action :
   - `equipmentId` = id de la trousse
   - `siteId` = id de POS-Peyraud (hérité)
   - `teamId` = équipe parent du site
   - `agentId` = null (action liée à équipement, pas à agent)
   - `description` = « Trousse de secours : Quantité insuffisante — 3 compresses sur 5 »
   - `comment` = commentaire Pierre + référence au EquipmentControl
   - `dueAt` = aujourd'hui + 7 jours (réapprovisionnement standard)
   - `responsible` = manager principal du site (à dériver via SiteTeam.role MANAGER ou Site.contactIds)
   - `tags` = [« équipement », « trousse de secours », « approvisionnement »]
   - `originalStatus` = "ACTIVE"
   - `dedupHash` = SHA1(equipmentId + type d'écart + dueAt jour)
3. L'action est créée avec `localStatus = "ACTIVE"`.
4. Le EquipmentControl stocke `generatedActionId` pour traçabilité bidirectionnelle.
5. Au prochain agrégateur Hub Échéances, cette action apparaît :
   - Dans « Aujourd'hui » du manager.
   - Dans la liste actions à traiter de la trousse.
   - Dans les statistiques NC ouvertes du site.
6. Le manager peut **valider** l'action (cas existant) → l'action passe `VALIDATED_LOCAL`, disparaît de la file.
7. Optionnel V3 : la validation peut **mettre à jour** l'état de l'équipement (« réapprovisionné » = nouvelle photo de référence).

**Comportement de dédup** : si le même contrôle révèle la même NC le lendemain (parce qu'on n'a pas encore réapprovisionné), le hash dédup empêche la création d'un doublon. L'action existante voit son `lastSeenAt` mis à jour.

---

## 5. Impact sur la roadmap

### 5.1 Hub Échéances (E5, Sprint 4)

**Sans modèle Équipement étendu** :
- Le Hub agrège : actions importées (par `dueAt`), visites en retard (par `expectedFrequencyDays`), sessions brouillon. C'est tout.
- Les péremptions d'équipement utilisent `expirationDate` existant (OK partiellement).
- Aucune notion de contrôle périodique manqué d'un équipement individuel.

**Avec modèle Équipement étendu (MVP proposé)** :
- Le Hub agrège en plus : équipements avec `nextCheckDate < today + N`.
- Sources d'échéances passe de 4 à 6 (péremption + contrôle périodique nouveaux).
- Le Hub devient une vraie centrale de contrôle réglementaire.

**Dépendance d'implémentation** :
- Sprint 4 Story US-5.2 (agrégateur Hub Échéances) **doit consommer** les nouveaux champs.
- Donc l'extension de `SiteEquipment` (commissioningDate, nextCheckDate, expectedCheckFrequencyDays) doit être **un commit dans Sprint 4 ANTÉRIEUR à US-5.2**.

### 5.2 QR Codes (E10, Sprint 5)

**Sans modèle Équipement étendu** :
- QR codes uniquement sur sites. Tous les autres scénarios sont impossibles.

**Avec modèle Équipement étendu** :
- QR codes sur équipements + locaux (V3+) + visites.
- Scénario complet § 4.4 réalisable.

**Dépendance d'implémentation** :
- Sprint 5 Story US-10.2 (QR équipement) **nécessite** `qrToken` sur `SiteEquipment`.
- Donc ajout de `qrToken` doit être fait **dans Sprint 5 avant US-10.2**, ou **anticipé Sprint 4** si on veut pré-générer.

### 5.3 Dashboard Manager (E6, Sprint 4)

**Sans modèle Équipement étendu** :
- Dashboard manager montre : visites en retard, agents à veiller, NC ouvertes consolidées.
- Pas de focus équipement (« 12 équipements à contrôler cette semaine »).

**Avec modèle Équipement étendu** :
- Nouvelle section possible : « Équipements à contrôler ».
- Indicateur « Taux de contrôle à jour » (% d'équipements avec dernier contrôle dans la fréquence attendue).
- Top équipements en retard de contrôle.

**Dépendance d'implémentation** :
- Dashboard Manager US-6.1 (Sprint 4) bénéficie immédiatement, sans dépendance bloquante.
- Pas de blocage : le dashboard livré sans modèle Équipement reste utile ; l'ajout du modèle l'enrichit.

### 5.4 Écran Aujourd'hui (E3, déjà Sprint 2)

**Sans modèle Équipement étendu (Sprint 2)** :
- Section « À traiter aujourd'hui » montre actions importées + visites planifiées + NC.

**Avec modèle Équipement étendu (Sprint 4+)** :
- Section enrichie avec « Contrôler aujourd'hui : 2 équipements ».
- Pas de refactor de l'écran, ajout d'un nouveau type d'échéance.

**Dépendance** : Sprint 2 livre l'écran sans modèle ; Sprint 4 enrichit. Pas de blocage.

### 5.5 Notifications (E7, Sprint 4-5)

**Sans modèle Équipement étendu** :
- Email récap hebdo manager montre : volume veilles, visites, validations.
- Push : actions échéance retard.

**Avec modèle Équipement étendu** :
- Email récap enrichi : équipements contrôlés, équipements en retard.
- Push : alerte péremption critique (extincteur ce mois, AED batterie demain).

**Dépendance** : compatibilité ascendante. Notifications enrichissables progressivement.

### 5.6 Synthèse d'impact

| Sprint | Livrable | Dépendance modèle Équipement étendu |
|---|---|---|
| Sprint 2 | Écran Aujourd'hui USER | Aucune (n'a pas besoin) |
| Sprint 3 | Page profil + voix + offline | Aucune |
| **Sprint 4** | Hub Échéances + Dashboard Manager | **Oui — 3 champs minimum (commissioningDate, nextCheckDate, expectedCheckFrequencyDays)** |
| Sprint 4 | Source d'échéance « contrôle périodique » | **Oui — directement dépendant** |
| **Sprint 5** | QR Codes équipement | **Oui — qrToken + EquipmentControl** |
| Post-V3.0 | Galerie photo, Local, hiérarchie | Photo.equipmentId déjà prévu MVP |

**Conclusion impact roadmap** : ajout du modèle équipement étendu est **bloquant Sprint 4** (mais limité à 3 champs en MVP). Pas de blocage Sprints 1-3.

---

## 6. MVP — Version minimale réaliste

### 6.1 Principe directeur du MVP

**Étendre sans refactor.** On garde `SiteEquipment` comme base, on ajoute des champs strictement nécessaires aux Sprints 4-5, on crée 1 nouveau modèle (EquipmentControl). Pas de Local, pas de Document, pas de catégorisation hiérarchique.

### 6.2 Champs à ajouter à `SiteEquipment` (MVP)

| Champ | Type métier | Obligatoire ? | Pourquoi |
|---|---|---|---|
| `commissioningDate` | Date | Optionnel | Cycle de vie + référence pour comparaison |
| `nextCheckDate` | Date | Optionnel | Source d'échéance « contrôle périodique » |
| `expectedCheckFrequencyDays` | Entier (jours) | Optionnel | Calcul automatique du prochain contrôle après EquipmentControl |
| `qrToken` (Sprint 5) | String court signé | Optionnel | Identification physique scan |
| `referenceCode` | String court | Optionnel | Code métier humain (« EXT-014 ») |
| `position` | String libre | Optionnel | Localisation textuelle dans le site sans modèle Local |
| `physicalState` | Enum (En service / Hors service / Réformé) | Obligatoire par défaut « En service » | État physique distinct de l'état admin `isActive` |

**Total** : 7 nouveaux champs sur `SiteEquipment`. Tous optionnels (sauf physicalState avec défaut). Migration safe : aucun impact sur données existantes.

### 6.3 Nouveau modèle `EquipmentControl` (MVP)

| Attribut | Type métier | Obligatoire |
|---|---|---|
| Id technique | Identifiant | Oui |
| Équipement contrôlé | Lien Équipement | Oui |
| Observateur | Lien User | Oui |
| Date du contrôle | Date+heure | Oui (défaut now) |
| Résultat | Enum (CONFORME / NON_CONFORME / SANS_OBJET) | Oui |
| Type d'écart | String court | Oui si NC |
| Commentaire | Texte libre | Optionnel (obligatoire si NC selon settings) |
| Action générée | Lien optionnel ImportedAction | Optionnel |
| Horodatage technique | createdAt | Oui |

### 6.4 Évolutions des modèles existants

**`Photo`** : ajouter `equipmentId` (optionnel) et `equipmentControlId` (optionnel).

**`ImportedAction`** : ajouter `equipmentId` (optionnel).

### 6.5 Ce qui N'EST PAS dans le MVP

- Modèle **Local** : reporté V3.
- **Document attaché** à un équipement (manuel, certificat) : reporté V3 via modèle `RegulatoryDocument` séparé.
- **Catégorisation hiérarchique** des types (Extincteur → CO2 → 2 kg) : `category` reste texte libre.
- **Métadonnées spécifiques type** (capacité L, classes feu) : champ JSON non créé en MVP — `notes` texte libre suffit.
- **Historique de remplacement** (équipement remplacé par un autre, traçabilité de la succession) : reporté V3.
- **Sous-pièces** (batterie d'AED comme entité distincte) : reporté V3.

### 6.6 Fonctionnalités MVP côté UI

- **Fiche équipement enrichie** : nouveaux champs édités dans `/admin/sites/[id]` section équipements + bouton « Contrôler maintenant ».
- **Modale EquipmentControl** : bottom-sheet sur mobile, modal sur desktop.
- **Génération automatique d'action** si NC (logique serveur).
- **Bouton « Contrôler »** sur la fiche équipement.
- **Section « Derniers contrôles »** sur la fiche équipement (chronologique).

### 6.7 Migration des données MVP

Aucune migration de données nécessaire : les nouveaux champs sont optionnels et l'existant continue de fonctionner sans modification.

Migration prévue **manuelle** (à l'initiative des managers) :
- Pour chaque équipement existant, saisir `commissioningDate` (estimation), `expectedCheckFrequencyDays` (selon type), `nextCheckDate` (calculé ou saisi).
- Outil admin proposé : « Import CSV de contrôles initiaux » (post-MVP si volumétrie justifie).

---

## 7. V2 / V3 — Évolutions futures possibles

### 7.1 V3 — Réintroduction du concept Local

Quand le nombre d'équipements par site dépasse 30 ou qu'un site a 3+ locaux distincts, introduire :
- Modèle `Location` (Local) : Site parent, label, type (technique / repos / électrique / …), qrToken.
- `SiteEquipment.locationId` (optionnel).
- UI : sections par local sur la fiche site, filtres par local sur l'inventaire.
- QR codes de porte de local : scan ouvre la liste filtrée du local.

### 7.2 V3 — Documents attachés (Manuel constructeur, Certificat)

Modèle `RegulatoryDocument` séparé :
- Lien Site ou Équipement (optionnel).
- Type (Manuel / Certificat / Procédure constructeur / Autorisation / …).
- Date d'émission, date d'expiration optionnelle.
- Fichier PDF stocké.
- Permet une échéance « certificat à renouveler ».

### 7.3 V3 — Catégorisation hiérarchique

Si la diversité des équipements explose (>50 types), introduire un modèle `EquipmentType` :
- Hiérarchie (Extincteur → Extincteur CO2 → Extincteur CO2 2 kg).
- Métadonnées par défaut (frequencyDays, lifeYears, etc.) appliquées à la création.
- Permet la statistique « taux conformité par type ».

### 7.4 V3 — Historique de remplacement

Quand un équipement est réformé puis remplacé :
- Création d'un nouveau `SiteEquipment` avec lien `replacesId` vers l'ancien.
- Permet de tracer la lignée d'un emplacement.
- Statistiques « durée de vie moyenne par type ».

### 7.5 V3 — Sous-pièces et consommables

Si le besoin de tracer les pièces remplaçables émerge :
- Modèle `EquipmentPart` lié à `Equipment` parent.
- Cycle de vie propre (batterie remplacée à T+18 mois).

### 7.6 V4+ — Intégration GMAO

Quand multi-équipes industrialisé :
- Webhook sortant vers GMAO existante (Maximo, SAP EAM).
- Bidirectionnel : actions Veille → tickets GMAO.

---

## 8. Risques

### 8.1 Risque de surconception

**Symptômes potentiels** :
- Ajout de Local en MVP alors que les sites actuels ont 3-10 équipements en moyenne.
- Modèle de catégorisation hiérarchique pour 8 types d'équipements aujourd'hui.
- Métadonnées JSON spécifiques type avec 30 attributs par catégorie.
- Sous-pièces et consommables modélisés sans cas d'usage validé.

**Conséquences** :
- UI surchargée à la création d'équipement (10+ champs à remplir).
- Friction d'adoption : un manager ne veut pas saisir 10 champs pour un extincteur.
- Maintenance coûteuse, complexité fonctionnelle inutile.

**Mitigation** :
- MVP strict : 7 nouveaux champs `SiteEquipment` + 1 nouveau modèle. Pas plus.
- Tous les champs optionnels (sauf `physicalState` avec défaut).
- Test utilisateur en Sprint 4 : un manager doit pouvoir saisir un équipement en < 30 secondes.
- Saisie en bulk via import CSV pour migration initiale (pas par UI).

### 8.2 Risque de sous-conception

**Symptômes potentiels** :
- Pas de `qrToken` ajouté en Sprint 4 → bloque Sprint 5 QR codes (refactor en cours de sprint).
- Pas de `nextCheckDate` → Hub Échéances incomplet, refactor coûteux.
- Pas de lien `Photo.equipmentId` → galerie photo équipement difficile à implémenter V3.
- Modèle EquipmentControl absent → contrôles ponctuels impossibles, on revient aux visites lourdes.

**Conséquences** :
- Dette structurelle qui se paye au double en V3.
- Frustration utilisateur : « pourquoi je peux pas contrôler juste mon extincteur sans démarrer une visite ? »
- Promesse VISION-V2 partiellement tenue.

**Mitigation** :
- Le MVP proposé couvre tous les besoins **identifiés** Sprint 4-5.
- Ajout incrémental : chaque sprint ajoute ce qui est nécessaire à son périmètre.
- Validation MVP avant Sprint 4 : revue de ce document + check-list des dépendances.

### 8.3 Risque de complexité excessive

**Symptômes potentiels** :
- Coexistence confuse Équipement / Local / Document / Habilitation / Exercice → l'utilisateur ne sait plus quoi créer.
- Multi-modèles satellites mal délimités → données dupliquées (un certificat de douche stocké à la fois comme Photo, comme Document, comme observation).
- Logique métier dispersée : génération auto d'action depuis EquipmentControl + visite INVENTORY + import Excel → 3 voies pour le même résultat.

**Mitigation** :
- **Frontière claire** entre les 5 modèles satellites (Équipement / Local / Document / Habilitation / Exercice).
- **Une seule source de vérité** pour chaque type de donnée (une photo n'est jamais à la fois `Photo.equipmentId` et `Photo.observationId` — on choisit).
- **Logique métier centralisée** : la création automatique d'action depuis NC (quelle qu'en soit la source) passe par un seul service `generateActionFromNonConformity`.

### 8.4 Risques d'implémentation (techniques mais à mentionner)

| Risque | Mitigation |
|---|---|
| Index manquant sur `SiteEquipment.nextCheckDate` (pour Hub Échéances) | Audit lors du Sprint 4 |
| Migration de données existantes : ~aucune en prod aujourd'hui ? | À valider en Sprint 4 prep |
| Conflit dédup hash actions auto-générées : déjà résolu par `dedupHash` existant | Compatible |
| Performance du calcul Hub Échéances sur 1000+ équipements | Index + cache éventuel post-V3 |

---

## 9. Décision finale

### 9.1 Faut-il créer un modèle Équipement ?

**Oui**, sous la forme **d'extension incrémentale** de `SiteEquipment` + nouveau modèle `EquipmentControl`.

**Non** comme refactor disruptif. `SiteEquipment` reste le pivot.

### 9.2 Quand ?

- **Sprint 1 (maintenant)** : rédaction de ce document. **Aucun code, aucune migration.**
- **Sprint 4 (M4)** : extension `SiteEquipment` (3 champs : `commissioningDate`, `nextCheckDate`, `expectedCheckFrequencyDays`). **Avant US-5.2 (agrégateur Hub Échéances)**.
- **Sprint 4 ou 5** : nouveau modèle `EquipmentControl` + UI contrôle ponctuel + lien `Photo.equipmentControlId` + lien `ImportedAction.equipmentId`.
- **Sprint 5** : ajout `qrToken` à `SiteEquipment` + ajout `referenceCode` + `position` + `physicalState`. **Avant US-10.2 (QR équipement)**.

### 9.3 Avant ou après le Hub Échéances ?

**Avant** (Sprint 4 ouvre par l'extension du modèle, puis US-5.2 consomme).

Justification : Hub Échéances tire 30 % de sa valeur du modèle Équipement étendu. Sans, on livre un Hub bancal qu'il faut refactorer.

### 9.4 Avant ou après les QR Codes ?

**Avant** (Sprint 5 ouvre par l'ajout de `qrToken` + EquipmentControl si non fait Sprint 4, puis US-10.x).

Justification : sans `qrToken`, US-10.2 (génération QR équipement) ne peut être implémentée.

### 9.5 Quel périmètre minimal faut-il implémenter ?

**Périmètre Sprint 4 (MVP cœur)** :
1. Extension `SiteEquipment` : 3 champs (`commissioningDate`, `nextCheckDate`, `expectedCheckFrequencyDays`).
2. Modèle nouveau `EquipmentControl` (id, equipmentId, observerId, controlDate, result, discrepancyType, comment, generatedActionId).
3. Lien `Photo.equipmentId` et `Photo.equipmentControlId`.
4. Lien `ImportedAction.equipmentId`.
5. UI minimale : bouton « Contrôler » sur fiche équipement + modale bottom-sheet.
6. Génération automatique d'action si NC.
7. Source d'échéance « contrôle périodique » dans l'agrégateur Hub Échéances.

**Périmètre Sprint 5 (compléments QR)** :
1. `SiteEquipment.qrToken`, `referenceCode`, `position`, `physicalState`.
2. Génération QR équipement (E10-F1 US-10.2).
3. Résolution scan QR équipement (E10-F2 US-10.4).

**Non livré V2** : Local, Documents attachés, catégorisation hiérarchique, sous-pièces, historique de remplacement.

### 9.6 Recommandation ferme

**Action immédiate** : ce document est l'atelier conceptuel. Aucune action de développement requise jusqu'au Sprint 4.

**Sprint 4 préparation** : avant d'ouvrir Sprint 4, relire ce document, valider que les hypothèses tiennent (ex. nombre d'équipements par site, fréquences de contrôle réelles auprès des managers réels). Ajuster si nécessaire.

**Sprint 4 ordre d'implémentation** :
1. Extension `SiteEquipment` (3 champs) — premier commit du Sprint 4.
2. UI admin pour saisir les nouveaux champs sur équipements existants.
3. Agrégateur Hub Échéances (US-5.2) consomme les nouveaux champs.
4. Modèle `EquipmentControl` + UI contrôle ponctuel + actions auto.
5. Continuer Sprint 4 normalement.

**Sprint 5 ordre d'implémentation** :
1. Compléments `SiteEquipment` (qrToken, referenceCode, position, physicalState).
2. Génération + scan QR équipement (E10).
3. Continuer Sprint 5 normalement.

**Validation produit avant Sprint 4** :
- Réunion 30 min avec un manager terrain pour valider :
  - Les types d'équipements MVP correspondent à la réalité.
  - Les fréquences de contrôle typiques (extincteur 90 j, AED 30 j, etc.).
  - L'utilisabilité du parcours « Contrôler maintenant ».

---

## 10. Annexes

### 10.1 Glossaire métier

- **Équipement** : objet physique observable contrôlable, parent obligatoire = Site.
- **EquipmentControl** : événement ponctuel de vérification d'un équipement.
- **Site** : lieu physique parent (poste d'aiguillage, gare, dépôt, local technique au sens lieu).
- **Local** (V3) : sous-contenant d'un site.
- **Action corrective** : ImportedAction générée depuis une NC ou créée manuellement.
- **NC (Non-Conformité)** : résultat « non conforme » d'un contrôle ou d'une observation.
- **Échéance** : item à traiter, dérivé d'une source (action, visite, équipement, …) par l'agrégateur Hub Échéances.
- **qrToken** : identifiant signé HMAC permettant le scan QR sans révéler l'id technique.

### 10.2 Mapping des modèles V2 (vue d'ensemble)

```
Site
 └── SiteEquipment (= Équipement) ← MVP étendu
      ├── nouveaux : commissioningDate, nextCheckDate, expectedCheckFrequencyDays,
      │             qrToken (Sprint 5), referenceCode, position, physicalState
      ├── EquipmentControl ← MVP nouveau
      │    ├── Photo (via equipmentControlId)
      │    └── ImportedAction (via generatedActionId)
      ├── Photo (via equipmentId — référence)
      ├── ImportedAction (via equipmentId — lien direct)
      └── SiteVisitObservation (existant, lien équipement via equipmentId)

Site (futur V3)
 └── Location (Local)
      └── SiteEquipment (localId)

Site (futur V3)
 └── RegulatoryDocument

Agent (existant)
 └── AgentHabilitation (Sprint 4+)
 └── AgentFormation (post-V3)
```

### 10.3 Vérification : ce document est complet ?

| Section demandée | Couverte | Localisation |
|---|---|---|
| Périmètre | ✅ | §2 |
| Concepts métier | ✅ | §3 |
| Relations | ✅ | §3, §10.2 |
| Usages futurs | ✅ | §5 |
| Impacts sur la roadmap | ✅ | §5 |
| Cas d'usage | ✅ | §4 |
| MVP | ✅ | §6 |
| V2/V3 | ✅ | §7 |
| Risques | ✅ | §8 |
| Décision finale | ✅ | §9 |

---

## 11. Lectures complémentaires

- [AUDIT.md](AUDIT.md) — Audit technique, en particulier le modèle Prisma actuel (SiteEquipment p.~ ligne 287).
- [AUDIT-PRODUIT.md](AUDIT-PRODUIT.md) — Vue produit module par module, dont module Sites + Équipements.
- [VISION-V2.md](VISION-V2.md) — §8 (Hub Échéances), §10 (QR Codes), §4.4 (Échéances).
- [BACKLOG-V2.md](BACKLOG-V2.md) — Epic E5 (Hub Échéances), Epic E10 (QR Codes).
- [DECISIONS-SPRINT1.md](DECISIONS-SPRINT1.md) — §3 (recommandation atelier conceptuel) — ce document en est le livrable.
