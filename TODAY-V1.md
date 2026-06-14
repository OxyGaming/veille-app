# TODAY-V1.md — Écran "Aujourd'hui" — Conception détaillée

> **Périmètre** : conception produit + UX + parcours + maquettes textuelles de l'écran `/today` pour Sprint 2.
> **Date** : 2026-06-14.
> **Documents amont** : [AUDIT.md](AUDIT.md), [AUDIT-PRODUIT.md](AUDIT-PRODUIT.md), [VISION-V2.md](VISION-V2.md), [BACKLOG-V2.md](BACKLOG-V2.md), [DESIGN-EQUIPEMENT.md](DESIGN-EQUIPEMENT.md), [DECISIONS-SPRINT1.md](DECISIONS-SPRINT1.md).
> **Posture** : Product Manager + UX Designer + Lead développeur. Conception pour Sprint 2 (US-2.1).
> **Aucun code, aucune migration, aucun schéma Prisma**. Uniquement conception, parcours, maquettes.

---

## 0. TL;DR

**Promesse V1** : en 2 secondes après ouverture, l'utilisateur sait s'il a quelque chose à faire ; en 5 secondes, il sait quoi.

**Décision pour Sprint 2** :
- **USER complet** : 5 sections, ~30 h, livrable fin semaine 2.
- **EDITOR allégé V1** (sans Hub Échéances) : 4 sections, ~20 h, livrable fin semaine 3.
- **ADMIN allégé V1** : 3 sections, ~12 h, livrable semaine 4.
- **Algorithme de priorisation V1** : moteur léger sans entité `Echeance` stockée, dérivation en lecture, ~12 h.

**Total Sprint 2 (sur US-2.1 seule)** : ~74 h, dans la capacité de 75 h. Le reste de Sprint 2 (BottomSheet, EntityCard, statuts pleine largeur, vocabulaire) est repoussé Sprint 2.5 ou intégré sur la marge.

**Hors périmètre V1 (assumé)** :
- Hub Échéances complet (E5) : reste Sprint 4. V1 utilise un agrégateur ad-hoc minimal.
- QR Codes (E10), push notifications (E7) : restent dans leur sprint.
- Reconnaissance vocale (ancienne US V-02 / E9-F1) : **abandonnée définitivement** (décision PO 2026-06-14).
- Modèle Équipement étendu : reste Sprint 4. V1 utilise `expirationDate` existant.
- Page profil `/me`, Dashboard manager `/pilotage` profond : Sprint 3.

**Bénéfice attendu** : transition `/` → `/procedures` (catalogue) remplacée par `/` → `/today` (action). Trois rôles, trois écrans. Premier vrai produit "moment-driven" de l'application.

---

## 1. Contexte

### 1.1 Pourquoi cet écran

L'application est aujourd'hui organisée autour de 9 entités techniques (procedures, sessions, visits, agents, sites, history, stats, links, contacts). Conséquence quotidienne documentée dans AUDIT-PRODUIT.md §1 :
- L'agent terrain reconstruit mentalement ce qu'il doit faire à partir de 3-4 écrans.
- Le manager n'a aucun tableau de bord opérationnel.
- L'admin voit un dashboard de tuiles sans valeur métier.

L'écran Aujourd'hui est le pivot produit V2 (cf. VISION-V2.md §1) : il transforme l'app **d'outil de saisie** en **outil de pilotage de la journée**.

### 1.2 État après Sprint 1

Capacités déjà livrées sur lesquelles V1 peut s'appuyer :
- **Toaster `sonner`** : feedback unifié (US-1.11).
- **`<ConfirmDialog>`** : confirmations propres en bottom-sheet mobile (US-1.11).
- **Annulation validation 5 min** : icône poubelle sur les validations récentes (US-1.12).
- **Sentry + logger structuré** : observabilité côté serveur (US-1.10) — exploitable côté ADMIN.
- **Backup quotidien `VACUUM INTO`** : date du dernier backup disponible côté ADMIN (US-1.8).
- **Rate-limit login + AuditLog `LOGIN_FAILED`** : signal détecté côté ADMIN (US-1.7).
- **Photos privées (path 32 octets + `noindex`)** : pas d'impact direct sur Today mais sécurité levée.

Composants encore à livrer en Sprint 2 (Epic E2) qui auraient été utiles ici :
- `<BottomSheet>` (US-2.1 de E2-F1) — utile pour les sections "Voir tous".
- `<EntityCard>` (US-2.2) — utile pour les cartes uniformes.
- Statuts pleine largeur (US-2.5).

**Arbitrage V1** : on n'attend pas E2 pour livrer Today. On utilise les composants existants (cards Tailwind, modales actuelles). Le re-skin sera fait en Sprint 3 quand E2 sera livré.

### 1.3 Ce qui change vs aujourd'hui

| Avant Sprint 2 | Après Sprint 2 (V1) |
|---|---|
| `/` redirige vers `/procedures` (catalogue) | `/` redirige vers `/today` (action) |
| Catalogue de procédures comme premier écran | Écran contextuel par rôle |
| Mobile : pas de Sessions ni Contacts au menu | Drawer "Plus" arrive en Sprint 2 (E1-F3 US-1.14) en parallèle |
| Manager doit ouvrir 3 écrans pour préparer sa tournée | Bannière diagnostic + 2 listes en 1 écran |
| Admin voit 5 tuiles statiques | Admin voit alertes système + usage 7j + à arbitrer |

### 1.4 Ce qui ne change PAS V1

- Les entités techniques (`/procedures`, `/sessions`, `/visits`, `/agents`, `/sites`) restent accessibles via la navigation. Aujourd'hui n'efface rien, il **précède**.
- Les rôles existants (USER, EDITOR, ADMIN) ne sont pas redécoupés. Variante d'écran selon `user.role`.
- Aucune nouvelle entité Prisma. V1 dérive tout depuis les tables existantes.

---

## 2. Sources de données V1 disponibles

Inventaire des **données déjà présentes** que V1 peut exploiter sans nouvelle migration.

### 2.1 Données utilisateur

| Source | Champs utilisés | Cas d'usage Today |
|---|---|---|
| `User` | `displayName`, `role`, `email`, `teamId`, `teamIds`, `viewAllTeams` | Salutation, scope, périmètre |
| `UserTeam` | `teamId`, `role (MEMBER\|MANAGER)` | Détermine variante EDITOR/MANAGER (V2) |
| `Team` | `name` | Affichage périmètre |

### 2.2 Travail en cours

| Source | Filtre | Cas d'usage |
|---|---|---|
| `VeilleSession` | `userId = me AND status IN (draft, active)` | Carte "En cours" — reprise instantanée |
| `SiteVisit` | `userId = me AND status IN (draft, active)` | Carte "En cours" alternative |

### 2.3 Actions à traiter

| Source | Filtre | Cas d'usage |
|---|---|---|
| `ImportedAction` | `localStatus = ACTIVE AND dueAt <= today + 1 AND scope team` | "À traiter aujourd'hui" |
| `ImportedAction` | `localStatus = ACTIVE AND dueAt < today` | Bucket "En retard" |
| `ActionValidation` | `userId = me AND createdAt > now - 5min` | Bandeau "Annulable" (existant Sprint 1) |

### 2.4 Visites et veilles à prévoir

| Source | Filtre | Cas d'usage |
|---|---|---|
| `Site` + last `SiteVisit` | `site.lastVisitDate + estimatedFreq < today + 7` | "Sites sans visite récente" (EDITOR) |
| `SiteVisitTemplate.expectedFrequencyDays` | Cross-join avec `SiteVisit` complétées | Rappel visite trimestrielle (V1 simplifié) |
| `Agent` + last `AgentSighting` | Tri freshness ascendant | "Agents à veiller" (EDITOR) |

**Note** : V1 utilise `expectedFrequencyDays` existant mais sans le Hub Échéances. Le calcul reste côté requête Prisma, non agrégé dans un service dédié.

### 2.5 Péremptions équipements

| Source | Filtre | Cas d'usage |
|---|---|---|
| `SiteEquipment` | `expirationDate < today + 30 AND isActive = true AND scope team` | "Équipements en péremption" (USER + EDITOR) |

**Note** : champ `expirationDate` déjà présent. Pas besoin du modèle étendu Sprint 4.

### 2.6 Données système (ADMIN)

| Source | Champs | Cas d'usage |
|---|---|---|
| `User` | `count(*)`, `count(active)` | État global |
| `Team` | `count(*)` | État global |
| `VeilleSession` | `count WHERE status = draft AND updatedAt < now - 30d` | Alerte sessions orphelines |
| `AuditLog` | `count(action = LOGIN_FAILED, last 24h)` | Alerte tentatives échouées |
| `AuditLog` | dernières entrées | Activité récente système |
| Filesystem | mtime de `data/backups/latest.db` | Statut backup |
| `ActionImport` | `status = SUCCESS, last 7d` | Statistique imports |

### 2.7 Activité récente (transverse)

| Source | Filtre | Cas d'usage |
|---|---|---|
| `VeilleSession` | `userId = me, completedAt DESC LIMIT 3` | "Dernières activités" |
| `SiteVisit` | idem | idem |
| `ActionValidation` | `userId = me, createdAt DESC LIMIT 3` | idem |
| `AgentSighting` | `userId = me, createdAt DESC LIMIT 3` | idem |

Fusion côté serveur en un flux trié par date.

### 2.8 Ce qui MANQUE en V1 (et qu'on assume)

- **Pas de `Echeance`** stockée. Toute "échéance" V1 est une vue dérivée à la volée par l'agrégateur.
- **Pas de `nextCheckDate`** sur équipement → V1 utilise `expirationDate` uniquement.
- **Pas d'habilitations agent** (`AgentHabilitation`) → pas remontables V1.
- **Pas d'exercices périodiques** → pas remontables V1.
- **Pas de notifications push** → pas de "réveil" hors-app V1.
- **Pas de QR Code scan** → l'entrée "Scanner QR" est absente des raccourcis V1.
- **Pas de manager d'équipe assignable** (US-8.4) → variante EDITOR basée sur `User.role = EDITOR` uniquement.

---

## 3. Principes communs aux 3 rôles

### 3.1 Promesse partagée

> **En 2 secondes après ouverture, je sais si j'ai quelque chose à faire. En 5 secondes, je sais quoi.**

### 3.2 Structure invariante (tous rôles)

```
┌─────────────────────────────────────────┐
│ Header                                  │  ← Identité + contexte (40-56 px)
├─────────────────────────────────────────┤
│ Bannière prioritaire (conditionnelle)   │  ← Action ou alerte critique
├─────────────────────────────────────────┤
│ Section 1 — la plus urgente             │  ← 1-3 cartes
├─────────────────────────────────────────┤
│ Section 2 — l'opérationnel              │  ← Listes courtes, 3-5 items
├─────────────────────────────────────────┤
│ Section 3 — les raccourcis              │  ← 3 boutons gros
├─────────────────────────────────────────┤
│ Section 4 — la trace                    │  ← 3 lignes activité récente
└─────────────────────────────────────────┘
```

### 3.3 Règles d'or

1. **Aucun item > 8 sur la page**. Si plus, lien "Voir tous (N) →".
2. **Aucun graphe, aucune courbe**. Aujourd'hui = action, pas analyse. Les stats sont sur `/stats`.
3. **Code couleur strict** :
   - 🔴 rouge : retard, urgent, action exigée.
   - 🟠 orange : prochain, à anticiper (J-7 à J+3).
   - 🟡 jaune : à surveiller (J+4 à J+30).
   - 🟢 vert : OK, sous contrôle.
   - ⚪ gris : information neutre.
4. **Mobile : pleine largeur**, pas de colonnes.
5. **Desktop ≥ lg** : 2 colonnes pour rentabiliser l'espace (sections 1+2 à gauche, 3+4 à droite).
6. **Pull-to-refresh actif** sur mobile (geste natif).
7. **Toute carte est cliquable** vers son détail. Pas de carte muette.
8. **CTA contextuel** sur chaque carte ("Reprendre", "Valider", "Démarrer", "Voir") — verbe d'action, pas substantif.
9. **Pas de pagination** sur Today : si l'item ne tient pas dans les 5, il est sur `/echeances` (V2) ou sa page d'origine (V1).
10. **Performances** : la page entière se charge en < 500 ms en SSR. Tout calcul lourd → différé en client-side ou cache.

### 3.4 Comportements partagés

- **Au chargement** : SSR avec rendu instantané du squelette + données.
- **Rafraîchissement** : automatique à l'`onfocus` de la fenêtre (si > 60 s depuis dernier refresh) + pull-to-refresh manuel.
- **Vide d'état** : si rien à traiter, message positif explicite ("Tout est à jour ✓") + raccourcis amplifiés.

---

## 4. Aujourd'hui — USER terrain

### 4.1 Personas

**Persona principal** : Jessy, agent SNCF, 35 ans, équipe Rive Droite. Travaille en horaires postés. Ouvre l'app le matin pour reprendre sa veille de la veille, en cours de journée pour valider des actions de son carnet, et le soir pour clôturer.

**Persona secondaire** : Pierre, agent occasionnel, ouvre l'app 1-2 fois par semaine. A oublié comment elle est organisée. Doit comprendre en 5 secondes.

### 4.2 Besoins identifiés (extraits AUDIT-PRODUIT §1)

| # | Besoin | Source |
|---|---|---|
| 1 | Reprendre instantanément une veille de la veille | Top irritant #1 |
| 2 | Voir les actions à valider sur mon scope aujourd'hui | Douleur prioritaire #1 |
| 3 | Voir les visites/contrôles que j'ai laissés en brouillon | Douleur #4 |
| 4 | Appeler l'astreinte sans chercher dans `/contacts` | Douleur prioritaire #5 |
| 5 | Démarrer une nouvelle veille / visite sans 3 clics | Vision E3-F3 |
| 6 | Voir ce que j'ai fait hier (continuité, fierté) | UX V1 §6.2 |

### 4.3 Sections détaillées V1

#### Section A — Salutation (40-60 px)

```
Bonjour Jessy ☀️
Lundi 14 juin · Équipe Rive Droite
```

- **Emoji selon heure** : ☀️ 7h-17h, 🌙 17h-7h. Détecté côté client (timezone navigateur).
- **Date FR** : `lundi 14 juin` avec `Intl.DateTimeFormat` (déjà disponible).
- **Équipe principale** : `User.teamId` ou première de `teamIds` si multi. Si `viewAllTeams = true`, afficher "Toutes mes équipes".
- **Pas de cliquable, pas d'image, pas de badge**. Sobre.

#### Section B — En cours (carte sticky, conditionnelle, ~100 px)

S'affiche uniquement si l'utilisateur a une session OU visite en `draft|active`.

```
┌────────────────────────────────────┐
│ 🎯 EN COURS                        │
│ Veille SP-12 · Bardella J.         │
│ Démarrée à 09:14 · 4/12 points     │
│                      [Reprendre →] │
└────────────────────────────────────┘
```

**Règles** :
- Une carte max. Si plusieurs en cours, on prend la plus récente (`max(updatedAt)`).
- Couleur fond : violet doux (≠ urgent rouge, ≠ neutre gris).
- Bouton "Reprendre" pleine largeur sur mobile, à droite sur desktop.
- Lien : `/sessions/{id}` ou `/visits/{id}`.
- Si > 7 jours en brouillon : préfixe "⚠️ Brouillon ancien" pour signaler le rappel.

#### Section C — À traiter aujourd'hui (3-5 cartes, ~300 px)

Agrège trois sources :
1. **Actions ImportedAction assignées à moi (V1 : sur ma team)** avec `dueAt ≤ today + 1` ou en retard.
2. **Brouillons sessions/visites en attente** depuis plus de 3 jours.
3. **Équipements en péremption** (si responsabilité USER sur site, V1 utilise scope team).

**Affichage** :
```
À TRAITER AUJOURD'HUI            3 items
┌────────────────────────────────────┐
│ 🔴 Action en retard · 3 jours      │
│ Affichage signalisation poste 7    │
│ Dupont M. · échéance 10/06         │
│                       [Valider →]  │
├────────────────────────────────────┤
│ 🟠 Veille de site prévue           │
│ Poste de Peyraud · dans 2 jours    │
│                       [Démarrer →] │
├────────────────────────────────────┤
│ 🟡 Extincteur expirant             │
│ POS-LYON · expire dans 18 jours    │
│                          [Voir →]  │
└────────────────────────────────────┘
```

**Règles V1** :
- Max 5 cartes. Au-delà, lien "Voir toutes (N) → /echeances" (V1 simplifié : redirige vers la page d'origine la plus probable, ex. `/actions?status=ACTIVE`).
- Tri : urgence DESC, puis priorité métier, puis date DESC.
- Si 0 item : message "Aucune urgence aujourd'hui 🎉" + raccourcis amplifiés.
- CTA varie selon le type :
  - Action → `[Valider →]` (ouvre la modale ValidateModal existante).
  - Visite → `[Démarrer →]` (ouvre `/visits/new?siteId=...`).
  - Équipement → `[Voir →]` (ouvre `/sites/{id}#equipment-{id}`).
  - Brouillon → `[Reprendre →]` (ouvre la page).

#### Section D — Raccourcis natifs (3 boutons gros, ~110 px)

```
RACCOURCIS
┌─────────┐ ┌─────────┐ ┌─────────┐
│   📱    │ │   📞    │ │   🏛️    │
│Nouvelle │ │Astreinte│ │Nouvelle │
│ veille  │ │         │ │ visite  │
└─────────┘ └─────────┘ └─────────┘
```

**Règles V1** :
- 3 boutons en `grid grid-cols-3 gap-3 min-h-[96px]`. Cible touch ≥ 48 px (conforme HIG).
- "Nouvelle veille" → `/start/veille` (US-3.13 si livrée, sinon `/procedures` actuel).
- "Astreinte" → lien `tel:` direct si convention `Contact.tags` contient `"astreinte"` ou `"24/7"`. Si plusieurs : ouvre `/contacts?tag=astreinte`. Si aucun : bouton désactivé + tooltip "Configurer un contact d'astreinte dans Admin → Contacts".
- "Nouvelle visite" → `/visits/new`.

**Note** : "Scanner QR" du concept original VISION-V2 §4.1 est repoussé Sprint 5 (E10). En V1, remplacé par "Nouvelle visite" qui couvre 90 % du besoin.

#### Section E — Dernières activités (3 lignes, ~80 px)

```
DERNIÈRES ACTIVITÉS
Hier 17:22 · Vu Martin L. (POS-VALENCE)
Hier 14:08 · Veille SP-04 terminée
Hier 09:30 · Visite trimestrielle POS-LYON
```

**Règles V1** :
- 3 lignes texte. Non cliquables (sentiment de continuité, pas navigation).
- Source : merge de `VeilleSession.completedAt`, `SiteVisit.completedAt`, `AgentSighting.createdAt`, `ActionValidation.createdAt` filtrés sur `userId = me`, triés DESC, limit 3.
- Format date relatif : "Aujourd'hui HH:MM", "Hier HH:MM", "Lundi 12 juin" au-delà.

### 4.4 Algorithme de priorisation USER V1

```
Pour chaque item candidat :
  score = urgency_weight × type_weight × ownership_weight

urgency_weight :
  late_by_7_days+    → 100  (rouge)
  late_by_1_to_6     → 80
  due_today          → 70
  due_in_1_to_2      → 50   (orange)
  due_in_3_to_7      → 30   (jaune)
  due_in_8_to_30     → 10   (jaune)

type_weight :
  ImportedAction         × 1.0    (cœur métier)
  Visite brouillon       × 0.9
  Session brouillon      × 0.8
  Équipement péremption  × 0.7
  Visite planifiée       × 0.6
  Veille suggérée        × 0.4

ownership_weight :
  Assigned to me directly → 1.5
  On my team              → 1.0
  On viewAllTeams scope   → 0.7
```

**Tri** : score DESC. Tie-break : `dueAt ASC` puis `updatedAt DESC`.

**Note V1** : "Assigned to me directly" n'existe pas formellement (modèle action n'a pas `assignedUserId`). V1 utilise donc `ownership = team_match` uniquement. Le cas "assigné à moi" arrive avec Hub Échéances Sprint 4.

### 4.5 Maquette textuelle complète — USER mobile portrait

```
┌──────────────────────────────────────────┐
│  ☰   VEILLE              🔔₃   👤        │  ← top bar 56 px
├──────────────────────────────────────────┤
│                                          │
│  Bonjour Jessy ☀️                        │
│  Lundi 14 juin · Équipe Rive Droite     │
│                                          │
│ ┌────────────────────────────────────┐   │
│ │ 🎯 EN COURS                        │   │
│ │ Veille SP-12 · Bardella J.         │   │
│ │ Démarrée à 09:14 · 4/12 points     │   │
│ │                      [Reprendre →] │   │
│ └────────────────────────────────────┘   │
│                                          │
│  À TRAITER AUJOURD'HUI         3 items   │
│ ┌────────────────────────────────────┐   │
│ │ 🔴 Action en retard · 3 jours      │   │
│ │ Affichage signalisation poste 7    │   │
│ │ Dupont M. · échéance 10/06         │   │
│ │                       [Valider →]  │   │
│ ├────────────────────────────────────┤   │
│ │ 🟠 Veille de site prévue           │   │
│ │ Poste de Peyraud · dans 2 jours    │   │
│ │                       [Démarrer →] │   │
│ ├────────────────────────────────────┤   │
│ │ 🟡 Extincteur expirant             │   │
│ │ POS-LYON · expire dans 18 jours    │   │
│ │                          [Voir →]  │   │
│ └────────────────────────────────────┘   │
│                                          │
│  RACCOURCIS                              │
│ ┌─────────┐ ┌─────────┐ ┌─────────┐     │
│ │   📱    │ │   📞    │ │   🏛️    │     │
│ │Nouvelle │ │Astreinte│ │Nouvelle │     │
│ │ veille  │ │         │ │ visite  │     │
│ └─────────┘ └─────────┘ └─────────┘     │
│                                          │
│  DERNIÈRES ACTIVITÉS                     │
│  Hier 17:22 · Vu Martin L. (POS-VALENCE)│
│  Hier 14:08 · Veille SP-04 terminée     │
│  Hier 09:30 · Visite trimestrielle      │
│                                          │
├──────────────────────────────────────────┤
│  🏠₃    📋    📊    🔗    ⋯              │  ← bottom-nav 64 px
└──────────────────────────────────────────┘
```

**Hauteur cumulée mobile (iPhone SE — viewport 568 px sans chrome)** :
- Top bar : 56 px
- Salutation : 60 px
- Carte "En cours" : 108 px
- Section "À traiter" header : 28 px + 3 cartes × 84 px = 280 px
- Raccourcis header + 3 boutons : 28 + 96 = 124 px
- Section "Activités" : 28 + 60 = 88 px
- Bottom-nav : 64 px
- **Total** : 808 px → scroll de ~240 px sur iPhone SE.

**Visible sans scroll sur iPhone SE** : Salutation + Carte "En cours" + 1ère carte "À traiter" + une partie de la 2ᵉ. Suffisant pour donner la promesse "voir ce qui est urgent".

### 4.6 Adaptation desktop USER

Sur ≥ lg :
- 2 colonnes : Salutation pleine largeur, puis grille.
- **Gauche (66%)** : En cours + À traiter aujourd'hui.
- **Droite (33%)** : Raccourcis (en colonne stack) + Dernières activités.

---

## 5. Aujourd'hui — EDITOR manager

### 5.1 Personas

**Persona principal** : Marie, DPX (Dirigeant de Proximité), 42 ans, périmètre 3 équipes / 12 sites / 47 agents. Ouvre l'app le matin à 7h50 pour préparer sa tournée avant la prise de service de ses agents.

**Persona secondaire** : Sébastien, COSI (Chef Opérationnel), 38 ans, périmètre 1 grande équipe. Utilise l'app surtout pour valider en lot et pour préparer le brief hebdomadaire.

### 5.2 Besoins identifiés

| # | Besoin | Source |
|---|---|---|
| 1 | Voir d'un coup d'œil ce qui est en retard sur mon périmètre | Douleur prioritaire #1 |
| 2 | Connaître les agents qui n'ont pas eu de veille récemment | M-01 dashboard manager |
| 3 | Connaître les sites qui n'ont pas eu de visite récemment | M-01 |
| 4 | Voir les NC ouvertes sur mon périmètre | M-05 |
| 5 | Naviguer vers l'action depuis l'indicateur | Drill-down M-18 |

### 5.3 Variante EDITOR — détection V1

**Question** : qui voit la variante manager ?
- **V1 simple** : `user.role = EDITOR` ou `user.role = ADMIN`.
- **V2 (après US-8.4)** : `user.role = EDITOR` OU `UserTeam.role = MANAGER` sur au moins une équipe.

Décision V1 : on prend `role IN (EDITOR, ADMIN)`. ADMIN voit la variante EDITOR + un complément "Pilotage système" repliable en bas (voir §6).

### 5.4 Sections détaillées EDITOR V1

#### Section A — Titre tournée (60 px)

```
MA TOURNÉE — Lundi 14 juin
Périmètre : 3 équipes · 12 sites · 47 agents
```

- Source périmètre : agrégation des équipes de l'EDITOR (via `User.teamIds + viewAllTeams`).
- Tooltip cliquable "Voir le détail du périmètre" → ouvre liste équipes/sites.

#### Section B — Bannière diagnostic (carte sticky, ~100 px)

```
┌────────────────────────────────────┐
│ 🚨 ATTENTION                       │
│ 3 actions en retard > 7 j          │
│ 2 visites trimestrielles en retard │
│ 1 extincteur périmé hier           │
│                  [Voir le détail] │
└────────────────────────────────────┘
```

**Règles V1** :
- **🟢 vert** "Tout est sous contrôle ✓" si 0 retard.
- **🟡 jaune** "À surveiller" si 1-2 items en orange.
- **🔴 rouge** "Attention" si 1+ item en retard rouge.
- **Données V1** :
  - "Actions en retard > 7 j" : count `ImportedAction WHERE localStatus = ACTIVE AND dueAt < today - 7 AND scope team`.
  - "Visites trimestrielles en retard" : V1 simplifié — count `Site WHERE lastVisitDate < today - SiteVisitTemplate.expectedFrequencyDays`. Requête à mesurer en perf.
  - "Extincteur périmé" : count `SiteEquipment WHERE expirationDate < today AND isActive = true AND scope team`.
- CTA "Voir le détail" → V1 : redirige vers `/visits?filter=overdue` ou page liste correspondante (V2 : `/echeances?priority=P0`).

#### Section C — Cette semaine (3 progress bars, ~140 px)

```
CETTE SEMAINE
┌────────────────────────────────────┐
│ Visites planifiées       3 / 5 ✓   │
│ ████████░░░░░░  60 %               │
├────────────────────────────────────┤
│ Veilles équipe           12 / 15   │
│ ██████████░░░░  80 %               │
├────────────────────────────────────┤
│ Actions clôturées         9 / 12   │
│ █████████░░░░░  75 %               │
└────────────────────────────────────┘
```

**Règles V1** :
- "Visites planifiées" : V1 = `SiteVisit WHERE status = completed AND completedAt BETWEEN weekStart AND today` vs objectif = nombre attendu cette semaine (V1 simplifié : objectif = nombre attendu = `sites.count × 1/4` arrondi sup. pour une cadence trimestrielle approx., à affiner avec le PO).
- "Veilles équipe" : `count VeilleSession WHERE status = completed AND completedAt BETWEEN weekStart AND today AND scope team` vs objectif (V1 simplifié : 1 veille / agent / mois → `agents.count × 1/4` par semaine).
- "Actions clôturées" : `count ImportedAction WHERE localStatus = VALIDATED_LOCAL AND validatedAt BETWEEN weekStart AND today AND scope team` vs ouvertes au début de la semaine.

**Note V1** : les objectifs sont des heuristiques. Le PO doit valider. Sinon, V1 affiche uniquement la barre de progression sans objectif ("12 veilles cette semaine") pour éviter une fausse mesure.

#### Section D — Agents à veiller (5 items max, ~220 px)

```
AGENTS À VEILLER
Bardella J.   · 38 jours sans veille    [Veiller →]
Schmidt F.    · 32 jours                [Veiller →]
Pereira L.    · 28 jours                [Veiller →]
Dupuis A.     · 24 jours                [Veiller →]
Bernard M.    · 21 jours                [Veiller →]
─────────────────── [Voir tous (7) →]
```

**Règles V1** :
- Tri freshness DESC : `Agent.lastSessionAt ASC` (les plus anciens d'abord).
- Filtre : `Agent.isVisible = true AND scope team`. Exclure agents non visibles à l'utilisateur (M15).
- Seuil rouge : > 30 j. Seuil orange : 14-30 j. Seuil jaune : 7-14 j.
- "Voir tous (N) →" si > 5. Lien vers `/agents?sort=freshness_desc` (page existante).
- CTA "Veiller" → `/start/veille?agentId={id}` (V1 : si US-3.13 livrée) ou `/sessions/new?agentId={id}` (V1 fallback).

#### Section E — Sites sans visite (5 items max, ~220 px)

```
SITES SANS VISITE
POS-Peyraud   · 94 jours · retard       [Visiter →]
POS-Givors    · 78 jours · à venir 7j   [Visiter →]
POS-Vienne    · 65 jours                [Visiter →]
POS-Albon     · 52 jours                [Visiter →]
POS-Roussillon · 41 jours               [Visiter →]
─────────────────── [Voir tous (4) →]
```

**Règles V1** :
- Tri par `(lastVisitDate + expectedFrequencyDays) - today` ascendant.
- Si site sans `expectedFrequencyDays` : V1 utilise 90 j par défaut.
- Si site sans visite jamais : tri par `Site.createdAt ASC`.
- CTA "Visiter" → `/visits/new?siteId={id}`.

#### Section F — Raccourcis manager (3 boutons, ~110 px)

```
RACCOURCIS
┌─────────┐ ┌─────────┐ ┌─────────┐
│   📥    │ │   📊    │ │   📋    │
│Importer │ │  Stats  │ │Échéances│
│  Excel  │ │ équipe  │ │ équipe  │
└─────────┘ └─────────┘ └─────────┘
```

- "Importer Excel" → `/admin/imports/actions`.
- "Stats équipe" → `/stats?team={teamId}`.
- "Échéances équipe" V1 : redirige vers `/visits?filter=overdue` (V2 : `/echeances?scope=team`).

### 5.5 Algorithme de priorisation EDITOR V1

Sur la bannière diagnostic et le tri des sections D et E :

```
État global =
  si count(retard P0) > 0  → 🔴 ATTENTION
  sinon si count(orange) > 2 → 🟡 À SURVEILLER
  sinon → 🟢 TOUT EST SOUS CONTRÔLE

Items P0 (retard) inclus :
  - Actions actives avec dueAt < today
  - Sites avec dernière visite > (lastVisit + expectedFreq) (retard absolu)
  - Équipements avec expirationDate < today

Items orange inclus :
  - Actions actives avec dueAt entre today et today+7
  - Sites avec retard imminent < 7 j
  - Équipements expirant < 30 j
```

### 5.6 Maquette textuelle complète — EDITOR mobile portrait

```
┌──────────────────────────────────────────┐
│  ☰   VEILLE              🔔₁₂  👤        │
├──────────────────────────────────────────┤
│                                          │
│  MA TOURNÉE — Lundi 14 juin              │
│  3 équipes · 12 sites · 47 agents        │
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
│  Bardella J.   · 38 jours    [Veiller →] │
│  Schmidt F.    · 32 jours    [Veiller →] │
│  Pereira L.    · 28 jours    [Veiller →] │
│  ─────────────────── [Voir tous (7) →]   │
│                                          │
│  SITES SANS VISITE                       │
│  POS-Peyraud   · 94 j retard [Visiter →] │
│  POS-Givors    · 78 j        [Visiter →] │
│  ─────────────────── [Voir tous (4) →]   │
│                                          │
│  RACCOURCIS                              │
│ ┌─────────┐ ┌─────────┐ ┌─────────┐     │
│ │   📥    │ │   📊    │ │   📋    │     │
│ │Importer │ │  Stats  │ │Échéances│     │
│ │  Excel  │ │ équipe  │ │ équipe  │     │
│ └─────────┘ └─────────┘ └─────────┘     │
│                                          │
├──────────────────────────────────────────┤
│  🏠₃    📋    📊    🔗    ⋯              │
└──────────────────────────────────────────┘
```

**Hauteur cumulée** : ~1100 px → scroll de ~530 px attendu. Acceptable car l'EDITOR a besoin de scanner plusieurs sections.

### 5.7 Adaptation desktop EDITOR

Sur ≥ lg, 2 colonnes :
- **Gauche (50%)** : Titre + Bannière + Cette semaine.
- **Droite (50%)** : Agents à veiller + Sites sans visite + Raccourcis.

---

## 6. Aujourd'hui — ADMIN

### 6.1 Personas

**Persona principal** : Marc, administrateur applicatif, ouvre l'app 2-3 fois par semaine pour vérifier l'état du système et arbitrer les demandes utilisateurs.

**Persona secondaire** : Marie (EDITOR avec rôle ADMIN) — voit la variante EDITOR + un bloc système replié en bas.

### 6.2 Besoins identifiés

| # | Besoin | Source |
|---|---|---|
| 1 | Savoir si le système est OK | Vision §6.4 |
| 2 | Voir les alertes système (erreurs, sessions orphelines, MDP expirants) | Vision §6.4 |
| 3 | Suivre l'usage (combien d'utilisateurs, combien de veilles) | Vision §6.4 |
| 4 | Arbitrer les demandes (nouveaux users, reset MDP) | M-09 + Vision |
| 5 | Accès rapide à AuditLog et création user | Vision §6.4 |

### 6.3 Sections détaillées ADMIN V1

#### Section A — État global (carte verte/jaune/rouge, ~80 px)

```
┌────────────────────────────────────┐
│ État global                  ✅ OK  │
│ 247 utilisateurs · 8 équipes       │
│ Dernier backup : hier 02:00 ✓      │
└────────────────────────────────────┘
```

**Règles V1** :
- ✅ OK si : 0 erreur 5xx 24h ET dernier backup < 36h ET 0 alerte critique.
- ⚠ Dégradé si : 1+ erreur 5xx mineure OU backup > 36h OU 3+ alertes mineures.
- 🛑 Incident si : Sentry remonte une erreur critique récente OU backup > 72h.
- "Erreurs 5xx 24h" : V1 simplifié = lecture côté serveur du compteur Sentry ou de notre logger structuré (Sprint 1 livré). À défaut, V1 V0.5 = lecture des erreurs locales si on les a journalisées.
- "Dernier backup" : `mtime` du fichier `data/backups/latest.db` (script Sprint 1).

#### Section B — Alertes système (~150 px)

```
ALERTES SYSTÈME
┌────────────────────────────────────┐
│ 🟡 12 sessions brouillon > 30 j    │
│ 🟡 5 tentatives login échouées 24h │
│ 🟢 0 erreur 5xx ces dernières 24h  │
└────────────────────────────────────┘
```

**Règles V1** :
- "Sessions brouillon > 30 j" : count `VeilleSession WHERE status = draft AND updatedAt < now - 30d`. Cliquable → `/admin/sessions?filter=draft_old` (V2). En V1 : ouvre `/sessions?status=draft`.
- "Tentatives login échouées 24h" : count `AuditLog WHERE action = LOGIN_FAILED AND createdAt > now - 24h`. Si > 10 : 🟠 orange. Si > 50 : 🔴 rouge.
- "0 erreur 5xx" : voir §A.
- Liste limitée à 5 alertes max. Au-delà : "Voir tout (N)".

#### Section C — Usage 7 derniers jours (~150 px)

```
USAGE
┌────────────────────────────────────┐
│ Connexions 7j        2 847         │
│ Veilles 7j             238         │
│ Visites 7j              42         │
│ Actions validées 7j    489         │
│ Photos uploadées 7j  1 124         │
└────────────────────────────────────┘
```

**Règles V1** :
- Calculs SQL simples (counts agrégés sur 7 jours).
- Chaque ligne cliquable → drill-down filtre 7j.
- Pas de graphe, pas de comparaison vs semaine précédente (V2).

#### Section D — À arbitrer (~120 px)

```
À ARBITRER
┌────────────────────────────────────┐
│ 2 utilisateurs sans équipe         │  → /admin/users?filter=orphan
│ 1 demande de réinit. MDP           │  → V2 (US-1.13 reset email)
└────────────────────────────────────┘
```

**Règles V1** :
- "Utilisateurs sans équipe" : count `User WHERE teamId IS NULL AND teamIds IS EMPTY AND isActive = true`. Cliquable → `/admin/users?filter=orphan`.
- "Demandes de réinit. MDP" V1 : pas livré (US-1.13 reset email arrive Sprint 1 d'après backlog mais report possible). Si pas livré, section masquée.
- "Demandes d'annulation > 5 min" : pas applicable V1 (l'annulation est < 5 min en self-service Sprint 1, pas de workflow d'arbitrage).

#### Section E — Actions rapides ADMIN (3 boutons, ~110 px)

```
ACTIONS RAPIDES
┌─────────┐ ┌─────────┐ ┌─────────┐
│   👤+   │ │   📄    │ │   📥    │
│ Nouvel  │ │  Logs   │ │ Imports │
│  user   │ │  audit  │ │         │
└─────────┘ └─────────┘ └─────────┘
```

- "Nouvel user" → `/admin/users?action=new` (modale ouverte).
- "Logs audit" V1 : redirige vers la page `/admin/audit` si livrée (US-8.1 Sprint 3). V1 : redirige vers liste filtrée AuditLog (page minimale en V1 ?). Décision : si page non livrée, on remplace par "Sites" (lien `/admin/sites`).
- "Imports" → `/admin/imports`.

### 6.4 Variante ADMIN qui est aussi EDITOR

L'ADMIN voit **deux blocs** :
1. **En haut** : la variante EDITOR (sa tournée en tant que manager — utile s'il fait aussi du terrain).
2. **En dessous, replié par défaut** : "Pilotage système" qui contient les sections A à E ci-dessus.

Toggle "Afficher pilotage système" / "Masquer".

**Décision V1** : si l'utilisateur n'a aucune équipe (ADMIN pur), affiche directement le pilotage système sans bloc EDITOR vide.

### 6.5 Maquette textuelle complète — ADMIN mobile portrait

```
┌──────────────────────────────────────────┐
│  ☰   VEILLE              🔔₃   👤        │
├──────────────────────────────────────────┤
│                                          │
│  PILOTAGE SYSTÈME — Lundi 14 juin        │
│                                          │
│ ┌────────────────────────────────────┐   │
│ │ État global                  ✅ OK  │   │
│ │ 247 utilisateurs · 8 équipes       │   │
│ │ Dernier backup : hier 02:00 ✓     │   │
│ └────────────────────────────────────┘   │
│                                          │
│  ALERTES SYSTÈME                         │
│ ┌────────────────────────────────────┐   │
│ │ 🟡 12 sessions brouillon > 30 j    │   │
│ │ 🟡 5 tentatives login échouées 24h │   │
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
│  À ARBITRER                              │
│ ┌────────────────────────────────────┐   │
│ │ 2 utilisateurs sans équipe         │   │
│ │ 1 demande de réinit. MDP           │   │
│ └────────────────────────────────────┘   │
│                                          │
│  ACTIONS RAPIDES                         │
│ ┌─────────┐ ┌─────────┐ ┌─────────┐     │
│ │   👤+   │ │   📄    │ │   📥    │     │
│ │ Nouvel  │ │  Logs   │ │ Imports │     │
│ │  user   │ │  audit  │ │         │     │
│ └─────────┘ └─────────┘ └─────────┘     │
│                                          │
├──────────────────────────────────────────┤
│  🏠    📋    📊    🔗    ⋯               │
└──────────────────────────────────────────┘
```

---

## 7. Algorithme de priorisation (transverse)

### 7.1 Catégories d'urgence

| Niveau | Couleur | Critère temporel | Critère métier |
|---|---|---|---|
| **Urgent** | 🔴 rouge | Retard (échéance dépassée) ou impact immédiat | Action de sécurité, NC ouverte critique |
| **Important** | 🟠 orange | Échéance dans 1-3 jours | Visite trimestrielle, péremption < 7j |
| **À surveiller** | 🟡 jaune | Échéance dans 4-30 jours | Veille à programmer, péremption < 30j |
| **Information** | ⚪ gris | Pas d'échéance | Continuité (dernières activités) |

### 7.2 Score de priorisation (commun aux 3 rôles)

```
score = base_priority + urgency_weight + role_weight

base_priority par type :
  Action critique sécurité  → 100
  Action légale             → 90
  Visite réglementaire      → 80
  Visite standard           → 60
  Péremption équipement     → 70
  Veille suggérée           → 30
  Brouillon ancien          → 20

urgency_weight :
  Retard > 7 j           → +100
  Retard 1-6 j           → +80
  Aujourd'hui            → +70
  J+1, J+2               → +50
  J+3 à J+7              → +30
  J+8 à J+30             → +10

role_weight (V1) :
  Mon scope direct       → ×1.5
  Scope équipe           → ×1.0
  Scope cross-équipe     → ×0.7

Tri final : score DESC, dueAt ASC, updatedAt DESC.
```

### 7.3 Règles d'agrégation V1

- **Pas d'entité `Echeance`** stockée. L'agrégateur est un service en lecture qui scanne 4-6 sources et compose la liste à la volée.
- **Cache court 30 s** côté client (React Query / SWR) pour éviter le re-fetch à chaque interaction.
- **Calcul côté serveur** dans une route dédiée `GET /api/today?role=USER|EDITOR|ADMIN`. Retourne le payload nécessaire à la page.

### 7.4 Exemples concrets

**USER, lundi matin, 3 cartes "À traiter"** :
- (rouge) Action `dueAt = 11/06` (3j retard, type "action légale") → score = 90 + 80 = 170.
- (orange) Visite `Peyraud, dueAt = 16/06` (J+2, trimestrielle) → score = 80 + 50 = 130.
- (jaune) Extincteur expirant 02/07 (J+18, péremption) → score = 70 + 10 = 80.

Tri : action retard > visite > péremption. ✓

**EDITOR, bannière** :
- 3 actions retard > 7 j → bannière 🔴 ATTENTION.
- 2 visites en retard > 7 j → idem.
- → "ATTENTION" reste 🔴.

**ADMIN, état global** :
- 0 erreur 5xx 24h ET backup hier 02:00 ET 12 sessions orphelines (mineur) → ✅ OK avec ⚠ jaune mineur sur sessions.

### 7.5 Cas limites

- **0 item à traiter (USER)** : message "Aucune urgence aujourd'hui 🎉" + raccourcis agrandis. Pas d'anxiété créée artificiellement.
- **> 10 items (EDITOR)** : afficher 5 + "Voir tous (N) →". Ne pas paginer dans Today.
- **Utilisateur sans équipe** : message "Aucune équipe assignée. Contactez votre admin." + lien `/contacts`.
- **Donnée manquante** (ex. `lastVisitDate` NULL) : exclure de l'agrégation, ne pas afficher "0 jours" trompeur.

---

## 8. Approche mobile-first

### 8.1 Stratégie

L'écran Aujourd'hui est conçu **mobile portrait d'abord** (320 px de large minimum). Le desktop est une amplification, pas une cible primaire.

### 8.2 Structure layout

| Élément | Hauteur cible mobile | Comportement |
|---|---|---|
| Top-bar app | 56 px sticky | Existant |
| Header Today (salutation/titre) | 50-70 px | Non-sticky |
| Bannière prioritaire | 100-120 px conditionnel | Sticky sous top-bar |
| Sections | 200-300 px chacune | Scroll naturel |
| Raccourcis | 110 px (3 boutons 96 px + padding) | Avant le footer |
| Bottom-nav | 64 px sticky | Existant |

### 8.3 Hauteurs cibles iPhone SE (568 px viewport)

**Visible sans scroll au chargement** (~448 px utiles après top + bottom nav) :
- Salutation / titre : ~60 px
- 1 carte sticky "En cours" ou bannière : ~110 px
- Header "À traiter" : ~28 px
- 1ère carte : ~84 px
- Début de la 2ᵉ carte : ~80 px partiel
- **Total** : ~362 px visibles, ~86 px de "respiration" en bas → suffisant pour comprendre la situation.

**Contraintes acceptées V1** :
- L'utilisateur scrolle pour voir les sections D-E (raccourcis et activités).
- Mais ce n'est pas pénalisant : les 2 premières sections (En cours + À traiter) couvrent 90 % de la valeur.

### 8.4 Gestes natifs supportés V1

- **Pull-to-refresh** : déclenche un fetch de `/api/today`. Toast "Mis à jour" en succès.
- **Tap sur carte** : navigation vers détail.
- **Tap sur CTA** : action (modale ou navigation).
- **Long press** : pas géré V1 (V2 pour menu contextuel).
- **Swipe** : pas géré V1 (V3 avec `<EntityCard>` US-2.3).

### 8.5 Nombre de cartes visibles sans scroll

| Rôle | Au-dessus du fold |
|---|---|
| USER | Salutation + carte "En cours" + 1ère carte "À traiter" |
| EDITOR | Titre + bannière diagnostic + début progress bars |
| ADMIN | Titre + carte "État global" + 1ère alerte |

### 8.6 Adaptation desktop ≥ lg

- Grille 12 colonnes, contenu max-width 1100 px centré.
- **USER** : colonne gauche 8/12 (en cours + à traiter) + colonne droite 4/12 (raccourcis + activités).
- **EDITOR** : 6/6 (gauche : titre + bannière + cette semaine ; droite : agents + sites + raccourcis).
- **ADMIN** : 6/6 (gauche : état + alertes ; droite : usage + à arbitrer + raccourcis).

### 8.7 Performance attendue

- **TTFB** < 200 ms (route SSR).
- **LCP** < 1 s sur mobile bas de gamme (mesure cible).
- **Pas d'appel client supplémentaire** au chargement initial — tout en SSR.
- **Re-fetch en arrière-plan** au focus si > 60 s.

---

## 9. Périmètre MVP V1

### 9.1 Inclus dans V1

**Routing** :
- ✅ Route `/today` (page server component).
- ✅ Redirection `/` → `/today` (modifier le redirect actuel `/` → `/procedures`).
- ✅ Détection rôle côté serveur (USER, EDITOR, ADMIN).

**USER** :
- ✅ Salutation contextuelle (prénom + emoji + date + équipe).
- ✅ Carte "En cours" (session ou visite, max 1).
- ✅ Section "À traiter" (max 5 cartes, agrégation 3 sources).
- ✅ Raccourcis (Nouvelle veille, Astreinte, Nouvelle visite).
- ✅ "Dernières activités" (3 lignes).

**EDITOR** :
- ✅ Titre tournée + périmètre.
- ✅ Bannière diagnostic (3 états).
- ✅ "Cette semaine" (3 progress bars).
- ✅ "Agents à veiller" (max 5).
- ✅ "Sites sans visite" (max 5).
- ✅ Raccourcis (Importer, Stats, Échéances).

**ADMIN** :
- ✅ État global.
- ✅ Alertes système (3-5 lignes).
- ✅ Usage 7j (5 KPI).
- ✅ À arbitrer (2-3 lignes).
- ✅ Actions rapides (3 boutons).
- ✅ Variante "ADMIN + EDITOR" (afficher les 2 blocs si ADMIN a aussi un scope EDITOR).

**Algorithme** :
- ✅ Agrégateur ad-hoc en lecture (pas de table Echeance).
- ✅ Tri urgence/priorité/échéance.
- ✅ Cache 30 s côté client.

**Performance** :
- ✅ SSR de tout le payload (≤ 1 requête utilisateur).
- ✅ Pull-to-refresh.

### 9.2 Exclu de V1 (hors périmètre)

**Hub Échéances** :
- ❌ Page `/echeances` dédiée (Sprint 4).
- ❌ Modèle `Echeance` stocké (jamais — c'est une vue dérivée).
- ❌ Habilitations agent (`AgentHabilitation`) — Sprint 4+.
- ❌ Exercices périodiques (`RegulatoryExercise`) — Sprint 4+.
- ❌ Documents à renouveler — V3.

**Notifications** :
- ❌ Push web (PWA) — Sprint 5.
- ❌ Email digest hebdomadaire — Sprint 4.
- ❌ Email d'alerte échéance — Sprint 4.
- ❌ Centre de notifications in-app.

**Équipements (étendu)** :
- ❌ Contrôle ponctuel `EquipmentControl` — Sprint 4.
- ❌ `nextCheckDate`, `expectedCheckFrequencyDays` — Sprint 4.
- ❌ QR Code scan — Sprint 5.

**UX avancée** :
- ❌ Swipe-to-archive — Sprint 3 (E2-F1 US-2.3).
- ❌ FAB flottant — Sprint 2-3 (E2-F1 US-2.4).
- ❌ BottomSheet pour "Voir tous" — Sprint 2-3.
- ❌ Drill-down profonds des KPI ADMIN — Sprint 3-4.
- ❌ Reconnaissance vocale (Web Speech API) — **abandonnée définitivement** (décision PO 2026-06-14).
- ❌ Statuts pleine largeur — Sprint 2 (E2-F2 US-2.5) — autre US.

**Pages liées** :
- ❌ Page profil `/me` (US-3.7) — Sprint 3.
- ❌ Page pilotage `/pilotage` — Sprint 4.
- ❌ Vue NC consolidée `/pilotage/nc` — Sprint 4.
- ❌ Page d'audit `/admin/audit` consultable — Sprint 3.

**Métier** :
- ❌ Démarrage unifié `/start` (US-3.12) — Sprint 3.
- ❌ Refonte démarrage veille agent-first (US-3.13) — Sprint 3.
- ❌ Contact d'astreinte structuré (`Contact.isOnCall`) — V1 utilise convention par tag.
- ❌ Manager d'équipe assignable (US-8.4) — Sprint 3. V1 détecte EDITOR via `user.role`.
- ❌ Vue cross-équipe togglable (US-3.9) — Sprint 3. V1 respecte `User.viewAllTeams` figé.

### 9.3 Décisions de simplification V1

| Concept VISION | Choix V1 | Justification |
|---|---|---|
| 3 raccourcis dont QR scan | Remplacer QR par "Nouvelle visite" | QR = Sprint 5 (E10) |
| Bannière manager rouge/jaune/vert | Implémenter (sans Hub Échéances) | Calcul direct sur entités existantes |
| Progress bars "Cette semaine" | Implémenter avec heuristique d'objectif | Faute de meilleur, mais signaler au PO |
| Contact astreinte | Convention `Contact.tags = ["astreinte"]` | Pas de nouveau champ V1 |
| Algorithme de priorisation Hub Échéances | Agrégateur léger en lecture | Pas de stockage, OK pour V1 |
| `nextCheckDate` équipement | Utiliser `expirationDate` seul | Suffisant pour V1 (péremptions) |
| Notifications push | Aucun. Refresh manuel ou focus. | Sprint 5 |

---

## 10. Roadmap V1 / V2 / V3

### 10.1 Aujourd'hui V1 — Sprint 2 (livrable fin Sprint 2)

**Objectif** : remplacer `/` → `/procedures` par `/` → `/today` avec écran 3 rôles fonctionnel sans Hub Échéances.

**Inclus** :
- Tout le §9.1.
- Variante USER, EDITOR, ADMIN.
- Algorithme de priorisation V1 (en lecture, sans table).
- Sources : actions, sessions, visites, agents, sites, équipements (expirationDate).

**Exclu** :
- Tout le §9.2.

**Capacité dédiée** : ~74 h sur les ~75 h du Sprint 2.

### 10.2 Aujourd'hui V2 — Sprint 4 (avec Hub Échéances + Dashboard Manager)

**Objectif** : Today devient le point d'entrée du Hub Échéances. Le dashboard manager profond `/pilotage` est livré.

**Évolutions par rapport à V1** :
- USER section "À traiter" alimentée par `GET /api/echeances?scope=mine&priority=P0,P1&limit=5` (US-5.6).
- Nouvelles sources d'échéances : habilitations (US-5.7), exercices (US-5.8), documents (US-5.9).
- Section "À traiter" enrichie : équipements à contrôler (modèle Équipement étendu DESIGN-EQUIPEMENT §6).
- Bouton "Voir tous" → page `/echeances` dédiée.
- EDITOR : intégration de `/pilotage` accessible depuis bannière diagnostic.
- ADMIN : "Demandes d'annulation > 5 min" devient cliquable (workflow d'arbitrage).
- Drill-down des KPI.

**Capacité estimée évolution Today** : ~20 h (intégration agrégateur + nouvelles cartes).

### 10.3 Aujourd'hui V3 — Sprint 5+ (notifications push + QR)

**Objectif** : Today devient proactif (push web) et terrain (QR scan).

**Évolutions par rapport à V2** :
- USER : raccourci "Scanner QR" (US-10.3) remplace ou complète "Nouvelle visite".
- USER : badge urgence sur l'icône Today de la bottom-nav (compteur P0/P1 du jour).
- EDITOR : alerte push si bannière passe rouge avant 7h le matin.
- ADMIN : intégration `/admin/audit` consultable avec drill-down direct.
- Comparaison période n vs n-1 dans KPI ADMIN.

**Capacité estimée** : ~15-20 h (les briques push/QR sont livrées par leurs Epics dédiés).

### 10.4 Différences synthétiques

| Capacité | V1 (Sprint 2) | V2 (Sprint 4) | V3 (Sprint 5+) |
|---|---|---|---|
| Route `/today` | ✅ | ✅ | ✅ |
| 3 variantes rôle | ✅ | ✅ | ✅ |
| Salutation contextuelle | ✅ | ✅ | ✅ |
| Carte "En cours" | ✅ | ✅ | ✅ |
| "À traiter" — sources de base | ✅ | ✅ | ✅ |
| "À traiter" — habilitations | ❌ | ✅ | ✅ |
| "À traiter" — exercices | ❌ | ✅ | ✅ |
| "À traiter" — contrôles équipement | ❌ | ✅ | ✅ |
| Lien "Voir tous" → `/echeances` | ❌ (redirect entité) | ✅ | ✅ |
| Bannière diagnostic EDITOR | ✅ | ✅ | ✅ |
| Progress bars EDITOR | ✅ (heuristique) | ✅ (objectifs configurables) | ✅ |
| Agents à veiller / Sites sans visite | ✅ | ✅ | ✅ |
| Drill-down KPI | ❌ (lien simple) | ✅ | ✅ |
| Push notification ADMIN | ❌ | ❌ | ✅ |
| Push notification USER | ❌ | ❌ | ✅ |
| Badge urgence sur bottom-nav | ❌ | ✅ (V2.5) | ✅ |
| QR scan raccourci | ❌ | ❌ | ✅ |
| Reconnaissance vocale | abandonnée définitivement (PO 2026-06-14) |
| Drill-down "Logs audit" cliquable | ❌ (redirect) | ✅ | ✅ |
| Email récap hebdo | ❌ | ✅ | ✅ |

---

## 11. Parcours utilisateur cibles

### 11.1 Parcours USER terrain — matinée type V1

```
Heure  | Geste                          | Écran          | Clics
─────  | ─────────────────────────────  | ────────────── | ─────
08:30  | Ouverture de l'app             | Today USER     | 0
08:30  | Voit "En cours: SP-04" hier    | Today          | 0
08:31  | Clique "Reprendre"             | Session SP-04  | 1
08:35  | Finit la veille (8 items)      | Session SP-04  | 8
08:40  | Clôture session                | Session SP-04  | 2
08:40  | PDF généré, retour Today       | Today          | 0
08:41  | Voit "À traiter — Action X"    | Today          | 0
08:42  | Clique "Valider"               | ValidateModal  | 1
08:42  | Confirme la validation         | Today (toast)  | 1
08:43  | Voit le raccourci "Astreinte"  | Today          | 0
08:44  | Appui sur "Astreinte" — appel  | Tél natif      | 1
```

**14 clics pour reprendre + clôturer + valider + appeler astreinte.** Comparable au parcours VISION-V2 §5.1 avec 12 clics, mais sans QR scan (Sprint 5).

### 11.2 Parcours EDITOR — préparation tournée V1

```
Heure  | Geste                          | Écran          | Clics
─────  | ─────────────────────────────  | ────────────── | ─────
07:50  | Ouverture                      | Today EDITOR   | 0
07:50  | Voit bannière 🚨 ATTENTION      | Today          | 0
07:50  | Lit : 3 actions retard, 2 visites| Today        | 0
07:51  | Clique "Voir le détail"        | Actions retard | 1
07:52  | Note mentalement les 3 actions | -              | 0
07:53  | Retour Today                   | Today          | 1
07:53  | Scroll vers "Agents à veiller" | Today          | 0
07:54  | Note Bardella en haut (38j)    | -              | 0
07:54  | Clique "Veiller" sur Bardella  | /sessions/new  | 1
07:55  | Crée la session brouillon      | Session        | 4
07:56  | Sauvegarde, ferme              | Today          | 1
```

**8 clics, ~6 minutes.** Le manager a sa journée préparée.

### 11.3 Parcours ADMIN — vérification matinale V1

```
Heure  | Geste                          | Écran          | Clics
─────  | ─────────────────────────────  | ────────────── | ─────
09:00  | Ouverture                      | Today ADMIN    | 0
09:00  | Voit "État global ✅ OK"        | Today          | 0
09:00  | Voit "0 erreur 5xx 24h"        | Today          | 0
09:01  | Voit "12 sessions orphelines"  | Today          | 0
09:01  | Décide d'ignorer (non urgent)  | -              | 0
09:01  | Voit "Usage 7j : 2847 conn."   | Today          | 0
09:02  | Voit "À arbitrer : 2 sans éq." | Today          | 0
09:02  | Clique "2 utilisateurs..."     | /admin/users   | 1
09:03  | Assigne les 2 users à équipe  | UserModal      | 6
09:04  | Retour Today                   | Today          | 1
```

**8 clics, 4 minutes.** L'admin sait que son système est sain.

### 11.4 Parcours combiné — utilisateur multi-rôles V1

Cas Marie, EDITOR avec rôle ADMIN, fait sa tournée + un coup d'œil système :

```
Heure  | Geste                          | Écran          | Clics
─────  | ─────────────────────────────  | ────────────── | ─────
07:48  | Ouverture                      | Today EDITOR   | 0
07:48  | Voit sa tournée d'éditeur       | Today          | 0
07:51  | Scroll vers le bas              | Today          | 0
07:51  | Voit "Pilotage système" replié | Today          | 0
07:52  | Déplie                         | Today          | 1
07:52  | Vérifie "État global ✅ OK"    | Today          | 0
07:53  | Replie                          | Today          | 1
```

**2 clics pour le pilotage système.** Aucune navigation. La proposition V1 d'un volet replié est pertinente.

---

## 12. Backlog de réalisation Sprint 2

### 12.1 User Stories US-2.1.* (détail par US)

Découpage cohérent avec la convention `BACKLOG-V2.md` (Epic E3 — Refonte Accueil).

#### US-2.1.0 — Route `/today` + redirection `/` → `/today`

- En tant que **USER**, je souhaite **arriver sur un écran personnalisé** au lieu du catalogue de procédures.
- Critères :
  - Page Next.js `src/app/(app)/today/page.tsx` (server component).
  - Redirection `src/app/(app)/page.tsx` ou middleware adapté pour rediriger `/` vers `/today`.
  - Détection rôle SSR pour rendre la bonne variante.
  - Authentification déjà gérée par layout existant.
- Complexité : **S** — 4 h.
- Dépendances : aucune.
- Réf : UX-01, US-3.1 du BACKLOG.

#### US-2.1.1 — Agrégateur Today (route API)

- En tant que **dev**, je souhaite **un endpoint serveur** qui retourne le payload de Today.
- Critères :
  - Route `GET /api/today` (ou data loader côté server component).
  - Retourne JSON typé selon le rôle :
    - USER : `{ greeting, current, todoList, recent }`.
    - EDITOR : `{ tour, banner, weekProgress, agentsToReview, sitesNoVisit, shortcuts }`.
    - ADMIN : `{ status, alerts, usage7d, arbitration }`.
  - Cache HTTP `Cache-Control: private, max-age=30`.
  - Pas plus de 5 requêtes Prisma au total. Optimiser avec `Promise.all`.
  - Test perf : payload < 300 ms en local sur base de dev.
- Complexité : **M** — 8 h.
- Dépendances : aucune.

#### US-2.1.2 — Composant `<TodayHeader>` (salutation + titre)

- En tant que **USER**, je souhaite **une salutation contextuelle** "Bonjour Jessy ☀️/🌙" selon l'heure.
- Critères :
  - Affichage prénom (`User.displayName` ou parsing first name).
  - Emoji selon heure locale (☀️ 7-17h, 🌙 17-7h).
  - Date FR via `Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long" })`.
  - Équipe principale (label ou "Toutes mes équipes").
  - Variante EDITOR : "MA TOURNÉE — date" + résumé périmètre.
  - Variante ADMIN : "PILOTAGE SYSTÈME — date".
- Complexité : **S** — 3 h.
- Dépendances : aucune.
- Réf : US-3.6 du BACKLOG.

#### US-2.1.3 — Carte "En cours" (USER)

- En tant que **USER**, je souhaite **voir ma veille ou visite en cours** pour la reprendre instantanément.
- Critères :
  - Requête : top 1 entre `VeilleSession` et `SiteVisit` filtré sur `userId = me AND status IN (draft, active)`, tri `updatedAt DESC`.
  - Affichage : icône type + nom + contexte (agent / site) + progression (X/Y points).
  - Bouton "Reprendre →" lien vers la page concernée.
  - Si > 7j : préfixe ⚠️ "Brouillon ancien".
  - Si rien : section masquée.
- Complexité : **S** — 4 h.
- Dépendances : US-2.1.1.
- Réf : US-3.2 du BACKLOG.

#### US-2.1.4 — Section "À traiter aujourd'hui" (USER)

- En tant que **USER**, je souhaite **voir 3-5 items à traiter aujourd'hui** triés par urgence.
- Critères :
  - Agrégation 3 sources (actions, brouillons, péremptions).
  - Tri selon algorithme §7.
  - Limit 5. Si > 5 : "Voir toutes (N) →".
  - Carte : icône couleur + titre + sous-titre + CTA contextuel.
  - Si 0 item : message "Aucune urgence aujourd'hui 🎉".
  - Carte cliquable navigue vers le détail.
- Complexité : **M** — 8 h.
- Dépendances : US-2.1.1, algorithme §7.4 V1.
- Réf : US-3.3 du BACKLOG.

#### US-2.1.5 — Raccourcis natifs USER

- En tant que **USER**, je souhaite **3 raccourcis** : Nouvelle veille, Astreinte, Nouvelle visite.
- Critères :
  - Grille 3 colonnes, boutons ≥ 96 px de haut.
  - "Nouvelle veille" → `/sessions/new` (ou `/procedures` si US-3.13 pas livré).
  - "Astreinte" :
    - Requête `Contact WHERE tags CONTAINS "astreinte" AND scope team LIMIT 1`.
    - Si 1 contact : lien `tel:` direct.
    - Si plusieurs : ouverture liste filtrée.
    - Si aucun : bouton désactivé + tooltip "Configurer dans Admin → Contacts".
  - "Nouvelle visite" → `/visits/new`.
- Complexité : **M** — 6 h.
- Dépendances : convention tag astreinte.
- Réf : US-3.4 du BACKLOG.

#### US-2.1.6 — Section "Dernières activités" (USER)

- En tant que **USER**, je souhaite **voir mes 3 dernières activités** pour le sentiment de continuité.
- Critères :
  - Source : union de `VeilleSession`, `SiteVisit`, `AgentSighting`, `ActionValidation` filtrés `userId = me`.
  - Tri DESC sur date, limit 3.
  - Format texte : "Hier 17:22 · Vu Martin L. (POS-VALENCE)".
  - Non cliquable. Information uniquement.
- Complexité : **S** — 3 h.
- Dépendances : US-2.1.1.
- Réf : US-3.5 du BACKLOG.

#### US-2.1.7 — Variante EDITOR — Bannière diagnostic

- En tant que **EDITOR**, je souhaite **une bannière de diagnostic** pour savoir si mon périmètre est sous contrôle.
- Critères :
  - Calcul 3 états (vert/jaune/rouge).
  - Texte explicite avec compteurs.
  - CTA "Voir le détail" → page filtrée.
- Complexité : **M** — 6 h.
- Dépendances : US-2.1.1.
- Réf : Vision §6.3.

#### US-2.1.8 — Variante EDITOR — "Cette semaine" progress bars

- En tant que **EDITOR**, je souhaite **3 progress bars** Visites / Veilles / Actions.
- Critères :
  - Calcul réel cette semaine vs objectif heuristique V1.
  - Barre + ratio + pourcentage.
  - Documentation explicite sur la définition des objectifs (à valider PO).
- Complexité : **M** — 6 h.
- Dépendances : US-2.1.1.

#### US-2.1.9 — Variante EDITOR — "Agents à veiller" + "Sites sans visite"

- En tant que **EDITOR**, je souhaite **voir les 5 agents et 5 sites les plus en retard** sur mon périmètre.
- Critères :
  - Tri freshness DESC.
  - Lien "Voir tous (N) →" si plus.
  - CTA "Veiller →" / "Visiter →" par item.
- Complexité : **M** — 8 h (les 2 sections).
- Dépendances : US-2.1.1, fraîcheur agent existante.
- Réf : US-6.2, US-6.3 du BACKLOG.

#### US-2.1.10 — Variante EDITOR — Raccourcis

- En tant que **EDITOR**, je souhaite **3 raccourcis** : Importer, Stats, Échéances.
- Critères :
  - Liens directs (`/admin/imports/actions`, `/stats`, redirection V1 vers liste).
- Complexité : **S** — 2 h.
- Dépendances : aucune.

#### US-2.1.11 — Variante ADMIN — État global + Alertes

- En tant que **ADMIN**, je souhaite **savoir si mon système est OK** avec liste d'alertes.
- Critères :
  - État OK / Dégradé / Incident calculé selon backup, erreurs, sessions orphelines.
  - Liste de 3-5 alertes triées par criticité.
  - Source backup : `mtime` `data/backups/latest.db`.
  - Source erreurs 5xx : compteur côté logger structuré Sprint 1 (ou Sentry).
- Complexité : **M** — 6 h.
- Dépendances : US-2.1.1, observabilité Sprint 1.

#### US-2.1.12 — Variante ADMIN — Usage 7j + À arbitrer + Actions

- En tant que **ADMIN**, je souhaite **voir l'usage de la semaine** et les éléments à arbitrer.
- Critères :
  - 5 compteurs SQL (connexions, veilles, visites, validations, photos).
  - Section "À arbitrer" : count users sans équipe.
  - 3 boutons d'action rapide.
- Complexité : **S** — 4 h.
- Dépendances : US-2.1.1.

#### US-2.1.13 — Variante ADMIN+EDITOR (admin avec équipe)

- En tant que **ADMIN avec scope équipe**, je souhaite **voir d'abord ma tournée**, **puis le système** (replié).
- Critères :
  - Bloc EDITOR en haut si `user.teamIds.length > 0`.
  - Bloc système replié par défaut, toggle.
  - Si pas de team : ADMIN pur, affichage direct du bloc système.
- Complexité : **S** — 3 h.
- Dépendances : US-2.1.7 à US-2.1.12.

#### US-2.1.14 — Algorithme de priorisation V1 (service)

- En tant que **dev**, je souhaite **un service de priorisation** unifié pour USER et EDITOR.
- Critères :
  - Fonction `scoreItem(item, user) → number` selon §7.2.
  - Fonction `aggregateTodayItems(user) → SortedItem[]`.
  - Tests unitaires Vitest (8 cas représentatifs).
- Complexité : **M** — 8 h.
- Dépendances : aucune.

#### US-2.1.15 — Pull-to-refresh + cache 30 s

- En tant que **USER**, je souhaite **rafraîchir Today** par pull-to-refresh.
- Critères :
  - Hook React qui intercepte le geste pull-down.
  - Re-fetch `/api/today` si > 60 s depuis dernier fetch.
  - Toast "Mis à jour" en succès.
  - Hook `useFocusEffect` ou `onVisibilityChange` pour refresh automatique.
- Complexité : **S** — 4 h.
- Dépendances : US-2.1.1.

#### US-2.1.16 — Tests + intégration

- En tant que **dev**, je souhaite **tester Today** avant la mise en production.
- Critères :
  - 3 scénarios manuels (USER, EDITOR, ADMIN) sur seed de test.
  - 1 test Playwright minimal (login + rendu Today).
  - Tests unitaires algorithme priorisation (Vitest).
  - Vérifier les performances (Lighthouse mobile, LCP < 1s).
- Complexité : **M** — 6 h.
- Dépendances : toutes les US précédentes.

### 12.2 Synthèse Sprint 2 — Backlog US-2.1

| # | US | Effort | Cumulé |
|---|---|---|---|
| 1 | US-2.1.0 Route + redirection | 4 h | 4 h |
| 2 | US-2.1.1 Agrégateur API | 8 h | 12 h |
| 3 | US-2.1.2 Composant header | 3 h | 15 h |
| 4 | US-2.1.3 Carte "En cours" | 4 h | 19 h |
| 5 | US-2.1.4 Section "À traiter" | 8 h | 27 h |
| 6 | US-2.1.5 Raccourcis USER | 6 h | 33 h |
| 7 | US-2.1.6 Dernières activités | 3 h | 36 h |
| 8 | US-2.1.14 Algorithme priorisation | 8 h | 44 h |
| 9 | US-2.1.7 Bannière EDITOR | 6 h | 50 h |
| 10 | US-2.1.8 Progress bars EDITOR | 6 h | 56 h |
| 11 | US-2.1.9 Agents/Sites EDITOR | 8 h | 64 h |
| 12 | US-2.1.10 Raccourcis EDITOR | 2 h | 66 h |
| 13 | US-2.1.11 État/Alertes ADMIN | 6 h | 72 h |
| 14 | US-2.1.12 Usage/À arbitrer/Actions ADMIN | 4 h | 76 h |
| 15 | US-2.1.13 Variante ADMIN+EDITOR | 3 h | 79 h |
| 16 | US-2.1.15 Pull-to-refresh + cache | 4 h | 83 h |
| 17 | US-2.1.16 Tests + intégration | 6 h | 89 h |

**Total brut** : 89 h.

**Marge à intégrer** :
- Solo + IA → décote ~15 % sur le code répétitif (composants Tailwind, requêtes Prisma simples).
- **Effort réel estimé : ~75 h.**

**Tient dans Sprint 2 (capacité 75 h)** si on accepte que **toute la capacité Sprint 2 est consacrée à US-2.1**. Les autres US prévues (US-2.1.0 du BACKLOG initial = `<BottomSheet>`, US-2.5 statuts pleine largeur, US-2.6 vocabulaire) doivent être décalées.

### 12.3 Ordre d'exécution recommandé

```
Semaine 1 — Fondations + USER complet (35 h)
  Commit 1 ─ Route /today + redirect (4 h)
  Commit 2 ─ Agrégateur API (8 h)
  Commit 3 ─ Algorithme priorisation V1 (8 h)
  Commit 4 ─ Header (3 h)
  Commit 5 ─ Carte "En cours" (4 h)
  Commit 6 ─ Section "À traiter" (8 h)

Semaine 2 — USER finalisé + EDITOR cœur (24 h)
  Commit 7 ─ Raccourcis USER (6 h)
  Commit 8 ─ Dernières activités (3 h)
  Commit 9 ─ Pull-to-refresh + cache (4 h)
  Commit 10 ─ Bannière EDITOR (6 h)
  Commit 11 ─ Progress bars EDITOR (6 h)
  → Test/Démo USER complet en fin de semaine 2

Semaine 3 — EDITOR finalisé (10 h)
  Commit 12 ─ Agents/Sites EDITOR (8 h)
  Commit 13 ─ Raccourcis EDITOR (2 h)
  → Test/Démo EDITOR complet en fin de semaine 3

Semaine 4 — ADMIN + intégration (19 h)
  Commit 14 ─ État/Alertes ADMIN (6 h)
  Commit 15 ─ Usage/Actions ADMIN (4 h)
  Commit 16 ─ Variante ADMIN+EDITOR (3 h)
  Commit 17 ─ Tests + intégration (6 h)
  → Démo finale Sprint 2
```

### 12.4 Découpage incrémental par commits

Chaque commit est livrable de façon indépendante. Les commits 1-3 livrent **une page fonctionnelle vide** ; les commits 4-9 livrent **un USER complet** ; les commits 10-13 livrent l'EDITOR ; les 14-16 livrent l'ADMIN.

**Possibilité de livraison anticipée** : à la fin de la semaine 2, le USER est complet et peut être en pré-prod pour feedback. EDITOR et ADMIN suivent.

---

## 13. Estimation de complexité

### 13.1 Synthèse par dimension

| Dimension | Note | Justification |
|---|---|---|
| **Impact utilisateur** | 10/10 | Premier écran après login, vu par 100 % des utilisateurs, plusieurs fois par jour |
| **Impact métier** | 10/10 | Pivot stratégique de l'app, base de l'adoption manager + agent |
| **Complexité technique** | 6/10 | Pas de nouvelle dépendance, mais requêtes Prisma multiples + algorithme à concevoir |
| **Complexité produit** | 7/10 | 3 variantes par rôle, arbitrages V1 à acter avec PO |
| **Risque régression** | 4/10 | Modification redirect racine — si bug, impact 100 % users (back-up plan : feature flag) |
| **Coût Sprint 2** | ~75 h | Toute la capacité Sprint 2 |
| **ROI** | 8/10 | Le plus gros levier d'adoption du Sprint 2 |

### 13.2 Complexité par US

| US | Tailles | Risque | Note |
|---|---|---|---|
| US-2.1.0 Route + redirect | S | Bas | Modification simple du redirect `/` |
| US-2.1.1 Agrégateur API | M | Moyen | 5+ requêtes Prisma à orchestrer, perfs à valider |
| US-2.1.2 Header | S | Bas | UI pure |
| US-2.1.3 Carte "En cours" | S | Bas | Requête simple |
| US-2.1.4 "À traiter" | M | Moyen | Logique d'agrégation 3 sources |
| US-2.1.5 Raccourcis | M | Moyen | Logique astreinte avec convention tag (à valider) |
| US-2.1.6 Activités | S | Bas | Union de 4 sources |
| US-2.1.7 Bannière EDITOR | M | Moyen | Calculs de retard sur 3 axes |
| US-2.1.8 Progress bars | M | Élevé | Heuristiques d'objectif à valider PO |
| US-2.1.9 Agents/Sites EDITOR | M | Bas | Tris simples, attention aux perfs sur 500+ agents |
| US-2.1.10 Raccourcis EDITOR | S | Bas | Liens |
| US-2.1.11 État/Alertes ADMIN | M | Moyen | Lecture filesystem (backup) + Sentry counter |
| US-2.1.12 Usage/À arbitrer | S | Bas | Compteurs SQL |
| US-2.1.13 Variante mixte | S | Bas | Toggle UI |
| US-2.1.14 Algorithme | M | Élevé | Conception cœur, tests requis |
| US-2.1.15 Pull-to-refresh | S | Bas | Hook custom React |
| US-2.1.16 Tests | M | Bas | Couverture |

### 13.3 Risques identifiés

| # | Risque | Probabilité | Impact | Mitigation |
|---|---|---|---|---|
| R1 | Perf agrégateur > 500 ms sur base prod réelle | Moyenne | Élevé | Mesurer en pré-prod ; optimiser avec `Promise.all` ; cache 30 s ; au pire, déférer le calcul "Cette semaine" en client-side |
| R2 | Définition des objectifs "Cette semaine" arbitraire | Élevée | Moyen | V1 affiche **uniquement le compteur** sans pourcentage si PO ne valide pas. Désactivation cosmétique. |
| R3 | Astreinte sans contact tagué → bouton désactivé en permanence | Moyenne | Faible | Documentation : ajouter `astreinte` dans Admin → Contacts. Au pire, le bouton ouvre `/contacts`. |
| R4 | Régression à la redirection `/` | Faible | Très élevé | Test E2E avant déploiement ; feature flag `ENABLE_TODAY=true` pour rollback rapide |
| R5 | Variante ADMIN+EDITOR confuse | Moyenne | Moyen | Test utilisateur en pré-prod ; choix par défaut : voir EDITOR d'abord (plus utile au quotidien) |
| R6 | Algorithme priorisation pas optimal | Moyenne | Moyen | Loguer les scores pour analyser sur seed réel ; ajuster les poids en hotfix si nécessaire |
| R7 | Sentry/logger ne renvoie pas le compteur 5xx | Moyenne | Faible | Fallback : afficher "État : OK" + vérifier `mtime` du log d'erreurs |
| R8 | Pull-to-refresh + cache 30s conflit avec onfocus refresh | Faible | Faible | Tests d'intégration ciblés |

### 13.4 Hypothèses à valider avec le PO

1. **Définition de "À traiter aujourd'hui"** : ai-je raison d'inclure (a) actions retard, (b) brouillons anciens, (c) péremptions ? Le PO confirme ou retire un type.
2. **Définition des objectifs hebdo EDITOR** : 1 visite/site/trimestre ? 1 veille/agent/mois ? Sinon : afficher uniquement le compteur sans ratio.
3. **Astreinte** : convention `Contact.tags = ["astreinte"]` acceptable V1, ou besoin d'un champ structuré ? Si besoin de champ → reporter le bouton "Astreinte" V2.
4. **Variante ADMIN+EDITOR** : ADMIN voit-il d'abord sa tournée d'éditeur (ma proposition) ou directement le pilotage système ? Décision UX.
5. **`viewAllTeams`** : V1 affiche selon la valeur figée actuelle. Si PO veut un toggle à la volée, c'est une US séparée Sprint 3.
6. **Périmètre EDITOR** : V1 = tous EDITOR (sans assignation MANAGER spécifique). OK ?
7. **Lien "Voir tous"** : V1 redirige vers la page entité (`/actions?...`). V2 vers `/echeances`. OK ?
8. **Carte "En cours" — limite à 1** : ou afficher session + visite si les 2 sont en cours ? Décision UX.

### 13.5 Bénéfice attendu (en posture PO)

- **Adoption utilisateur** : taux d'utilisation hebdomadaire estimé +30 % (basé sur retours similaires d'apps avec écran "Aujourd'hui").
- **Manager** : temps de préparation tournée 8 → 3 minutes (cf. parcours §11.2 vs état actuel).
- **Réduction des bugs perçus** : suppression du dead-end "catalogue d'abord" qui décourageait nouveaux users.
- **Préparation Sprint 4** : l'agrégateur posé en V1 est facile à brancher au Hub Échéances (juste changer la source).

### 13.6 Estimation finale

**Sprint 2 = US-2.1 monopolise la quasi-totalité de la capacité.**

| Métrique | Valeur |
|---|---|
| Effort brut estimé | 89 h |
| Effort net solo+IA | ~75 h |
| Capacité Sprint 2 | 75 h |
| Marge | ~0 h |
| Recommandation | Sprinter dur sur US-2.1 seule. Pousser BottomSheet (E2-F1 US-2.1) + Statuts pleine largeur (US-2.5) en Sprint 2.5 ou intégrer si avance |

**Si nécessité de réduction de scope** :
- Option A — Reporter ADMIN V1 en Sprint 3 (économie : ~16 h).
- Option B — Reporter EDITOR V1 en Sprint 3 (économie : ~22 h, mais perd l'impact manager).
- Option C — Garder USER + EDITOR allégé (sans progress bars) + ADMIN minimal (état global uniquement) — économie ~12 h.

**Recommandation** : option C, puis renforcer en Sprint 3.

---

## 14. Risques et arbitrages

### 14.1 Risques produit

| # | Risque | Mitigation |
|---|---|---|
| P1 | Bannière EDITOR sans le Hub Échéances apparaît "fausse" si comptages divergent du PO | Tests sur seed réel avant déploiement. Communication transparente : "V1 est une lecture directe, V2 sera l'agrégateur unifié." |
| P2 | "Aujourd'hui" devient un dashboard contemplatif (ce qu'on voulait éviter) | Discipline UX : pas de graphe, pas de courbe, pas de stats. Verbe action sur chaque carte. Revue UX en fin de Sprint 2. |
| P3 | Trois maquettes très différentes par rôle créent de la confusion lexicale | Aligner le vocabulaire (US-2.6 du BACKLOG). Mais elle n'est pas dans Sprint 2 V1. À planifier Sprint 3. |
| P4 | Trop de cartes "À traiter" font peur à l'utilisateur | Limit 5 strict. Message positif si 0 item. Code couleur cohérent. |
| P5 | L'algorithme de priorisation V1 paraît arbitraire | Documenter les poids dans le code + dans la doc utilisateur. Permettre ajustement par PO en hotfix. |

### 14.2 Risques techniques

| # | Risque | Mitigation |
|---|---|---|
| T1 | Performance dégradée sur SQLite en concurrence | Mesurer le temps d'agrégateur en local sur base de seed. Cache 30 s + SSR. Si > 500 ms : différer le calcul "Cette semaine" en client-side. |
| T2 | Composants UI non encore unifiés (E2 pas livré) | Réutiliser les patterns existants `Tailwind + cards`. Refactor visuel en Sprint 3 quand E2 livré. |
| T3 | Multiple variantes par rôle = code dupliqué | Structurer en composants atomiques `<TodayCard>`, `<TodaySection>`, `<KpiRow>`. Réutiliser entre rôles. |
| T4 | Modification redirect `/` casse les bookmarks utilisateur | Garder `/procedures` accessible par lien direct. Top-bar avec bouton "Catalogue" si besoin. |
| T5 | Erreur Prisma dans l'agrégateur fait planter la page | Catch tout et afficher état dégradé "Service indisponible, réessayer" — pas de page blanche. |

### 14.3 Arbitrages V1 assumés

| Arbitrage | Choix V1 | Risque assumé |
|---|---|---|
| Sans Hub Échéances | Agrégateur ad-hoc | Code à refactorer Sprint 4 (mais isolé dans 1 fichier) |
| Sans QR scan | Raccourci remplacé par "Nouvelle visite" | Promesse V1 partiellement tenue, V3 comble |
| Sans push notif | Pull-to-refresh + onfocus refresh | Risque de "data fraîcheur" perçue moindre |
| Sans manager d'équipe | Détection EDITOR par `user.role` | Tous les EDITOR voient la variante manager (acceptable car peu nombreux) |
| Sans page `/echeances` | "Voir tous" → page entité existante | UX moins fluide mais fonctionnelle |
| Sans `<BottomSheet>` | Modales tailwind classiques | Cohérence visuelle légèrement dégradée, OK |
| Algorithme V1 simple | Heuristiques documentées | Risque d'inadéquation, ajustable en hotfix |

### 14.4 Décisions à prendre avant démarrage Sprint 2

1. **Valider la grille V1** (sections par rôle) — réponse OUI/NON aux 8 hypothèses §13.4.
2. **Choisir option A/B/C** si réduction de scope nécessaire.
3. **Définir astreinte** : convention tag ou champ structuré ?
4. **Choisir le label** : "Aujourd'hui" / "Today" / "Ma journée" / "Tableau de bord" ? Recommandation V1 : "Aujourd'hui".
5. **Confirmer redirect** : `/` → `/today` accepté, `/procedures` reste accessible ?
6. **Feature flag** : déploiement progressif via flag `ENABLE_TODAY=true` ? Recommandé.

---

## 15. Conclusion

### 15.1 Résumé

**Aujourd'hui V1** est un MVP **ambitieux mais réalisable dans Sprint 2** :
- 3 variantes par rôle, alignées avec VISION-V2.
- Agrégateur léger sans nouveau modèle.
- Réutilise toutes les briques Sprint 1 (toaster, ConfirmDialog, observabilité).
- Pose les bases du Hub Échéances Sprint 4 (l'algorithme V1 sera étendu, pas refait).

### 15.2 Promesse tenue ?

> "En 2 secondes après ouverture, l'utilisateur sait s'il a quelque chose à faire."

Oui pour V1 :
- USER : Salutation + carte "En cours" lisible en 2 s.
- EDITOR : Bannière diagnostic lisible en 2 s.
- ADMIN : État global lisible en 2 s.

> "En 5 secondes, il sait quoi."

Oui pour V1 :
- USER : 1ère carte "À traiter" donne le QUOI.
- EDITOR : Listes "Agents/Sites" donnent le QUOI.
- ADMIN : Alertes système donnent le QUOI.

### 15.3 Prochaines étapes après ce document

1. **PO valide** ce document et répond aux 8 hypothèses §13.4 + 6 décisions §14.4.
2. **Détecter feature flag** dans `.env` : `ENABLE_TODAY` (rollback rapide).
3. **Préparation Sprint 2** : créer les 17 US dans le backlog.
4. **Démarrer** par US-2.1.0 et US-2.1.1 (fondations).
5. **Revue intermédiaire** en fin de semaine 2 (USER complet, démo).
6. **Préparation Sprint 4** : l'agrégateur V1 sera l'input du Hub Échéances.

### 15.4 Ce document est-il suffisant pour démarrer l'implémentation ?

✅ **Oui**, sous condition que le PO réponde aux 8 hypothèses §13.4 + 6 décisions §14.4. Aucun élément structurel ne dépend d'un autre document ; toutes les sources de données sont identifiées ; le découpage en US est fin et estimable.

⚠️ **Sauf** sur deux points qui nécessitent une décision PO avant implémentation :
- La sémantique d'astreinte (convention tag vs champ structuré).
- La définition des objectifs hebdo EDITOR (heuristique vs masquage du ratio).

---

## 16. Annexes

### 16.1 Glossaire V1

- **Aujourd'hui** : écran `/today` ouvert après login.
- **Variante** : version de l'écran pour un rôle donné (USER, EDITOR, ADMIN).
- **Agrégateur** : service serveur qui calcule le payload Today à partir de N sources Prisma.
- **Item** : élément composant la liste "À traiter" (action, brouillon, péremption).
- **Score** : valeur calculée par l'algorithme de priorisation pour trier les items.
- **Échéance** : terme produit (V2). En V1, on parle d'"item" car le hub Échéances n'existe pas encore.
- **Périmètre** : ensemble des équipes/sites/agents auxquels un utilisateur a accès.

### 16.2 Convention de tags V1

| Convention | Valeur attendue | Usage V1 |
|---|---|---|
| `Contact.tags` contient `"astreinte"` | Texte exact | Détecte contact d'astreinte pour raccourci tel: |
| `Contact.tags` contient `"24/7"` | Texte exact | Alternative ou complément |

À documenter dans la page `/admin/contacts` ("Tag `astreinte` pour activer le raccourci").

### 16.3 Conventions d'affichage des dates V1

| Cas | Format |
|---|---|
| Aujourd'hui | "Aujourd'hui HH:MM" |
| Hier | "Hier HH:MM" |
| Cette semaine | "Lundi 14 juin" |
| Plus loin | "14 juin" ou "14/06/2026" |
| Retard | "X jours de retard" |
| À venir | "dans X jours" |

### 16.4 Mapping rôle → variante

| User.role | Has Team | Variante affichée |
|---|---|---|
| USER | - | USER (§4) |
| EDITOR | - | EDITOR (§5) |
| ADMIN | Oui (teamIds > 0) | EDITOR + bloc "Pilotage système" replié (§6.4) |
| ADMIN | Non | ADMIN pur (§6.3) |

### 16.5 Vérification : ce document couvre-t-il le brief ?

| Demande du brief | Couvert | Localisation |
|---|---|---|
| Conception | ✅ | §1 à §3 |
| UX | ✅ | §4, §5, §6, §8 |
| Parcours | ✅ | §11 |
| Priorisation | ✅ | §7 |
| Maquettes textuelles | ✅ | §4.5, §5.6, §6.5 |
| USER | ✅ | §4 |
| EDITOR | ✅ | §5 |
| ADMIN | ✅ | §6 |
| Cartes (titre, priorité, contenu, action) | ✅ | §4.3, §5.4, §6.3 |
| Algorithme Urgent/Important/À surveiller/Information | ✅ | §7.1, §7.2 |
| Mobile-first | ✅ | §8 |
| Hauteurs et items visibles sans scroll | ✅ | §8.3, §8.5 |
| MVP V1 inclus / exclu | ✅ | §9.1, §9.2 |
| Roadmap V1/V2/V3 | ✅ | §10 |
| Maquette USER finale | ✅ | §4.5 |
| Maquette EDITOR finale | ✅ | §5.6 |
| Maquette ADMIN finale | ✅ | §6.5 |
| Backlog de réalisation | ✅ | §12 |
| Estimation complexité | ✅ | §13 |

---

**Fin du document TODAY-V1.md.**

Document prêt pour validation par le PO avant Sprint 2.
