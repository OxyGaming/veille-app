# Vision produit — Veille V2 → Centre de Pilotage Opérationnel

> **Périmètre** : conception produit V2 à 12 mois.
> **Date** : 2026-06-13.
> **Posture** : Product Manager senior + UX Designer senior + responsable métier + expert applications terrain.
> **Documents amont** : [AUDIT.md](AUDIT.md) (technique), [AUDIT-PRODUIT.md](AUDIT-PRODUIT.md) (produit).
> **Aucun code n'est produit ici** — seulement la conception, les maquettes textuelles, les parcours et la roadmap.

---

## 0. Note de cadrage et changement de paradigme

L'application Veille a été conçue comme **un outil de veille terrain**. Son nom, son modèle de données (`VeilleSession`, `Procedure`, `ObservationItem`) et son menu (« Veilles » comme entrée principale) reflètent cette ambition d'origine : aider un agent à conduire une procédure d'observation, item par item.

En 12 mois, ce périmètre s'est élargi sans être nommé :
- des **visites de site** (CHECKLIST + INVENTORY) ont été ajoutées en parallèle des sessions ;
- des **actions importées d'Excel** sont validées dans l'app ;
- un **historique transverse** est consultable (vues / notes / sessions / validations / visites) ;
- des **statistiques** par équipe sont calculées ;
- un **catalogue d'équipements** par site avec péremption est entré dans la base.

Aujourd'hui, l'outil **fait déjà** trois métiers (veille comportementale, conformité matérielle, suivi d'actions) sans nommer cette mutation. C'est la racine de la confusion lexicale : on essaie de loger trois métiers dans le vocabulaire d'un seul.

### Le changement de paradigme proposé pour V2

> **Veille n'est plus une application de veille. C'est un Centre de Pilotage Opérationnel terrain.**
>
> Il couvre **trois flux** :
> 1. **Observation** (ce que je vois) — veilles comportementales, vus, notes, photos.
> 2. **Contrôle** (ce que je vérifie) — visites de site, inventaires, péremptions, conformités.
> 3. **Suivi** (ce que je traite) — actions importées, NC, échéances, rappels.
>
> Le point d'entrée unique de tout utilisateur est **« Aujourd'hui »** : la liste consolidée de ce qu'il a à faire, à voir, à valider, à reporter — quel que soit le flux d'origine.

Cette V2 propose donc :
- Une **architecture orientée moments** (ce que je fais maintenant) et non plus orientée entités (la table Agent, la table Procedure).
- Un **hub des échéances** qui agrège visites planifiées, actions en retard, péremptions équipements, habilitations, exercices réglementaires, dans un seul flux à traiter.
- Une **expérience mobile-first** repensée : 80 % des usages se font sur smartphone en intervention, pas en bureau.
- Une **plateforme multi-équipes** prête pour le déploiement à 500 équipes (rôles fins, hiérarchie organisationnelle, SSO, multi-tenancy logique).

Le reste du document détaille cette vision.

---

## 1. Vision cible 2027 — phrase d'engagement

> **"En 2 secondes après ouverture de l'application, un agent ou un manager sait exactement ce qu'il doit faire dans les 8 prochaines heures."**

Trois engagements produit qui en découlent :

**E1. Zéro recherche au quotidien.** L'utilisateur n'a pas à fouiller dans des onglets pour trouver son travail. L'application le lui présente, trié par urgence et par contexte. Recherche = exception, pas norme.

**E2. La preuve naît du geste.** Tout ce qui est saisi (veille, NC, vu, validation) produit *immédiatement* une preuve traçable (photo, signature, audit log) sans étape supplémentaire. Le rapport PDF est un sous-produit, pas une finalité.

**E3. Le terrain dicte, pas le bureau.** Toutes les décisions d'UX privilégient le smartphone en intervention (gants, soleil, mouvement, connexion intermittente, batterie limitée). Le desktop bénéficie en retour d'une densité accrue, mais n'est jamais la cible primaire.

---

## 2. Analyse produit synthétique

### 2.1 Top 10 irritants utilisateurs

Classés par impact subjectif fort observé sur les rôles USER / EDITOR / ADMIN.

| # | Irritant | Rôle | Conséquence quotidienne |
|---|---|---|---|
| 1 | **Pas d'écran "Aujourd'hui"** — l'app ouvre sur le catalogue de procédures | Tous | L'agent reconstitue mentalement ce qu'il a à faire à partir de 4 écrans |
| 2 | **Pas d'annulation possible** d'une validation erronée | USER | Erreur de double-tap devient irrécupérable, contact obligatoire avec le manager |
| 3 | **Boutons d'action critique à 22-28 px** (statuts, archiver, valider) | USER mobile | Erreur de tap fréquente en gants ; expérience anxiogène |
| 4 | **Vocabulaire flou** (Veille / Session / Visite / Procédure / Inventaire) | Tous | Un nouvel utilisateur ne sait pas où cliquer pour démarrer son travail |
| 5 | **Tables admin coupées sur mobile** (7-9 colonnes) | EDITOR / ADMIN | Impossible d'administrer une équipe depuis sa tablette |
| 6 | **Bouton "+ Nouvelle procédure" → 404** | EDITOR | Friction directe sur le geste de paramétrage du référentiel |
| 7 | **4 pages absentes du menu mobile** (Sessions, Stats, Liens, Contacts) | USER terrain | Impossible d'appeler une astreinte ou de reprendre une veille de la veille |
| 8 | **Pas de photos en visites** alors qu'elles existent en sessions | USER | NC sans preuve visuelle = NC fragile |
| 9 | **5 statuts session en 2 colonnes serrées** | USER mobile | Pavé tactile mauvais ; la majorité utilise les 3 statuts principaux |
| 10 | **PDF rapport non rouvrables depuis les listes** | Tous | Pour consulter un rapport déjà finalisé, il faut deviner l'URL |

### 2.2 Top 10 freins à l'adoption

Différent des irritants : un irritant est une douleur ; un frein est une raison de **ne pas adopter** ou d'abandonner.

| # | Frein à l'adoption | Type | Impact |
|---|---|---|---|
| 1 | **Pas de page profil `/me`** — pas de "chez soi" | Identité | L'utilisateur ne s'approprie pas l'outil |
| 2 | **Promesse offline non tenue** (syncQueue inerte) | Fiabilité | Une saisie hors-couverture est perdue silencieusement |
| 3 | **Pas de notifications push** | Engagement | L'app est 100 % pull ; l'utilisateur l'oublie |
| 4 | **Vocabulaire technique exposé** ("rawLabel", `localStatus="VALIDATED_LOCAL"`, slugs `veille-site`) | Confiance | Donne l'impression d'un outil "interne dev" non fini |
| 5 | **Confusion EDITOR : pages visibles mais boutons 403** | Confiance | Le manager perd confiance après 2-3 essais |
| 6 | **Pas de dashboard "Ma tournée"** pour le manager | Valeur | Pas de raison de revenir au quotidien |
| 7 | **Pas d'exports CSV pour reporting N+1** | Valeur | Le manager doit ressaisir dans Excel pour son hiérarchique |
| 8 | **Confirmations `confirm()` natives** (texte long, blocant) | Crédibilité | Pattern "site bricolé" 2010 |
| 9 | **Pas de gestion des échéances** (péremption, retard, à venir) | Différenciation | Si l'utilisateur doit suivre ailleurs, il n'utilise plus l'app |
| 10 | **Reset password en clair** transmis hors-app | Sécurité perçue | Premier feedback négatif d'un nouvel utilisateur |

### 2.3 Top 10 écrans les MOINS efficaces

| Rang | Écran | Score | Raison |
|---|---|---|---|
| 1 | `/admin/sites` | Très médiocre | 9 colonnes sans scroll horizontal, inutilisable mobile/tablette portrait |
| 2 | `/admin/procedures/[id]` | Très médiocre | 10+ champs sans wizard, save non-sticky, alert() natif |
| 3 | `/admin/users` | Très médiocre | 7 colonnes coupées, modale centrée masquée par clavier |
| 4 | `/admin/agents` | Très médiocre | 7 colonnes + modal TeamPicker en overflow |
| 5 | `/admin` (dashboard) | Médiocre | 5 tuiles + imports = aucune valeur métier opérationnelle |
| 6 | `/stats` | Médiocre mobile | Filtres en chaos, charts non-responsive, inexploitable < 768 px |
| 7 | `/history` | Moyen | Filtres `<select>` natifs ingérables, 7 typologies |
| 8 | `/visits/[id]` CHECKLIST | Médiocre | Statuts 28 px serrés, récap NC 7 champs inutilisable |
| 9 | `/admin/imports` | Médiocre | 3 fonctions empilées (Quick action / Import Excel / Pointages) sans hiérarchie |
| 10 | `/sessions/[id]` (5 statuts) | Moyen | 2 colonnes serrées sur mobile, libellés écrasés |

### 2.4 Top 10 écrans les PLUS efficaces

| Rang | Écran | Score | Raison |
|---|---|---|---|
| 1 | `/visits/[id]` INVENTORY | Bon | Pattern "tout conforme par défaut, je ne touche que les écarts" = terrain-first |
| 2 | `/contacts` | Bon | Lien `tel:` natif, cartes avec actions natives, à généraliser |
| 3 | `/agents/[id]` (modales bottom-sheet) | Bon | Seul écran avec pattern bottom-sheet mobile-first ; modèle à étendre |
| 4 | `/visits/new` (3 étapes) | Bon | Wizard implicite clair, autocomplete site, ergonomie correcte |
| 5 | `/sites` (liste) | Bon | Épure efficace, cartes lisibles |
| 6 | `/links` | Bon | Grille de cartes catégorisées + recherche, surface tactile généreuse |
| 7 | `/history` (regroupement par jour) | Bon | Groupage chronologique + checkbox Icare intégrée à la carte |
| 8 | `/sessions/[id]` (sélecteur agent) | Bon | Bloc agent obligatoire pré-saisie : excellent gate, accueillant |
| 9 | `/login` | Bon | Carte propre, autoComplete iOS keychain |
| 10 | `/agents` (sparkline fraîcheur) | Bon | Pastille verte / orange / rouge = signal métier instantané |

### 2.5 Fonctionnalités à forte vs faible valeur

**Forte valeur (à amplifier)** :
- Catalogue d'équipements + péremption — déjà saisi, sous-exploité (alertes manquantes).
- Sparkline fraîcheur agent — visuel terrain, à étendre aux sites.
- Cascade dedupHash sur actions (doublons collapsés) — vraie douleur métier résolue.
- Generation auto de NC depuis observation NON_CONFORME — automatisation invisible.
- PDF SNCF fidèle au document d'origine — produit fini documentaire.

**Faible valeur (à questionner)** :
- 5 statuts session — la majorité utilise 3.
- 7 champs NC inline sur visite — la majorité saisit 2.
- Tags imposés `veille légale` / `obligatoire` — folklore non explicable.
- Champ `Site.code` optionnel rempli nulle part.
- `ActionImport.summary` JSON jamais consulté.
- Dashboard admin actuel (5 tuiles statiques sans alerte).
- `/admin/visit-templates` lecture seule — promesse non livrée.

### 2.6 Fonctionnalités les plus complexes (techniquement et UX)

- Import Excel `actions` (~17 000 lignes, dedupHash, agents créés à la volée).
- Génération PDF SNCF (`VisitReportClient` 1 381 lignes, layout pixel-perfect).
- Catalogue équipements + import CSV + génération auto de NC en mode INVENTORY.
- Stats 5 onglets avec heatmap, donut, multi-line, stacked bars.
- Sync multi-équipes (4 scopes : team / agent / site / action).

### 2.7 Fonctionnalités les plus rentables (effort vs impact)

Le top "petit effort, gros impact" qu'on traitera en Quick Wins (cf. §15) :

1. Toaster `sonner` + `<ConfirmDialog>` → résout 26 `alert/confirm` natifs en 1 jour.
2. Bouton « Voir le rapport » dans listes → 0,5 jour, débloque tous les PDF.
3. 6e bouton mobile « Plus » → 0,5 jour, restitue 4 fonctions.
4. `<AgentAutocomplete>` dans `/history` et `/stats` → 0,5 jour, débloque les filtres.
5. Annulation validation 5 min window → 0,5 jour, résout l'erreur la plus fréquente.
6. Statuts pleine largeur (3 + menu Autres) → 1 jour, double la vitesse de saisie.

---

## 3. Nouvelle architecture de navigation

### 3.1 Principe directeur

L'architecture actuelle est **orientée entité** : 9 onglets correspondant à 9 tables (procedures, visits, sessions, agents, sites, history, stats, links, contacts). Cette logique est interne à l'app, étrangère à l'utilisateur.

La V2 propose une **architecture orientée moment** :

```
1. Aujourd'hui  — ce que je dois faire maintenant
2. Échéances    — ce qui arrive et ce qui est en retard
3. Mes contrôles — où j'ai été, où je vais (visites + veilles)
4. Référentiels — qui : agents / sites / contacts (consult.)
5. Historique   — tout ce qui s'est passé (filtré)
6. Mon Profil   — ma fiche, mes préférences, ma file offline
7. Pilotage     — stats + rapports (managers)
8. Administration — back-office (admin/editor)
```

### 3.2 Navigation mobile (smartphone)

5 onglets en bottom-nav, dont un 6e contextuel via menu ⋯ :

```
┌──────────────────────────────────────────┐
│  [≡]  VEILLE                  [👤] [🔔]  │  ← Top bar 56 px
├──────────────────────────────────────────┤
│                                          │
│                                          │
│       Zone de contenu (368-768 px)       │
│                                          │
│                                          │
│                                          │
├──────────────────────────────────────────┤
│  🏠      📅      🎯      📋      ⋯       │  ← Bottom nav 64 px
│ Aujour-  Échéa-  Mon    Histo.   Plus   │
│  d'hui   nces  contrôle  rique          │
└──────────────────────────────────────────┘
```

**Onglet 1 — Aujourd'hui (🏠)** : écran d'accueil contextuel par rôle (cf. §6).
**Onglet 2 — Échéances (📅)** : hub des échéances tous flux (cf. §8).
**Onglet 3 — Mon contrôle (🎯)** : démarrer une veille, une visite, voir mes en cours.
**Onglet 4 — Historique (📋)** : historique transverse filtrable.
**Onglet 5 — ⋯ Plus** : ouvre un bottom-sheet avec : Mon Profil, Référentiels (Agents / Sites / Contacts / Liens), Pilotage (Stats), Administration (si EDITOR/ADMIN).

**Indicateur d'urgence** : un badge rouge avec le nombre d'items à traiter du jour s'affiche sur Aujourd'hui et Échéances.

### 3.3 Navigation desktop (sidebar)

Sur écran large (>= 1024 px), la même architecture mais dépliée en sidebar verticale avec plus de profondeur :

```
┌─────────────┬──────────────────────────────────┐
│  VEILLE     │                                  │
│  Centre de  │                                  │
│  Pilotage   │                                  │
├─────────────┤                                  │
│ 🏠 Aujourd' │                                  │
│ 📅 Échéances│         Zone de contenu          │
│ 🎯 Contrôler│                                  │
│ 📋 Historique│                                 │
│             │                                  │
│ ─ Référentiels                                 │
│ 👥 Agents   │                                  │
│ 🏛️  Sites    │                                  │
│ 📞 Contacts │                                  │
│ 🔗 Liens    │                                  │
│             │                                  │
│ ─ Pilotage  │                                  │
│ 📊 Tableaux │                                  │
│ 📄 Rapports │                                  │
│             │                                  │
│ ─ Back-office (EDITOR/ADMIN)                   │
│ ⚙️ Admin     │                                  │
├─────────────┤                                  │
│ 👤 Jessy A. │                                  │
│ ⚡ En ligne  │                                  │
│ 🚪 Quitter  │                                  │
└─────────────┴──────────────────────────────────┘
```

### 3.4 Justification des choix

**Pourquoi "Aujourd'hui" et non "Tableau de bord"** : « Tableau de bord » suggère de la contemplation. « Aujourd'hui » exige du verbe. Tous les écrans bien notés dans notre audit sont ceux où l'utilisateur fait quelque chose ; tous les mal notés sont ceux où il regarde.

**Pourquoi "Échéances" et non "Calendrier"** : le calendrier suggère une vue temporelle ouverte. Échéances suggère une liste de dettes. La V2 doit créer une logique de dette envers l'utilisateur (tu as 3 choses à traiter) pour générer l'habitude de retour quotidien.

**Pourquoi "Mon contrôle" et non "Veilles" + "Visites"** : deux verbes différents (veiller un agent, visiter un site) sont en réalité un seul geste métier (contrôler la conformité). La distinction reste valable côté donnée (modèles différents), mais reste invisible côté UI. Le démarrage est unifié : « Que voulez-vous contrôler ? Un agent / un site ».

**Pourquoi déplacer Sessions, Stats, Liens, Contacts hors du menu principal mobile** : la première phase d'audit montre que ce sont les usages les moins fréquents au quotidien sur mobile (mais Contacts redevient critique en astreinte, d'où le ⋯ Plus avec badge si on est en heures non ouvrées).

**Pourquoi "Référentiels" comme catégorie** : Agents, Sites, Contacts, Liens sont 4 listes de "qui / quoi". L'utilisateur les consulte rarement en flux, souvent en recherche. Les regrouper sous un nom commun clarifie l'intention.

**Pourquoi "Mon Profil" comme point d'entrée central** : créer un "chez soi". Inclure la file offline ici la rend visible (M-02 du précédent audit).

---

## 4. Maquettes textuelles des écrans clés

### 4.1 Aujourd'hui — USER terrain (mobile portrait)

```
┌──────────────────────────────────────────┐
│  ☰   VEILLE              🔔₃   👤        │
├──────────────────────────────────────────┤
│                                          │
│  Bonjour Jessy ☀️                        │
│  Lundi 13 juin · Équipe Rive Droite      │
│                                          │
│ ┌────────────────────────────────────┐   │
│ │ 🎯 EN COURS                        │   │
│ │ Veille SP-12 · Bardella J.        │   │
│ │ Démarrée à 09:14 · 4/12 points    │   │
│ │                       [Reprendre] │   │
│ └────────────────────────────────────┘   │
│                                          │
│  À TRAITER AUJOURD'HUI         3 items   │
│ ┌────────────────────────────────────┐   │
│ │ 🔴 Action en retard · 3 jours      │   │
│ │ Affichage signalisation poste 7    │   │
│ │ Dupont M. · échéance 10/06        │   │
│ │                       [Valider →] │   │
│ ├────────────────────────────────────┤   │
│ │ 🟠 Visite trimestrielle prévue     │   │
│ │ Poste de Peyraud · dans 2 jours    │   │
│ │                       [Démarrer →]│   │
│ ├────────────────────────────────────┤   │
│ │ 🟡 Extincteur périmé               │   │
│ │ POS-LYON · expire dans 18 jours    │   │
│ │                       [Voir →]    │   │
│ └────────────────────────────────────┘   │
│                                          │
│  RACCOURCIS                              │
│ ┌─────────┐ ┌─────────┐ ┌─────────┐     │
│ │ 📷       │ │ 📞       │ │ 📱       │     │
│ │ Scanner │ │ Astreinte│ │ Nouvelle│     │
│ │  QR     │ │          │ │ veille  │     │
│ └─────────┘ └─────────┘ └─────────┘     │
│                                          │
│  DERNIÈRES ACTIVITÉS                     │
│  Hier 17:22 · Vu Martin L. (POS-VALENCE)│
│  Hier 14:08 · Veille SP-04 terminée     │
│  Hier 09:30 · Visite trimestrielle      │
│                                          │
├──────────────────────────────────────────┤
│  🏠₃    📅₅   🎯    📋    ⋯              │
│  Aujour Échéa Mon   Histo Plus           │
└──────────────────────────────────────────┘
```

**Choix UX** :
- **Salutation contextuelle** (« Bonjour Jessy ☀️ / 🌙 selon l'heure ») humanise l'app.
- **Carte "EN COURS"** seule en haut, en violet, pour permettre la reprise instantanée.
- **3 items max** dans "À traiter aujourd'hui" : un agent terrain peut traiter 3 choses entre deux interventions, pas 12. Les autres sont dans "Échéances".
- **Code couleur d'urgence** : 🔴 retard, 🟠 prochain, 🟡 à venir.
- **3 raccourcis natifs** : QR (V-01), Astreinte (lien tel direct), Nouvelle veille.
- **Dernières activités** : 3 lignes pour rappeler ce qu'on a fait (sentiment de continuité, pas une vraie navigation).

### 4.2 Aujourd'hui — MANAGER (mobile portrait)

```
┌──────────────────────────────────────────┐
│  ☰   VEILLE              🔔₁₂  👤        │
├──────────────────────────────────────────┤
│                                          │
│  MA TOURNÉE — Lundi 13 juin              │
│  Périmètre : Rive Droite · 12 sites · 47 agents │
│                                          │
│ ┌────────────────────────────────────┐   │
│ │ 🚨 ATTENTION                       │   │
│ │ 3 actions en retard > 7 j          │   │
│ │ 2 visites trimestrielles en retard │   │
│ │ 1 extincteur périmé hier           │   │
│ │                  [Voir le détail] │   │
│ └────────────────────────────────────┘   │
│                                          │
│  CETTE SEMAINE                           │
│ ┌────────────────────────────────────┐   │
│ │ Visites planifiées       3 / 5 ✓   │   │
│ │ ████████░░░░░░  60 %               │   │
│ ├────────────────────────────────────┤   │
│ │ Veilles équipe          12 / 15    │   │
│ │ ██████████░░░░  80 %               │   │
│ ├────────────────────────────────────┤   │
│ │ Actions clôturées        9 / 12    │   │
│ │ █████████░░░░░  75 %               │   │
│ └────────────────────────────────────┘   │
│                                          │
│  AGENTS À VEILLER                        │
│  Bardella J.   · 38 jours sans veille    │
│  Schmidt F.    · 32 jours                │
│  Pereira L.    · 28 jours                │
│  ─────────────────── [Voir tous (7) →]   │
│                                          │
│  SITES SANS VISITE                       │
│  POS-Peyraud   · 94 jours · retard       │
│  POS-Givors    · 78 jours · à venir 7j   │
│  ─────────────────── [Voir tous (4) →]   │
│                                          │
│  RACCOURCIS                              │
│ ┌─────────┐ ┌─────────┐ ┌─────────┐     │
│ │ 📥       │ │ 📊       │ │ 📄       │     │
│ │ Importer│ │ Stats    │ │ Rapport │     │
│ │ Excel   │ │  équipe  │ │ hebdo   │     │
│ └─────────┘ └─────────┘ └─────────┘     │
└──────────────────────────────────────────┘
```

**Choix UX** :
- **Bannière "ATTENTION"** rouge si quoi que ce soit est en retard. Sinon, bannière verte « Tout est sous contrôle ✓ ».
- **3 progress bars** "Cette semaine" : visites / veilles / actions. Permettent le diagnostic 30 secondes.
- **Agents à veiller** triés par fraîcheur descendante (les plus anciens en haut).
- **Sites sans visite** triés par retard sur fréquence attendue.
- **Raccourcis manager** : import Excel, stats équipe, rapport hebdo (M-19).

### 4.3 Aujourd'hui — ADMIN (mobile portrait)

```
┌──────────────────────────────────────────┐
│  ☰   VEILLE              🔔₃   👤        │
├──────────────────────────────────────────┤
│                                          │
│  PILOTAGE SYSTÈME — Lundi 13 juin        │
│                                          │
│ ┌────────────────────────────────────┐   │
│ │ État global                  ✅ OK  │   │
│ │ 247 utilisateurs · 8 équipes       │   │
│ │ Dernière sync : il y a 2 min       │   │
│ └────────────────────────────────────┘   │
│                                          │
│  ALERTES SYSTÈME                         │
│ ┌────────────────────────────────────┐   │
│ │ 🟡 12 sessions brouillon > 30 j    │   │
│ │ 🟡 3 mots de passe expirent < 7 j  │   │
│ │ 🟢 0 erreur 5xx ces dernières 24h  │   │
│ └────────────────────────────────────┘   │
│                                          │
│  USAGE                                   │
│ ┌────────────────────────────────────┐   │
│ │ Connexions 7j        2 847         │   │
│ │ Veilles 7j             238         │   │
│ │ Visites 7j              42         │   │
│ │ Actions validées 7j    489         │   │
│ │ Photos uploadées 7j  1 124         │   │
│ └────────────────────────────────────┘   │
│                                          │
│  CONFORMITÉ                              │
│ ┌────────────────────────────────────┐   │
│ │ Taux NC ouvertes < 7j      89 %    │   │
│ │ Taux visites à jour        76 %    │   │
│ │ Taux saisie complète        93 %   │   │
│ └────────────────────────────────────┘   │
│                                          │
│  À ARBITRER                              │
│ ┌────────────────────────────────────┐   │
│ │ 2 utilisateurs en attente d'équipe │   │
│ │ 1 demande de réinit. MDP           │   │
│ └────────────────────────────────────┘   │
│                                          │
│  ACTIONS RAPIDES                         │
│ ┌─────────┐ ┌─────────┐ ┌─────────┐     │
│ │ 👤+      │ │ 📄       │ │ 🛠️      │     │
│ │ Nouvel  │ │ Logs    │ │ Tests   │     │
│ │ user    │ │ audit   │ │ santé   │     │
│ └─────────┘ └─────────┘ └─────────┘     │
└──────────────────────────────────────────┘
```

### 4.4 Échéances — vue unifiée

```
┌──────────────────────────────────────────┐
│  ☰   ÉCHÉANCES               [🔍] [📥]   │
├──────────────────────────────────────────┤
│                                          │
│  [ Tout ▼ ] [ 30 jours ▼ ] [ Filtres ⚙ ] │
│                                          │
│  EN RETARD                          5    │
│ ┌────────────────────────────────────┐   │
│ │ 🔴 Action · Affichage signalisation│   │
│ │ Dupont M. · 3 jours de retard      │   │
│ │                       [Valider →] │   │
│ ├────────────────────────────────────┤   │
│ │ 🔴 Visite trimestrielle            │   │
│ │ POS-Peyraud · 4 jours              │   │
│ │                       [Démarrer →]│   │
│ ├────────────────────────────────────┤   │
│ │ 🔴 Extincteur périmé               │   │
│ │ POS-VALENCE · hier                 │   │
│ │                       [Inventaire]│   │
│ └────────────────────────────────────┘   │
│                                          │
│  AUJOURD'HUI                        2    │
│ ┌────────────────────────────────────┐   │
│ │ 🟠 Veille comportementale Bardella │   │
│ │ Aujourd'hui                        │   │
│ │                       [Démarrer →]│   │
│ ├────────────────────────────────────┤   │
│ │ 🟠 Exercice incendie               │   │
│ │ POS-LYON · 14h                     │   │
│ └────────────────────────────────────┘   │
│                                          │
│  CETTE SEMAINE                      8    │
│  ─── (regroupé par jour) ───            │
│                                          │
│  CE MOIS-CI                         24   │
│  ─── (regroupé par semaine) ───         │
│                                          │
└──────────────────────────────────────────┘
```

**Détail des sources d'échéances** (cf. §8 pour le moteur) :
- Actions importées avec `dueAt`.
- Visites de site avec retard sur `expectedFrequencyDays`.
- Équipements avec `expirationDate` proche.
- Habilitations agent (table à créer en V2).
- Documents réglementaires à renouveler (à modéliser).
- Exercices périodiques (à modéliser, ex. exercice incendie trimestriel).

### 4.5 Mon contrôle — démarrage unifié

```
┌──────────────────────────────────────────┐
│  ☰   MON CONTRÔLE                        │
├──────────────────────────────────────────┤
│                                          │
│  EN COURS                                │
│ ┌────────────────────────────────────┐   │
│ │ 🎯 Veille SP-12 · Bardella J.     │   │
│ │ Brouillon · 4/12 points           │   │
│ │                       [Reprendre] │   │
│ ├────────────────────────────────────┤   │
│ │ 🎯 Visite POS-LYON · Trimestrielle│   │
│ │ Brouillon · 8/45 items            │   │
│ │                       [Reprendre] │   │
│ └────────────────────────────────────┘   │
│                                          │
│  DÉMARRER UN NOUVEAU CONTRÔLE            │
│ ┌────────────────────────────────────┐   │
│ │  📷  Scanner un QR                 │   │
│ │  → identification automatique      │   │
│ └────────────────────────────────────┘   │
│ ┌────────────────────────────────────┐   │
│ │  👤  Une veille sur un agent       │   │
│ │  → choix procédures + agent        │   │
│ └────────────────────────────────────┘   │
│ ┌────────────────────────────────────┐   │
│ │  🏛️   Une visite de site            │   │
│ │  → choix modèle + site             │   │
│ └────────────────────────────────────┘   │
│ ┌────────────────────────────────────┐   │
│ │  📦  Un inventaire équipement      │   │
│ │  → site + catalogue                │   │
│ └────────────────────────────────────┘   │
│ ┌────────────────────────────────────┐   │
│ │  👁️   Marquer "Vu" un agent / site  │   │
│ └────────────────────────────────────┘   │
│                                          │
│  MES 5 DERNIERS CONTRÔLES                │
│  Hier 17:22 · Veille SP-04 ✓             │
│  Hier 09:14 · Visite POS-LYON ✓          │
│  Vendredi   · Veille SP-08 ✓             │
│  Vendredi   · Vu Martin L.               │
│  Jeudi      · Inventaire POS-LYON ✓      │
└──────────────────────────────────────────┘
```

**Choix UX** :
- **QR en première option** : c'est le geste le plus rapide. Si le site / agent est étiqueté, plus aucune recherche.
- **Verbes plutôt que substantifs** : "Une veille sur un agent" (action) plutôt que "Veille comportementale" (catégorie).
- **5 derniers contrôles** : auto-complétion mentale — l'utilisateur a une probabilité forte de refaire le même geste.

### 4.6 Mon Profil

```
┌──────────────────────────────────────────┐
│  ←   MON PROFIL                          │
├──────────────────────────────────────────┤
│                                          │
│ ┌────────────────────────────────────┐   │
│ │       ┌──────┐                     │   │
│ │       │  JA  │   Jessy Achille    │   │
│ │       └──────┘   jessy@sncf.fr    │   │
│ │                  USER · Rive Droite│   │
│ └────────────────────────────────────┘   │
│                                          │
│  MES CHIFFRES (30 derniers jours)        │
│ ┌────────┬────────┬────────┐             │
│ │   38   │   12   │   47   │             │
│ │Veilles │Visites │ Vus    │             │
│ └────────┴────────┴────────┘             │
│                                          │
│  ─── Mes activités ───                   │
│  📋  Mes veilles en cours          (2)   │
│  📋  Mes visites en cours          (1)   │
│  📋  Mes brouillons offline        (0)   │
│  📋  Mes actions validées 7j      (12)   │
│  📋  Mes vus / notes 7j            (8)   │
│                                          │
│  ─── Mon scope ───                       │
│  👥  Équipes : Rive Droite, Soir         │
│  🏛️   Sites : 12 sites                    │
│  👤  Agents : 47 agents                  │
│                                          │
│  ─── Préférences ───                     │
│  ⚙️   Notifications                      │
│  ⚙️   Langue · FR                        │
│  ⚙️   Vue cross-équipe · OFF             │
│  ⚙️   Agents masqués · 0                 │
│  ⚙️   Signature PDF                      │
│  ⚙️   Mode sombre · OFF                  │
│                                          │
│  ─── Sécurité ───                        │
│  🔐  Changer mon mot de passe            │
│  🚪  Se déconnecter                      │
│                                          │
│  ─── Synchronisation offline ───         │
│  ⚡  3 mutations en file                  │
│      [ Forcer la synchronisation ]      │
└──────────────────────────────────────────┘
```

### 4.7 Démarrage d'une veille (refonte mobile)

```
┌──────────────────────────────────────────┐
│  ←   NOUVELLE VEILLE         Étape 1/3   │
├──────────────────────────────────────────┤
│                                          │
│  L'AGENT                                 │
│ ┌────────────────────────────────────┐   │
│ │ [🔍 Rechercher matricule ou nom]   │   │
│ └────────────────────────────────────┘   │
│                                          │
│  RÉCENTS                                 │
│ ┌────────────────────────────────────┐   │
│ │ 👤 Bardella J. · POS-LYON          │   │
│ │ 🟡 Vu il y a 12 jours              │   │
│ ├────────────────────────────────────┤   │
│ │ 👤 Schmidt F.  · POS-VALENCE       │   │
│ │ 🟠 Vu il y a 28 jours              │   │
│ ├────────────────────────────────────┤   │
│ │ 👤 Pereira L.  · POS-LYON          │   │
│ │ 🔴 Vu il y a 38 jours              │   │
│ └────────────────────────────────────┘   │
│                                          │
│           [ Suivant : Procédures → ]    │
└──────────────────────────────────────────┘

┌──────────────────────────────────────────┐
│  ←   NOUVELLE VEILLE         Étape 2/3   │
├──────────────────────────────────────────┤
│                                          │
│  PROCÉDURES POUR Bardella J.             │
│                                          │
│  💡 Suggérées (jamais observées chez lui)│
│  ☐ Circulation : Signaux fixes      G3   │
│  ☐ Circulation : Annonces           G2   │
│                                          │
│  PROCÉDURES STANDARD                     │
│  ☐ Sécurité poste : EPI              G3  │
│  ☐ Sécurité poste : Affichage       G2  │
│  ☑ Traction : Commande               G4  │
│  ☐ Traction : Caténaire             G3  │
│  ...                                     │
│                                          │
│  ┌──────────────────────────────────┐    │
│  │ 1 procédure sélectionnée         │    │
│  │           [ Suivant : Démarrer → ]│   │
│  └──────────────────────────────────┘    │
└──────────────────────────────────────────┘
```

**Choix UX** :
- L'**agent vient avant les procédures** (logique inverse de l'app actuelle). C'est l'agent qu'on vient veiller ; les procédures sont l'instrument.
- **Récents** : tri intelligent par fraîcheur de veille (rouge = urgent).
- **Suggestions** : procédures jamais observées sur cet agent (intelligence légère).
- Wizard 3 étapes au lieu d'écran libre, jamais plus de 2 décisions par écran.

---

## 5. Parcours utilisateurs cibles

### 5.1 Parcours USER terrain — matinée type

```
Heure  | Geste                          | Écran               | Clics
─────  | ─────────────────────────────  | ─────────────────── | ─────
08:30  | Ouverture de l'app             | Aujourd'hui         | 0
08:31  | Voit "En cours: SP-04" hier    | Aujourd'hui         | 0
08:31  | Clique "Reprendre"             | Session SP-04       | 1
08:35  | Finit la veille (8 items)      | Session SP-04       | 8
08:40  | Clôture session                | Session SP-04       | 2
08:40  | PDF généré automatiquement     | Rapport             | 0
08:42  | Scan QR sur la porte du local  | Caméra              | 1
08:42  | App identifie POS-LYON         | Mon contrôle        | 0
08:42  | Propose : "Inventaire" / "Visite" / "Veille" | Choix    | 1
08:43  | Choisit "Inventaire mensuel"   | Visite INVENTORY    | 1
08:43  | Démarre directement la saisie  | Inventaire          | 0
```

**12 clics + 1 scan QR pour démarrer 2 contrôles, dont une reprise et une nouvelle.** Aujourd'hui, la même séquence coûterait 25+ clics et 3 navigations cassées (mobile sans /sessions).

### 5.2 Parcours MANAGER — préparation tournée

```
Heure  | Geste                          | Écran               | Clics
─────  | ─────────────────────────────  | ─────────────────── | ─────
07:50  | Ouverture                      | Aujourd'hui (manager)| 0
07:50  | Voit bannière 🚨 ATTENTION      | Aujourd'hui         | 0
07:50  | Lit : 3 actions retard, 2 visites| Aujourd'hui      | 0
07:51  | Clique sur "Voir le détail"    | Échéances filtré    | 1
07:52  | Assigne les 3 actions retard à 2 agents| Échéances    | 4
07:53  | Clique sur "Visites en retard" | Échéances           | 1
07:54  | Planifie POS-Peyraud à jeudi   | Planning            | 2
07:55  | Revient à Aujourd'hui          | Aujourd'hui         | 1
07:56  | Voit "Agents à veiller" — Pereira en haut| Aujourd'hui| 0
07:56  | Décide : tournée Pereira aujourd'hui| Mémoire        | 0
07:57  | Ouvre rapport hebdo (raccourci)| Mail              | 1
```

**10 clics pour piloter sa journée en 7 minutes.** Aujourd'hui, impossible.

### 5.3 Parcours ADMIN — gestion d'incident

```
Heure  | Geste                          | Écran               | Clics
─────  | ─────────────────────────────  | ─────────────────── | ─────
10:14  | Demande utilisateur : "j'ai cliqué Valider par erreur" | Tel | 0
10:15  | Ouvre Aujourd'hui (admin)      | Aujourd'hui admin   | 0
10:15  | Section "À arbitrer"           | Aujourd'hui         | 0
10:15  | Clique "Demandes d'annulation" | Annulations         | 1
10:16  | Filtre par utilisateur Jessy   | Annulations         | 2
10:16  | Voit la validation litigieuse  | Annulations         | 0
10:17  | Clique "Annuler avec commentaire"| Modal            | 1
10:17  | Tape commentaire d'audit       | Modal               | 0
10:17  | Confirme                       | Modal               | 1
10:18  | Vérifie dans /admin/audit      | Audit               | 1
```

**6 clics, geste tracé.** Aujourd'hui, l'admin doit faire un `curl` ou un `prisma studio`.

---

## 6. Écran Aujourd'hui — spécifications détaillées

### 6.1 Principes communs aux 3 rôles

**Promesse** : en 2 secondes, l'utilisateur sait s'il a quelque chose à faire ; en 5 secondes, il sait quoi.

**Structure invariante** :
1. **Bannière de contexte** (qui je suis, où je suis, ce qu'il est important de savoir maintenant).
2. **Action ou alerte prioritaire** (si quelque chose existe en cours / en retard critique).
3. **Listes courtes (3-5 items)** des choses à traiter, triées par urgence.
4. **Raccourcis natifs** (3 boutons gros) vers les gestes les plus fréquents.
5. **Trace d'activité récente** (3 lignes, sentiment de continuité).

**Règles d'or** :
- Aucun item plus de 8 sur la page : si plus, lien "Voir tous (N) →".
- Aucun graphe ni courbe : Aujourd'hui = action, pas analyse (les stats sont ailleurs).
- Code couleur strict : 🔴 retard, 🟠 prochain, 🟡 à venir, 🟢 OK.
- Toujours pleine largeur sur mobile.
- Pull-to-refresh actif (geste mobile natif).

### 6.2 Aujourd'hui — USER terrain (détaillé)

**Sections (de haut en bas)** :

1. **Salutation** : "Bonjour {prénom} ☀️/🌙" — heure du jour, équipe principale, date.
2. **En cours** (carte unique violet, si applicable) : reprise instantanée de la session ou visite brouillon la plus récente.
3. **À traiter aujourd'hui (max 5 items)** :
   - Actions importées avec `dueAt = today ± 1` ou en retard.
   - Visites planifiées (`expectedFrequencyDays` dépassé ou imminent).
   - Vus d'agents prioritaires (fraîcheur > seuil rouge).
   - NC ouvertes qui m'ont été assignées.
   - Habilitations en renouvellement (à venir M-XX).
4. **Raccourcis natifs (3)** : Scanner QR, Astreinte (lien `tel:` direct au contact d'astreinte), Nouvelle veille / visite (selon contexte).
5. **Dernières activités (3 lignes)** : non-cliquables, juste informatives ("Hier 14:08 · Veille SP-04 terminée").

**Logique de tri** (algo) :
```
score = urgence × poids_type × visibilité
urgence : retard > today > today+1 > today+N
poids_type : action_legale > visite_trimestrielle > extincteur > veille_comportementale
visibilité : assigned_to_me > on_my_team > on_my_sites
```

**Adaptation desktop** : 2 colonnes (gauche : actions à traiter ; droite : activité récente + raccourcis).

### 6.3 Aujourd'hui — MANAGER (détaillé)

**Sections (de haut en bas)** :

1. **Titre tournée** : "MA TOURNÉE — {date}" + résumé périmètre (12 sites · 47 agents).
2. **Bannière de diagnostic** :
   - 🟢 verte si tout est sous contrôle (rare, gratifiant).
   - 🟡 jaune si attention (1-2 items en jaune).
   - 🔴 rouge si urgence (1+ item en rouge).
   - Texte explicite : "3 actions en retard > 7 j / 2 visites trimestrielles en retard / 1 extincteur périmé hier".
3. **Cette semaine (3 progress bars)** : Visites planifiées vs réalisées, Veilles équipe vs objectif, Actions clôturées vs ouvertes.
4. **Agents à veiller (5 items max)** : tri par fraîcheur descendante (les + anciens d'abord).
5. **Sites sans visite (5 items max)** : tri par retard / fréquence attendue.
6. **NC ouvertes à arbitrer** (si responsable du manager) : 3 items max.
7. **Raccourcis manager (3)** : Importer Excel, Stats équipe, Rapport hebdo.

**Promesse 30 secondes** : avec la bannière + les 3 progress bars + les 2 listes courtes, le manager sait si son périmètre est sous contrôle ou pas.

### 6.4 Aujourd'hui — ADMIN (détaillé)

**Sections (de haut en bas)** :

1. **État global système** : ✅ OK / ⚠ Dégradé / 🛑 Incident, + chiffres clés (users, équipes, dernière sync DB).
2. **Alertes système** :
   - Sessions brouillon > 30 j (potentiel oubli utilisateur).
   - Mots de passe expirant < 7 j.
   - Taux d'erreur 5xx (Sentry-like).
   - Taille de la file syncQueue en agrégat.
3. **Usage 7j** : connexions, veilles, visites, actions validées, photos.
4. **Conformité** :
   - Taux de NC clôturées dans les délais.
   - Taux de visites à jour (vs `expectedFrequencyDays`).
   - Taux de saisie complète (commentaire/photo sur NC).
5. **À arbitrer** :
   - Utilisateurs en attente d'équipe.
   - Demandes de réinitialisation MDP.
   - Demandes d'annulation de validation (cf. M-09).
   - Modifications de rôle en attente d'approbation (workflow V2).
6. **Actions rapides admin (3)** : Nouvel utilisateur, Logs d'audit, Tests de santé.

**Promesse 30 secondes** : l'admin sait si son système est sain ou non. Aucune action n'est exigée s'il est sain.

---

## 7. Dashboard Manager (page dédiée — au-delà d'Aujourd'hui)

Le dashboard manager est une **page de pilotage profond**, accessible depuis le menu Pilotage. C'est le complément analytique d'Aujourd'hui.

### 7.1 Indicateurs à suivre

**Indicateurs d'activité (qui fait quoi)** :
- Nombre de veilles par observateur (top 10).
- Nombre de visites par observateur.
- Nombre de validations par observateur.
- Taux de couverture agents (combien d'agents ont eu au moins 1 veille ce mois).
- Taux de couverture sites (combien de sites ont eu au moins 1 visite ce trimestre).

**Indicateurs de qualité (comment c'est saisi)** :
- Taux de NC avec photo (objectif > 80 %).
- Taux de NC avec commentaire (objectif 100 %).
- Délai moyen entre prise de NC et clôture.
- Taux de sessions clôturées avec commentaire général.

**Indicateurs de risque (où ça brûle)** :
- Top 10 procédures les plus NON_CONFORME.
- Top 10 agents avec le plus d'actions ouvertes.
- Top 10 sites avec le plus de NC ouvertes.
- Distribution des gravités sur les observations (% G4, G3, G2).

**Indicateurs de conformité (où on est en retard)** :
- Nombre de visites trimestrielles attendues vs réalisées.
- Nombre d'équipements périmés.
- Nombre d'actions clôturées hors délai.

### 7.2 Alertes affichées

**Alertes critiques (rouge)** :
- 5+ actions en retard > 30 jours.
- 1+ équipement périmé.
- 1+ extincteur expiré.
- Site sans visite > 2× fréquence attendue.

**Alertes attention (jaune)** :
- 3+ actions en retard 7-30 jours.
- Équipement expirant < 30 jours.
- Site sans visite proche de fréquence attendue.
- Baisse de plus de 30 % du nombre de veilles vs semaine N-1.

**Indicateurs OK (vert)** :
- Tout est sous contrôle.

### 7.3 Actions rapides depuis le dashboard

- **Réassigner une action** en clic-droit sur une ligne du top actions.
- **Planifier une visite** depuis la liste sites en retard.
- **Exporter le rapport hebdomadaire** en PDF/XLSX.
- **Lancer un message à l'équipe** (notification push, V2 advanced).
- **Voir la liste filtrée** par drill-down sur chaque indicateur.

### 7.4 Information visible immédiatement

Au-dessus du fold (sans scroll) :
- **3 KPI géants** : Sites à jour (%) / Actions ouvertes (#) / Veilles ce mois (#) — comparés à la période précédente.
- **Bannière diagnostic** : ✓ Sous contrôle / ⚠ Attention / 🚨 Critique.
- **Top 3 alertes** avec call-to-action direct.

Le reste est en dessous, organisé en sections déroulantes/onglets selon densité.

---

## 8. Gestion centralisée des échéances

C'est l'**innovation produit la plus structurante** de la V2. Elle transforme l'app d'outil de saisie en outil de pilotage.

### 8.1 Modèle conceptuel

Une **Échéance** est une notion produit unifiée qui agrège des objets très différents :

```
Échéance {
  id, type, label, description,
  dueAt (date d'échéance),
  createdAt, source (objet d'origine),
  assignedToUserId, assignedToTeamId,
  contextSiteId, contextAgentId,
  status: ouverte | en_cours | clôturée | annulée,
  urgency: retard | aujourd_hui | semaine | mois | trimestre,
  priority: P0 | P1 | P2 | P3,
  ctaLabel: "Valider" | "Démarrer" | "Renouveler" | "Vérifier",
  ctaTarget: /agents/X / /visits/new?template=Y&site=Z / ...
}
```

### 8.2 Sources d'échéances V2

L'écran Aujourd'hui + l'écran Échéances agrègent automatiquement :

**Échéances déjà modélisées (à exploiter)** :
1. **Actions importées** avec `dueAt`. Statut ouvert / en retard.
2. **Visites de site** : retard sur `expectedFrequencyDays`. Algo : `dueAt = lastVisitDate + expectedFrequencyDays`.
3. **Équipements périmés** : alerte si `expirationDate < today + N`.
4. **Sessions brouillon** vieillissantes (> 7 j) — rappel doux à l'utilisateur.
5. **NC ouvertes** avec `plannedDate` proche ou dépassée.

**Échéances à modéliser en V2** :
6. **Contrôles trousses de secours** : extension du modèle SiteEquipment avec types (TROUSSE_SECOURS, AED, DOUCHE_SECURITE).
7. **Contrôles extincteurs** : déjà couvert via SiteEquipment, à mettre en avant.
8. **Contrôles réglementaires** : nouvelle entité `RegulatoryControl` (titre, périodicité, prochaine échéance, responsable).
9. **Exercices incendie** : `Exercise { type, expectedFrequencyDays, lastDoneAt, nextDueAt }`.
10. **Vérifications périodiques** : générique pour électrique, gaz, ascenseur, etc.
11. **Documents à renouveler** : `Document { siteId, expirationDate, reminderDays[] }`.
12. **Habilitations agent** : `AgentHabilitation { agentId, type, validFrom, validUntil }` (cf. Plan Préventif).
13. **Formations agent** : `AgentFormation { agentId, type, lastCompletedAt, validityDays }`.

### 8.3 Moteur d'échéances — fonctionnement

```
┌──────────────────────────────────────────────┐
│            MOTEUR D'ÉCHÉANCES                │
├──────────────────────────────────────────────┤
│                                              │
│ Sources (jobs cron quotidiens) :             │
│   ↓                                          │
│ ┌─────────────────────────┐                  │
│ │ Scan actions importées  │ → Échéance       │
│ ├─────────────────────────┤                  │
│ │ Scan visites en retard  │ → Échéance       │
│ ├─────────────────────────┤                  │
│ │ Scan équipements périm. │ → Échéance       │
│ ├─────────────────────────┤                  │
│ │ Scan habilitations      │ → Échéance       │
│ ├─────────────────────────┤                  │
│ │ Scan exercices          │ → Échéance       │
│ ├─────────────────────────┤                  │
│ │ Scan documents          │ → Échéance       │
│ └─────────────────────────┘                  │
│   ↓                                          │
│ Algorithme de priorisation :                 │
│   - Si retard, P0 + carte rouge              │
│   - Si J-N et P0/P1 source, P1 + carte orange│
│   - Sinon, P2/P3 + carte jaune               │
│   ↓                                          │
│ Routage :                                    │
│   - assignedToUserId si défini               │
│   - sinon manager d'équipe                   │
│   - sinon admin                              │
│   ↓                                          │
│ Restitution :                                │
│   - Push notification (si activée)           │
│   - Email digest hebdo                       │
│   - Bannière Aujourd'hui                     │
│   - Onglet Échéances                         │
└──────────────────────────────────────────────┘
```

### 8.4 Interface utilisateur d'échéances

L'onglet **Échéances** est une vue unifiée chronologique avec :
- **Filtres** : type (tout / actions / visites / équipements / habilitations / exercices / documents), période (en retard / 7j / 30j / 3 mois), assigné (à moi / à mon équipe / non assigné).
- **Regroupement par buckets temporels** : En retard / Aujourd'hui / Cette semaine / Ce mois-ci / Plus tard.
- **Action contextuelle** par carte : "Valider" / "Démarrer" / "Renouveler" / "Vérifier" / "Reporter (justifier)".
- **Bouton "Tout exporter"** en haut (PDF + CSV).

### 8.5 Notification

- **Push web** quotidienne le matin si > 0 échéance pour aujourd'hui.
- **Email digest hebdomadaire** lundi 8h avec récap : ce qui est tombé, ce qui arrive.
- **Email d'alerte critique** dès qu'une échéance bascule en retard.

### 8.6 Promesse utilisateur

> **L'utilisateur ne devra plus jamais chercher ce qu'il doit faire.**
> **Si l'app ne lui dit pas qu'il a quelque chose à faire, alors il n'a rien à faire.**

C'est cette inversion qui transforme l'outil de saisie en centre de pilotage.

---

## 9. Mobile First — refonte des patterns

### 9.1 Contraintes physiques redécouvertes

- iPhone SE : 568 px de haut, soit 448 px utiles après chrome (top 56 + bottom 64).
- iPhone 14 Pro : 844 px, soit 724 px utiles.
- En main 1-main, **seuls les 60 % inférieurs sont confortables au pouce**.
- En gants, la cible touch minimale est 48 px (vs 44 px standard Apple HIG).
- Au soleil, le contraste minimum WCAG AAA est requis (7:1), pas AA (4.5:1).
- En mouvement (train, marche), les zones à scroll précis sont prohibées.

### 9.2 Patterns à généraliser

#### P-01. Bottom-sheet pour toutes les modales mobile

Aujourd'hui seul `ManualActionModal` (AgentActionsClient) implémente ce pattern. À généraliser à :
- Confirmations de suppression / archivage.
- Édition utilisateur (admin).
- Sélecteur de team / agents.
- Modal "Vu / Note".
- Modal de filtres /history et /stats.
- Modal de création de site / agent.

**Spécifications du composant `<BottomSheet>`** :
- Hauteur : `min-h-[40vh] max-h-[90vh]`.
- Header sticky avec titre + ✕ fermer.
- Footer sticky avec CTA pleine largeur.
- Drag handle (poignée) en haut visible.
- Backdrop semi-transparent au-dessus.
- Animation de glissement depuis le bas.
- Swipe-down pour fermer.
- Sur tablette (>= 768 px), bascule en modale centrée.

#### P-02. Swipe-to-action sur listes

Remplacer les boutons "Archiver" / "Supprimer" en bord de carte (cibles 18-22 px aujourd'hui) par un swipe latéral.

```
Swipe ← gauche :  révèle [Valider] [Reporter]
Swipe → droite :  révèle [Archiver]
Swipe long ← :    révèle [Supprimer définitivement]
```

Sur les listes `/visits`, `/sessions`, `/agents`, `/contacts`, Échéances.

#### P-03. FAB (Floating Action Button) +

Bouton flottant en bas à droite (`bottom-[88px] right-4`) sur les listes pour le geste principal :
- `/visits` → `+` = Nouvelle visite.
- `/contacts` (admin) → `+` = Nouveau contact.
- `/agents` (admin) → `+` = Nouvel agent.

Le FAB se contracte en `→` (suggestion contextuelle) au scroll-down et redevient `+` au scroll-up.

#### P-04. Statuts pleine largeur

Refonte du bloc statut session / visite : grid 3 colonnes pleine largeur, cible 56 px de haut.

```
┌──────────────┬──────────────┬──────────────┐
│   ✓ CONFORME │ ✗ NON CONF.  │ — NON APPL.  │
└──────────────┴──────────────┴──────────────┘
[ ⋯ Autres (À revoir / Non observé) ]
```

#### P-05. Toolbar contextuelle qui apparaît à la sélection

Quand l'utilisateur sélectionne plusieurs éléments (cases à cocher en liste), une toolbar apparaît en bas avec les actions disponibles. Modèle mail / Tinder.

#### P-06. Pull-to-refresh

Geste natif iOS / Android sur toutes les listes. Aujourd'hui inexistant.

#### P-07. Boutons d'appel direct

Sur fiche contact, fiche site (si contacts liés), bouton `tel:` direct. Visuel : pictogramme téléphone vert.

#### P-08. Captures rapides

- Bouton 📷 photo qui ouvre directement la caméra arrière (`capture="environment"`) sans intermédiaire.
- ~~Bouton 🎤 reconnaissance vocale qui dicte dans la textarea (V-02).~~ — ⛔ abandonné définitivement (PO 2026-06-14)
- Bouton 📍 géolocalisation (si pertinent, V2 advanced).

### 9.3 Patterns à abandonner

#### A-01. Tables larges sur mobile

Toutes les tables 5+ colonnes deviennent des **listes de cards** avec actions intégrées à la carte. Le mode tableau reste disponible en tablette/desktop.

#### A-02. `confirm()` / `alert()` natifs

Remplacer par toaster (`sonner`) et `<ConfirmDialog>` bottom-sheet.

#### A-03. `<select>` natifs avec > 20 options

Remplacer par autocomplete recherchable. `AgentAutocomplete` existe déjà — étendre à Site, Contact, Procédure.

#### A-04. Modale centrée masquée par clavier

Toutes les modales avec inputs → bottom-sheet.

### 9.4 Lisibilité extérieure (terrain au soleil)

- **Contraste AAA** sur tous les textes (7:1).
- **Pas de gris léger** sur fond blanc (l'agent ne verra pas).
- **Polices ≥ 16 px** sur tous les textes lisibles (zoom natif iOS ne suffit pas).
- **Mode haut contraste** disponible en préférence (noir/blanc/jaune type station-service).
- **Mode sombre** disponible pour usage de nuit en poste d'aiguillage.

### 9.5 Utilisation avec gants

- **Cibles minimales 48 px** pour tous les boutons d'action.
- **Pas d'actions enchaînées** dans une zone < 100 px (risque de tap multiple).
- **Hover désactivé** : toutes les actions au tap, pas de tooltip.
- **Drag-and-drop limité** : pas d'opérations longues exigeant précision.

### 9.6 Utilisation à une main

- **Actions critiques en bas de l'écran** (zone pouce).
- **CTA de page en sticky bottom**, jamais en sticky top.
- **Menus latéraux ouverts depuis le bas** (drawer bottom-up plutôt que slide-in).
- **Recherche au pouce** : input dans la moitié basse de l'écran.

---

## 10. QR Codes — usage terrain

### 10.1 Vision

> **Tout objet physique terrain doit pouvoir être identifié en 1 scan.**

Sur un poste d'aiguillage, un local technique, une trousse de secours, un extincteur, un panneau d'affichage, un document obligatoire — chaque objet porte un QR code qui ouvre l'app sur la bonne fiche, déjà chargée et prête pour l'action.

### 10.2 QR Code d'un site

**Apposition** : à l'entrée du site, sur la porte, sur le panneau d'affichage.

**Action au scan** :
- App ouvre `/sites/[id]` avec un bandeau "🎯 Site identifié : POS-LYON".
- Propose 4 boutons : Démarrer visite / Démarrer veille / Inventaire / Vu / Note.
- Pré-remplit le contexte (site, date, observer = utilisateur connecté).

**Gain métier** :
- Élimine la recherche par nom (souvent ambiguë : POS-LYON-1 vs POS-LYON-2).
- Garantit l'identification (pas de visite sur le mauvais site).
- Trace l'arrivée sur site (timestamp + utilisateur + GPS optionnel).

**Parcours utilisateur** :
```
1. Arrivée sur site (gants, casque).
2. Scan QR sur la porte (1 geste, 1 seconde).
3. App ouvre la fiche site avec actions contextuelles.
4. Tap "Démarrer visite trimestrielle".
5. App propose le bon template (le seul attendu sur ce site).
6. Démarrage immédiat.
```

### 10.3 QR Code d'un local

**Apposition** : à l'entrée de chaque local interne (graissage, repos, électrique, etc.).

**Action au scan** : ouvre la fiche site avec la **section locale pré-déroulée** (graissage, par exemple).

**Gain métier** :
- Sur un site multi-locaux, gain de temps à la sélection.
- Permet de tracer l'entrée dans chaque local.

### 10.4 QR Code d'un équipement

**Apposition** : sur chaque extincteur, trousse de secours, AED, douche de sécurité, registre.

**Action au scan** :
- App ouvre `/sites/[siteId]/equipment/[id]` avec :
  - Photo de l'équipement vu la dernière fois.
  - Date péremption en gros.
  - Historique des inventaires.
  - Bouton "Vérifier maintenant" qui ouvre la modale d'observation directe.

**Gain métier** :
- Permet une vérification rapide hors d'une visite formelle ("je passe et je vérifie l'extincteur").
- Trace toutes les vérifications, même informelles.
- Renforce la culture de vigilance ambiante.

**Cas d'usage avancé** :
- Scan d'un extincteur expiré → push alerte sur le ticket de renouvellement.
- Scan en mode "audit" → photo automatique + log d'inspection.

### 10.5 QR Code d'une visite (post-visite)

**Apposition** : généré à la clôture d'une visite, imprimé sur le rapport PDF (en haut à droite).

**Action au scan** : ouvre directement la fiche visite avec son rapport. Utile pour :
- Audit externe (visiteur SNCF Réseau scanne le QR du rapport affiché → vérifie l'authenticité).
- Suivi des NC (un agent qui passe scanne le QR d'une visite avec NC ouverte → voit ce qui doit être traité).

### 10.6 QR Code d'un agent (optionnel)

**Apposition** : carte professionnelle.

**Action au scan** : ouvre la fiche agent. Utile pour :
- Veille rapide sans recherche par nom.
- Identification en cas d'accident.

**Précaution** : RGPD — réservé aux agents qui acceptent. Pas obligatoire.

### 10.7 Génération et gestion des QR codes

**Module nouveau** : `/admin/qr-codes`.
- Génération en lot (un site / tous les équipements d'un site / tous les sites d'une équipe).
- Export PDF imprimable (étiquettes A4 prédécoupées).
- Format URL : `https://veille.app/qr/{type}/{id}?token={hmac}` (HMAC pour éviter falsification).
- Suivi : combien de scans par jour / par utilisateur / par site.

### 10.8 ROI

| QR Code | Valeur métier | Valeur utilisateur | Difficulté | ROI | Priorité |
|---|---|---|---|---|---|
| QR site | ★★★★★ (élimine erreur d'identification) | ★★★★★ (1 geste) | M | Très élevé | P0 phase 4 |
| QR équipement | ★★★★ (vigilance ambiante) | ★★★★ (vérification < 30 s) | M | Élevé | P1 phase 4 |
| QR local | ★★★ (tracking ambiant) | ★★★ (gain de temps) | S | Moyen | P2 phase 5 |
| QR visite | ★★★★ (audit / preuve) | ★★ (rarement utilisé) | S | Moyen | P2 phase 5 |
| QR agent | ★★ (gain limité) | ★★★ (veille rapide) | S (mais RGPD) | Faible | P3 |

---

## 11. Fonctionnalités à forte valeur ajoutée — analyse approfondie

### 11.1 QR Code Site (V-01)
- **Valeur métier** : élimine erreur d'identification, trace arrivée, prépare la veille en pré-sélectionnant les bonnes procédures et le bon template.
- **Valeur utilisateur** : 1 geste (scan) vs 4-6 clics (recherche manuelle).
- **Difficulté** : M (modélisation génération + lecture URL + sticker print).
- **ROI** : Très élevé.
- **Priorité** : P1 phase 4.

### 11.2 Notifications Push
- **Valeur métier** : passe l'app en mode "push" — l'utilisateur revient quotidiennement même sans nouveau besoin spontané. Réduit le temps moyen entre alerte et action.
- **Valeur utilisateur** : ne plus rater une échéance. Confiance accrue dans le système.
- **Difficulté** : L (PWA push web nécessite VAPID, service worker config, gestion permissions, opt-in granulaire).
- **ROI** : Très élevé.
- **Priorité** : P0 phase 3.

### ~~11.3 Reconnaissance vocale~~ — ⛔ ABANDONNÉE DÉFINITIVEMENT (PO 2026-06-14)

> Toute fonctionnalité audio / dictée / vocale est abandonnée définitivement. Voir [memory/business-rules.md](memory/business-rules.md) §Audio. Section conservée à titre historique.

~~- **Valeur métier** : permet la saisie de commentaires riches en intervention (gants, mains occupées). Augmente le taux de NC commentées.~~
~~- **Valeur utilisateur** : drastiquement plus rapide. Reflète la réalité ferroviaire (les agents parlent leur veille à la radio).~~
~~- **Difficulté** : S (Web Speech API native, mais qualité variable selon device).~~
~~- **ROI** : Très élevé (effort faible, gain perçu énorme).~~
~~- **Priorité** : P0 phase 2.~~

### 11.4 Annotation photo (cercle / flèche / texte)
- **Valeur métier** : transforme une photo en preuve documentaire pointée. Une NC avec photo annotée est explicite, sans ambiguïté.
- **Valeur utilisateur** : permet d'expliquer ce qu'on a vu, pas seulement de le montrer.
- **Difficulté** : L (canvas + outils + persistance des annotations).
- **ROI** : Élevé.
- **Priorité** : P1 phase 3.

### 11.5 Historique enrichi
- **Valeur métier** : permet de comparer dans le temps. Δ équipements depuis dernière visite, évolution d'un agent veillé.
- **Valeur utilisateur** : raconte une histoire, pas juste une liste.
- **Difficulté** : M (calculs de diff, présentation temporelle).
- **ROI** : Élevé.
- **Priorité** : P1 phase 3.

### 11.6 Mode binôme (saisie simultanée)
- **Valeur métier** : reflète la réalité (visites souvent à 2). Permet de diviser le travail en visite longue.
- **Valeur utilisateur** : l'un dicte, l'autre saisit ; ou les deux saisissent des sections différentes en parallèle.
- **Difficulté** : XL (WebSocket, conflict resolution, présence indicators).
- **ROI** : Élevé mais effort énorme.
- **Priorité** : P3 phase 5.

### 11.7 IA Vision (détection équipement)
- **Valeur métier** : automatise la saisie inventaire — photo d'un extincteur → type + état + date péremption détectés.
- **Valeur utilisateur** : réduction massive du temps d'inventaire (5 minutes vs 20 minutes pour 50 équipements).
- **Difficulté** : L (intégration LLM vision Claude / Gemini, modèle de prompt, validation humaine).
- **ROI** : Très élevé à long terme.
- **Priorité** : P2 phase 5.

### 11.8 Plan interactif des sites
- **Valeur métier** : élimine les oublis (extincteur au sous-sol jamais inspecté). Optimise le parcours physique de l'agent.
- **Valeur utilisateur** : carte visuelle qui guide le parcours.
- **Difficulté** : L (upload plan, calque drag&drop, persistance positions, géométrie).
- **ROI** : Élevé.
- **Priorité** : P2 phase 5.

---

## 12. Rationalisation — ce qui doit disparaître ou fusionner

### 12.1 Écrans à fusionner

| Écrans aujourd'hui | À fusionner en | Rationale |
|---|---|---|
| `/procedures` + `/sessions` | `/mes-veilles` avec 2 onglets "Catalogue" + "En cours" | C'est le même verbe (veiller) avec deux moments (préparer / faire) |
| `/visits` + `/sessions` (côté usager) | `/mon-controle` qui pointe vers les deux types | Geste métier unique (contrôler), distinction technique invisible |
| `/agents` + `/admin/agents` | `/agents` avec toggle "Mode admin" (rôle EDITOR/ADMIN) | 80 % de code dupliqué |
| `/sites` + `/admin/sites` | `/sites` avec toggle "Mode admin" | Idem |
| `/contacts` + `/admin/contacts` | `/contacts` avec édition inline (rôle ADMIN) | Idem |
| `/links` + `/admin/links` | `/links` avec édition inline | Idem |
| `/admin/imports/*` (3 fonctions empilées) | `/admin/imports/actions`, `/pointages`, `/quick-action` | 3 fonctions, 3 pages |
| `/sessions/[id]/report` + `/visits/[id]/report` | `/rapport/[type]/[id]` unifié | Composant `<ReportLayout>` partagé |
| `/admin` (dashboard) + `/stats` Overview | `/pilotage` unique | Doublon documenté dans audit |

### 12.2 Écrans à supprimer

| Écran | Raison | Remplacement |
|---|---|---|
| `/admin` (actuel) | Aucune valeur métier | Aujourd'hui (admin) |
| `/admin/visit-templates` (read-only) | Promesse non livrée, soit on livre l'édition, soit on supprime | À livrer : `/admin/templates` CRUD complet |
| `(auth)/` (dossier vide) | Code mort | — |
| `/offline` (page actuelle) | Si syncQueue activée, devient inutile (toast suffit) | Notification toast + badge AppShell |

### 12.3 Concepts métier à simplifier

#### C-01. Trois entités → une notion "Interaction"

Aujourd'hui :
- `ActionValidation` = j'ai validé une action sur un agent
- `AgentSighting kind=SIGHT` = j'ai vu un agent
- `AgentSighting kind=NOTE` = j'ai noté quelque chose sur un agent

Proposition V2 :
- Une seule notion **Interaction agent** : un événement horodaté + auteur + commentaire optionnel + photos optionnelles + type (vu / commentaire / validation).
- Modèle DB peut rester séparé (compatibilité), mais l'UI est unifiée.

#### C-02. Statuts session : 5 → 3 principaux

- Conforme (✓ vert)
- Non conforme (✗ rouge)
- N/A (— gris)
- Menu "Autres" : À revoir, Non observé.

#### C-03. NC : 7 champs → 3 essentiels mobile

- Description (obligatoire).
- Responsable (autocomplete).
- Échéance (date).

Les 4 autres (risque, EVRp, mesures, dates de cycle) en accordéon "Détails" ou en post-traitement desktop.

#### C-04. `isActive` vs `isVisible`

Aujourd'hui deux booléens sur Agent / Site qui ressemblent. Unifier en un seul `status: ACTIVE | HIDDEN | ARCHIVED`.

#### C-05. `teamId` (legacy) + `UserTeam[]` + `viewAllTeams`

Le champ `teamId` historique sur User devient redondant avec `UserTeam[]`. À supprimer en migration V2.

### 12.4 Termes à renommer

| Aujourd'hui | V2 | Raison |
|---|---|---|
| Veille (catalogue) | **Catalogue** ou **Procédures** | Pas confondre avec session |
| Sessions de veille | **Mes veilles** | Possessif → personnel |
| Visites de site (mode CHECKLIST) | **Inspection** | Différencie d'inventaire |
| Visites de site (mode INVENTORY) | **Inventaire** | Termes du métier |
| Observateur / Créateur | **Auteur** partout | Cohérence |
| Vu | **Croisé** ou rester "Vu" | Terme métier |
| Validation | rester | OK |
| `localStatus: VALIDATED_LOCAL` | rester (technique) | Mais ne pas exposer en UI |
| ONLINE / OFFLINE (mobile) | EN LIGNE / HORS LIGNE | Cohérence avec desktop |
| `kind: CHECKLIST/INVENTORY` (UI admin) | **Inspection** / **Inventaire** | Pas de jargon technique en UI |

### 12.5 Fonctionnalités inutiles / redondantes

- **Tags imposés "veille légale" + "obligatoire"** → cacher derrière un switch.
- **5 champs `establishment / unit / space / observedElement / veilleType` sur ImportedAction** → consolider en `hierarchy: string[]`.
- **Champ `Site.code`** rempli nulle part → supprimer ou auto-générer.
- **Champ `Site.hasGreasingArea`** spécifique métier → généraliser en `Site.localTypes: string[]`.
- **Pill `pdfLayout: SNCF/VEILLE`** → décidé une fois au template, ne pas exposer par visite.

---

## 13. Vision long terme — 20 / 100 / 500 équipes

### 13.1 Scénario à 20 équipes (~1 000 utilisateurs)

**Implications produit** :
- Nombre d'agents : ~5 000-10 000.
- Nombre de sites : ~100-200.
- Nombre de sessions/visites par semaine : ~500.

**Changements nécessaires** :
- **Stack PostgreSQL** indispensable (SQLite single-writer = bottleneck).
- **SSO obligatoire** : provisionnement automatique users (Active Directory ou similaire).
- **Rôles fins** : Manager d'unité (multi-équipes), Manager d'équipe.
- **Notifications push** activées par défaut.
- **Backup automatisé** quotidien, retention 90 jours, test trimestriel.
- **Sentry / observabilité** active.
- **Tests E2E** sur 5 parcours critiques (CI).

### 13.2 Scénario à 100 équipes (~5 000 utilisateurs)

**Implications** :
- Multi-établissement réel (20+ EIC, par exemple).
- Coexistence référentiels procédures partagés + propres.
- Reporting hiérarchique (manager unité → manager établissement → direction).

**Changements nécessaires** :
- **Hiérarchie organisationnelle** : Établissement → Unité → Équipe (cf. MT-02).
- **Partage de référentiels** : procédures communes vs propres (versioning, fork).
- **Reporting consolidé** : tableaux de bord à 3 niveaux.
- **API publique** + webhooks pour intégration SI existant (GMAO, SIRH).
- **Workflow d'approbation** rapports (manager valide avant diffusion).
- **Multi-tenancy logique** : isolation forte par établissement.
- **CDN / edge** pour les assets (photos).
- **Stockage photos S3-compatible** au lieu de filesystem local.

### 13.3 Scénario à 500 équipes (~25 000 utilisateurs)

**Implications** :
- Multi-pays / multi-langue probable.
- Conformité RGPD à grande échelle.
- Performance et latence critiques.

**Changements nécessaires** :
- **Multi-langue** (FR/EN/ES/DE).
- **Multi-tenant complet** : possibilité d'héberger 1 base par très grande organisation.
- **Cache distribué** (Redis) pour les requêtes lourdes (`/stats`).
- **Queue asynchrone** pour les imports lourds et les générations PDF (BullMQ / similar).
- **Génération PDF côté serveur** (pas client), avec queue.
- **CDN global** photos et assets.
- **Monitoring 24/7** (PagerDuty).
- **DPIA** (Analyse d'Impact RGPD) formalisée.
- **Plan de continuité d'activité** documenté.
- **SLA** signés avec les clients.
- **Équipe dédiée produit** (3-5 personnes) + équipe tech (5-10).

### 13.4 Vision financière implicite

À 500 équipes, l'outil n'est plus un side-project mais une **plateforme de pilotage de conformité opérationnelle** comparable à GMAO modernes (Maximo, EAM SAP, MicroMain). Il doit alors être considéré comme un produit à part entière avec :
- Roadmap produit indépendante.
- Modèle de tarification (par équipe / par utilisateur).
- Service client + customer success.
- Marketing / vente.

C'est l'horizon 36 mois — pas la V2 immédiate. Mais la V2 doit être conçue **pour ne pas refermer ces portes**.

---

## 14. Synthèse vision V2 — schéma produit

```
                ╔══════════════════════════════════╗
                ║   CENTRE DE PILOTAGE OPÉRATIONNEL ║
                ║              (V2)                  ║
                ╚══════════════════════════════════╝
                              │
        ┌─────────────────────┼─────────────────────┐
        │                     │                     │
        ▼                     ▼                     ▼
   ┌──────────┐         ┌──────────┐         ┌──────────┐
   │ OBSERVER │         │ CONTRÔLER │         │  SUIVRE  │
   │          │         │          │         │          │
   │  Veilles │         │  Visites │         │  Actions │
   │  Vus     │         │  Inventai│         │  NC      │
   │  Notes   │         │   res     │         │  Échéa.  │
   │  Photos  │         │  Conform.│         │ Renouvel.│
   └────┬─────┘         └────┬─────┘         └────┬─────┘
        │                    │                    │
        └────────────────────┼────────────────────┘
                             │
                  ┌──────────▼──────────┐
                  │  HUB D'ÉCHÉANCES    │  ← moteur central
                  │  (push, email,      │
                  │  Aujourd'hui)       │
                  └──────────┬──────────┘
                             │
        ┌────────────────────┼────────────────────┐
        │                    │                    │
        ▼                    ▼                    ▼
   ┌──────────┐         ┌──────────┐         ┌──────────┐
   │  USER    │         │ MANAGER  │         │  ADMIN   │
   │ terrain  │         │  équipe  │         │ système  │
   │          │         │          │         │          │
   │ "Aujour- │         │  "Ma     │         │ "Pilo-  │
   │ d'hui"   │         │ tournée" │         │  tage"   │
   └──────────┘         └──────────┘         └──────────┘
```

---

## 15. Roadmap produit V2 — 5 phases

Note : les références **C1-C7, M1-M25, UX-01-UX-20, V-01-V-10, S-01-S-10, MT-01-MT-12** renvoient aux audits AUDIT.md et AUDIT-PRODUIT.md.

### Phase 1 — Quick Wins (Mois 1) — Stabilisation et confiance

**Objectif** : lever les bloquants critiques, livrer des améliorations à haute visibilité utilisateur, instaurer la confiance.

**Capacité** : ~15-20 jours-homme.

**Contenu** :

| Item | Description | Impact U | Impact M | Compl. | ROI | Prio |
|---|---|---|---|---|---|---|
| C1 | Photos privées (route streaming, hors `/public/`) | ★★ | ★★★★★ | M | Très élevé | P0 |
| C2 | Bug scope `teamId` multi-équipes | ★★★★ | ★★★★★ | S | Très élevé | P0 |
| C4 | Migrations Prisma versionnées (baseline) | ★ | ★★★★★ | S | Très élevé | P0 |
| C5 | Variables CSS fantômes corrigées | ★★★★ | ★★★ | S | Très élevé | P0 |
| C6 | Bouton "+ Nouvelle procédure" réparé | ★★★ | ★★★★ | S | Très élevé | P0 |
| C7 | Tables admin avec `overflow-x-auto` + mode cards mobile | ★★★★ | ★★★★ | M | Élevé | P0 |
| M1 | Validation MIME + taille upload photos | ★ | ★★★★ | S | Élevé | P0 |
| M3 | Rate-limit login | ★ | ★★★★ | S | Élevé | P0 |
| M23 | Backup automatisé SQLite | ★ | ★★★★★ | S | Très élevé | P0 |
| UX-02 | Menu mobile 6e bouton "⋯ Plus" | ★★★★★ | ★★★★ | S | Très élevé | P0 |
| UX-10 | Toaster sonner + ConfirmDialog | ★★★★ | ★★★ | S | Très élevé | P0 |
| UX-13 | Filtres recherchables /history et /stats | ★★★★ | ★★★★ | S | Très élevé | P0 |
| UX-17 | Annulation validation 5 min window | ★★★★ | ★★★ | S | Très élevé | P0 |
| UX-19 | Bouton "Voir le rapport" dans listes | ★★★★ | ★★★ | S | Très élevé | P0 |
| M8 | Photos en visites (réutilisation PhotoControls) | ★★★★★ | ★★★★ | S | Très élevé | P0 |
| M20 | Reset password par lien email | ★★★ | ★★★ | S | Élevé | P0 |
| S-09 | Tags imposés cachés derrière switch | ★★ | ★ | S | Moyen | P1 |
| S-10 | Routes API orphelines supprimées | ★ | ★ | S | Moyen | P2 |

**Livrables** : version 2.0.0 — "Quick Wins". Communication interne : *« On a corrigé les irritants quotidiens. »*

### Phase 2 — Refonte UX (Mois 2-3) — Vocabulaire, mobile, écran Aujourd'hui

**Objectif** : engager le pivot produit avec l'écran Aujourd'hui USER + refonte mobile-first + page profil.

**Capacité** : ~30-40 jours-homme.

**Contenu majeur** :

| Item | Description | Impact U | Impact M | Compl. | ROI | Prio |
|---|---|---|---|---|---|---|
| **UX-01** | **Écran Aujourd'hui — USER (cf. §6.2)** | ★★★★★ | ★★★★★ | L | **Très élevé** | **P0** |
| **M-02** | **Page profil `/me` (cf. §4.6)** | ★★★★ | ★★★★ | M | **Très élevé** | **P0** |
| UX-03 | Bottom-sheet généralisé (modaux mobiles) | ★★★★★ | ★★★ | M | Très élevé | P0 |
| UX-05 | Swipe-to-archive sur listes | ★★★★ | ★★★ | M | Élevé | P0 |
| UX-06 | FAB "+" mobile | ★★★★ | ★★ | S | Élevé | P0 |
| UX-07 | Statuts pleine largeur (sessions + visites) | ★★★★★ | ★★★★ | S | Très élevé | P0 |
| UX-08 | Drawer/filters sheet pour /history et /stats | ★★★★ | ★★★ | M | Élevé | P0 |
| UX-11 | Refonte chrome admin mobile (drawer) | ★★★★ | ★★★ | M | Élevé | P0 |
| **UX-15** | **Vocabulaire harmonisé (cf. §12.4)** | ★★★ | ★★ | S | **Élevé** | **P0** |
| UX-18 | Statuts session simplifiés à 3 + menu Autres | ★★★★ | ★★ | S | Élevé | P0 |
| UX-20 | Champs NC réduits à 3 essentiels en mobile | ★★★★ | ★★★ | M | Élevé | P0 |
| M-15 | Manager d'équipe assignable | ★★ | ★★★★ | S | Élevé | P1 |
| M-16 | Création manuelle d'agent | ★★★ | ★★★ | S | Élevé | P1 |
| M-10 | Page archives + restauration | ★★★ | ★★★ | S | Élevé | P1 |
| M-03 | Audit log consultable | ★★ | ★★★★★ | M | Élevé | P1 |
| MT-08 | Socle de tests Vitest + Playwright | ★ | ★★★★ | M | Élevé | P1 |
| MT-09 | Sentry + logs structurés | ★ | ★★★★ | S | Très élevé | P1 |
| C3 | Décision et début branchement syncQueue | ★★★★★ | ★★★★ | L | Très élevé | P0 |

**Livrables** : version 2.1.0 — "L'app qui te dit quoi faire". Communication : *« Aujourd'hui, tu ne cherches plus, tu fais. »*

**Métriques cibles fin phase 2** :
- Temps moyen pour démarrer une veille : < 30 s (vs ~50 s aujourd'hui).
- Nombre de clics pour valider une action : < 4 (vs 4-5).
- Taux d'usage mobile : > 50 % des sessions.

### Phase 3 — Industrialisation (Mois 4-6) — Dashboards manager, échéances, push

**Objectif** : transformer l'outil de saisie en outil de pilotage. Manager devient utilisateur quotidien.

**Capacité** : ~60-80 jours-homme.

**Contenu majeur** :

| Item | Description | Impact U | Impact M | Compl. | ROI | Prio |
|---|---|---|---|---|---|---|
| **M-01** | **Dashboard EDITOR "Ma tournée" (cf. §6.3)** | ★★★★ | ★★★★★ | L | **Très élevé** | **P0** |
| **§8** | **Moteur d'échéances + écran Échéances** | ★★★★★ | ★★★★★ | XL | **Très élevé** | **P0** |
| **V-07** | **Notifications push web** | ★★★★ | ★★★★★ | L | **Très élevé** | **P0** |
| ~~V-02~~ | ~~Reconnaissance vocale → commentaire~~ — ⛔ abandonnée (PO 2026-06-14) | — | — | — | — | — |
| M-05 | Vue NC ouvertes consolidée | ★★★★ | ★★★★★ | M | Très élevé | P0 |
| M-06 | Visites en retard calculées | ★★★★ | ★★★★★ | M | Très élevé | P0 |
| M-11 | Alertes péremption équipements | ★★★ | ★★★★★ | M | Très élevé | P0 |
| M-14 | Export CSV/XLSX généralisé | ★★★ | ★★★★★ | M | Élevé | P0 |
| M-04 | CRUD complet des templates de visite | ★★★ | ★★★★★ | L | Élevé | P1 |
| M-07 | Galerie photo centralisée `/photos` | ★★★★ | ★★★ | M | Élevé | P1 |
| M-19 | Rapport hebdomadaire emailé | ★★ | ★★★★★ | M | Très élevé | P1 |
| M-18 | Drill-down dans les statistiques | ★★★ | ★★★★ | M | Élevé | P1 |
| M-13 | Signature manuscrite participant | ★★ | ★★★★ | M | Élevé | P1 |
| M-12 | Champ "lieu" sur sessions de veille | ★★★ | ★★★★ | M | Élevé | P1 |
| MT-01 | Migration SQLite → PostgreSQL | ★★ | ★★★★★ | L | Très élevé | P0 |
| S-01 | Fusion Vu / Note / Validation en "Interaction" | ★★★★ | ★★★ | L | Élevé | P2 |
| S-02 | Fusion liste publique / admin (toggle mode admin) | ★★★ | ★★ | L | Élevé | P2 |
| S-03 | Dashboard admin actuel remplacé par §6.4 | ★★ | ★★★★ | M | Élevé | P1 |
| S-07 | /admin/imports éclaté en 3 pages | ★★★ | ★★ | S | Élevé | P1 |
| MT-05 | Centre de notifications + email + push | ★★★★ | ★★★★★ | L | Très élevé | P0 |

**Livrables** : version 3.0.0 — "Centre de Pilotage". Communication : *« Veille devient ton tableau de bord opérationnel quotidien. »*

**Métriques cibles fin phase 3** :
- Taux d'utilisation hebdomadaire EDITOR : > 80 %.
- Nombre de NC clôturées dans les délais : +30 %.
- Nombre de visites trimestrielles à jour : > 90 %.

### Phase 4 — Déploiement multi-équipes (Mois 7-9) — Plateformisation, QR codes

**Objectif** : préparer l'app à un déploiement à 20-100 équipes. Industrialiser le déploiement.

**Capacité** : ~50-70 jours-homme.

**Contenu majeur** :

| Item | Description | Impact U | Impact M | Compl. | ROI | Prio |
|---|---|---|---|---|---|---|
| **V-01** | **QR Code site + génération + scan (cf. §10)** | ★★★★★ | ★★★★★ | M | **Très élevé** | **P0** |
| QR équipement | Étendu aux équipements (cf. §10.4) | ★★★★ | ★★★★ | M | Élevé | P0 |
| **MT-02** | **Hiérarchie Établissement → Unité → Équipe** | ★★★ | ★★★★★ | L | **Très élevé** | **P0** |
| **MT-03** | **Rôles fins (5 au lieu de 3)** | ★★★ | ★★★★ | M | Élevé | P0 |
| **MT-04** | **SSO / OIDC (Microsoft / Keycloak)** | ★★★ | ★★★★★ | L | **Très élevé** | **P0** |
| **MT-06** | **Workflow d'approbation rapports** | ★★ | ★★★★ | L | Élevé | P1 |
| V-04 | Détection équipement par photo (LLM vision) | ★★★★ | ★★★★★ | L | Très élevé | P1 |
| V-08 | Plan d'action automatique post-visite (email) | ★★★ | ★★★★★ | M | Très élevé | P0 |
| V-05 | Comparaison "Δ depuis dernière visite" | ★★★ | ★★★★ | M | Élevé | P1 |
| V-10 | Indicateur qualité de saisie | ★★★ | ★★★★ | M | Élevé | P1 |
| UX-04 | Composant `<EntityCard>` unique pour les listes | ★★★★ | ★★ | L | Élevé | P1 |
| UX-09 | Refonte tables admin → cards empilées sur mobile | ★★★★ | ★★★★ | M | Élevé | P0 |
| Habilitations | Modèle + UI gestion habilitations agent | ★★★ | ★★★★★ | L | Très élevé | P0 |
| Exercices | Modèle + UI exercices périodiques (incendie etc.) | ★★ | ★★★★★ | M | Élevé | P1 |
| Documents | Modèle + UI documents réglementaires | ★★ | ★★★★★ | M | Élevé | P1 |
| MT-12 | Configuration par établissement (branding, PDF) | ★★ | ★★★ | M | Moyen | P2 |

**Livrables** : version 4.0.0 — "Plateforme multi-équipes". Communication : *« Veille s'industrialise pour soutenir vos équipes à grande échelle. »*

**Métriques cibles fin phase 4** :
- Nombre d'équipes en production : > 20.
- Taux de visite trimestrielle à jour : > 95 %.
- Délai moyen de clôture d'une NC : -50 % vs phase 2.

### Phase 5 — Innovation (Mois 10-12) — IA, plan interactif, binôme

**Objectif** : différenciation produit, préparer le passage à 100+ équipes.

**Capacité** : ~50-70 jours-homme.

**Contenu majeur** :

| Item | Description | Impact U | Impact M | Compl. | ROI | Prio |
|---|---|---|---|---|---|---|
| V-03 | Annotation photo (cercle / flèche / texte) | ★★★★ | ★★★★ | L | Élevé | P1 |
| V-09 | Plan interactif des sites avec équipements localisés | ★★★★ | ★★★★ | L | Élevé | P1 |
| V-06 | Mode binôme (saisie simultanée 2 users) | ★★★★ | ★★★★ | XL | Élevé | P2 |
| QR local + visite | QR codes étendus (cf. §10.3, §10.5) | ★★★ | ★★★ | S | Moyen | P2 |
| QR agent | QR codes optionnels agents | ★★★ | ★★ | S | Faible | P3 |
| MT-07 | API publique / webhooks pour intégration SI | ★★ | ★★★★★ | L | Très élevé | P1 |
| MT-11 | Multi-langue (FR, EN) | ★ | ★★ | M | Moyen | P3 |
| Suggestions IA | Suggestions intelligentes basées sur historique | ★★★ | ★★★★ | L | Élevé | P2 |
| Mode haut contraste | Mode haut contraste pour lisibilité soleil | ★★★ | ★★ | S | Moyen | P2 |
| Mode sombre | Mode sombre pour usage nuit poste | ★★★ | ★★ | S | Moyen | P2 |
| Notifications avancées | Notifications opt-in granulaires + Do Not Disturb | ★★★ | ★★★ | M | Élevé | P1 |
| Templates de notifications | Tableau de bord configurable des règles d'alerte | ★★ | ★★★★ | M | Élevé | P2 |

**Livrables** : version 5.0.0 — "Veille intelligent". Communication : *« Veille comprend votre métier, vous propose la prochaine action. »*

**Métriques cibles fin phase 5** :
- ~~Taux d'usage avec reconnaissance vocale : > 30 %.~~ — ⛔ abandonné (PO 2026-06-14)
- Taux de scans QR par session : > 60 % (sur sites équipés).
- Note de satisfaction utilisateur : > 8/10.
- Nombre d'équipes en production : > 50.

---

## 16. Indicateurs de succès du programme

### 16.1 Métriques produit

**Adoption (mesurées dès la phase 1)** :
- DAU/MAU (Daily/Monthly Active Users) — objectif DAU/MAU > 60 % en phase 3.
- Taux de connexion hebdomadaire — > 80 % des comptes provisionnés en phase 4.
- Temps moyen passé par session — > 5 min sur mobile (signal d'usage productif).

**Productivité** :
- Temps moyen pour démarrer une veille : < 30 s sur mobile (phase 2).
- Nombre de clics pour valider une action : < 4 (phase 2).
- Taux de visites mobiles vs desktop : > 60 % mobile (phase 3).

**Qualité** :
- Taux de NC avec photo : > 80 % (phase 1+2 améliorent par activation visite).
- Taux de sessions avec commentaire général : > 60 %.
- Délai moyen entre NC et clôture : < 7 j (phase 3 améliore par dashboard manager).
- Taux d'observations conformes au protocole : > 90 % (phase 5 améliore par suggestions IA).

**Fiabilité** :
- Taux d'erreurs côté client (Sentry) : < 0,1 %.
- Taux de sync offline réussie : > 99 % (post-phase 2).
- Disponibilité (uptime) : > 99,5 %.

**Vocabulaire & Confiance** :
- Tickets support liés à confusion lexicale : 0 (phase 2).
- Tickets "j'ai cliqué supprimer par erreur" : -80 % vs phase 0.
- Note NPS : > +40 en phase 4.

### 16.2 Métriques business

- Nombre d'équipes en production : 5 phase 1 → 20 phase 3 → 50 phase 5.
- Coût d'acquisition (jours-homme par équipe onboardée) : -50 % entre phase 3 et phase 4 (SSO + provisionnement automatique).
- Coût de support par équipe / mois : objectif < 1 j/mois en phase 5.

---

## 17. Risques et facteurs critiques de succès

### 17.1 Risques techniques

| Risque | Probabilité | Impact | Mitigation |
|---|---|---|---|
| Migration SQLite → Postgres casse les imports lourds | Moyenne | Élevé | Tests E2E + bascule progressive |
| syncQueue : conflits de mutation au retour online | Élevée | Moyen | Stratégie last-write-wins + UI conflit |
| LLM Vision : qualité variable selon photo | Élevée | Moyen | Validation humaine obligatoire + fallback manuel |
| Push web : permission refusée par utilisateur | Moyenne | Faible | Email digest en fallback |

### 17.2 Risques produit

| Risque | Probabilité | Impact | Mitigation |
|---|---|---|---|
| Utilisateurs résistent au changement de vocabulaire | Élevée | Moyen | Communication interne + transitions douces (anciens labels en parallèle 1 mois) |
| Dashboard manager pas adopté par les managers | Moyenne | Élevé | Interviews managers en phase 2, prototypage avec 2-3 managers pilotes |
| Notifications push perçues comme intrusives | Moyenne | Moyen | Opt-in granulaire + DND par défaut hors heures de service |
| QR codes : déploiement physique des étiquettes lent | Élevée | Moyen | Phase 4 priorise les sites "pilotes" + adoption progressive |

### 17.3 Facteurs critiques de succès

1. **Une seule chose à la fois** : ne pas tout changer en phase 2. Le pivot est l'écran Aujourd'hui. Le reste suit.
2. **Embarquer 2-3 managers pilotes** dès la phase 2 pour valider l'écran Aujourd'hui MANAGER.
3. **Mesurer dès la phase 1** : Sentry + analytics minimum (Plausible, Umami). Sans données, on ne sait pas si on avance.
4. **Communication interne soignée** : chaque release avec une vidéo de 2 min "voici ce qui change pour vous".
5. **Vocabulaire imposé** : décision politique en phase 2. Les managers doivent porter le nouveau vocabulaire pour qu'il s'impose.
6. **Mobile en premier, desktop en second** : à partir de la phase 2, toute conception démarre sur 320 px.

---

## 18. Conclusion — pourquoi cette V2 fait sens

L'application Veille a aujourd'hui une **base saine** (architecture Next.js solide, multi-tenant pensé, scopes propres, scrypt, PWA, PDF SNCF documentaire). Elle dispose de tous les ingrédients pour devenir le centre de pilotage opérationnel de terrain.

Trois mouvements stratégiques en font la V2 :

1. **Du verbe à la maison** : passer de « onglets par entité » à « écran Aujourd'hui qui me dit quoi faire ». Cette inversion change la fréquence d'usage de hebdomadaire à quotidien.

2. **De la saisie au pilotage** : le moteur d'échéances unifié transforme l'outil de saisie passif en système actif qui pousse les bonnes choses au bon moment. C'est la différence entre un cahier d'observations et un système qualité.

3. **Du smartphone à l'industrialisation** : la refonte mobile-first ouvre l'usage à 80 % de la cible (les agents en intervention). La phase 4 (SSO, hiérarchie, multi-tenancy) ouvre l'usage à 100+ équipes.

Si ces 3 mouvements sont conduits dans l'ordre proposé, Veille V2 devient en 12 mois **l'outil de référence utilisé quotidiennement par les équipes opérationnelles terrain**.

---

## 19. Lectures complémentaires

- [AUDIT.md](AUDIT.md) — audit technique exhaustif (Critiques C1-C7, Majeurs M1-M25, Mineurs m1-m30, Opportunités QW/M/S/I, Annexes matrices CRUD / permissions / routes / champs).
- [AUDIT-PRODUIT.md](AUDIT-PRODUIT.md) — audit produit par rôle (verdict /10) + module par module (15 modules) + UX mobile (28 écrans) + Top 20 UX / Top 20 métier / Top 10 valeur / Top 10 supprimer / 12 évolutions multi-équipes.
- Annexes consultables sur demande : parcours utilisateurs chronométrés par rôle, analyse module par module avec killer features, audit UX écran par écran avec verdicts.
