# Backlog exécutable V2 — Veille

> **Périmètre** : plan d'exécution concret, priorisé et réaliste.
> **Date** : 2026-06-13.
> **Documents amont** (référence produit) : [AUDIT.md](AUDIT.md), [AUDIT-PRODUIT.md](AUDIT-PRODUIT.md), [VISION-V2.md](VISION-V2.md).
> **Posture** : PO + PM + Lead dev + Architecte.
> **Contrainte de capacité** : développeur solo avec assistance IA. Estimation = ~15-25 h/semaine de capacité réelle (pas en jours-homme mais en heures), soit ~70-100 h/mois.
> **Aucun code n'est produit ici** — seulement le plan.

---

## 0. Méthode et conventions

### 0.1 Système de notation utilisé

Chaque item est noté selon 5 dimensions :

| Dimension | Échelle | Signification |
|---|---|---|
| **Impact utilisateur** | 1-10 | Réduction de friction quotidienne perçue |
| **Impact métier** | 1-10 | Effet sur conformité / pilotage / sécurité / adoption |
| **Complexité** | 1-10 | Effort technique (10 = très complexe) |
| **Coût** | heures | Estimation solo + IA réaliste |
| **ROI** | 1-10 | `(Impact_user + Impact_metier) / Complexité × 5` normalisé |

**Coût** tient compte du contexte solo+IA :
- IA accélère sur le code répétitif (×1.5-2)
- IA n'accélère pas sur la décision produit, ni sur le test manuel
- Buffer 20 % intégré pour les imprévus de chaque story

### 0.2 Tailles de stories

- **S** (Small) : 1-4 h
- **M** (Medium) : 4-12 h
- **L** (Large) : 12-30 h
- **XL** (Extra-Large) : 30 h+ (à découper)

### 0.3 Priorités

- **P0** : à faire dans le sprint courant.
- **P1** : à faire prochainement (1-2 sprints).
- **P2** : utile, à intégrer quand opportunité.
- **P3** : nice-to-have, reportable.

### 0.4 Capacité estimée par sprint (solo + IA)

| Sprint | Durée | Capacité réaliste |
|---|---|---|
| Sprint 1 | 3 semaines | ~55 h |
| Sprint 2 | 4 semaines | ~75 h |
| Sprint 3 | 4 semaines | ~75 h |
| Sprint 4 | 5 semaines | ~90 h |
| Sprint 5 | 6 semaines | ~110 h |
| **Total** | **22 semaines** (~5 mois) | **~405 h** |

Le plan global tient sur 5-6 mois avec une marge ; en cas de difficulté ou d'intercurrent (production hotfix), il s'étire naturellement.

---

## 1. Arbitrages — Tri par catégorie

### 1.1 Fonctionnalités à DÉVELOPPER IMMÉDIATEMENT

Fort impact utilisateur + fort impact métier + faible/moyenne complexité + ROI élevé.

| Item | Impact U | Impact M | Compl. | Coût | ROI |
|---|---|---|---|---|---|
| **C5** Variables CSS fantômes | 9 | 7 | 1 | 1 h | **10/10** |
| **C6** Bouton "+ Nouvelle procédure" cassé | 7 | 8 | 1 | 2 h | **10/10** |
| **C2** Bug scope `teamId` multi-équipes | 8 | 10 | 2 | 4 h | **10/10** |
| **UX-19** Bouton "Voir le rapport" dans listes | 9 | 7 | 1 | 2 h | **10/10** |
| **UX-02** Menu mobile 6e bouton « ⋯ Plus » | 10 | 8 | 2 | 4 h | **10/10** |
| **UX-10** Toaster sonner + ConfirmDialog | 9 | 7 | 3 | 6 h | **9/10** |
| **UX-13** Filtres `<AgentAutocomplete>` /history /stats | 9 | 9 | 2 | 4 h | **10/10** |
| **M8** Photos en visites | 10 | 9 | 3 | 8 h | **9/10** |
| **C4** Migrations Prisma versionnées | 2 | 10 | 2 | 4 h | **9/10** |
| **MT-09** Sentry + logs structurés | 2 | 9 | 3 | 5 h | **8/10** |
| **C7** Tables admin overflow-x-auto + mode cards | 8 | 9 | 4 | 12 h | **8/10** |
| **C1** Photos privées (route streaming) | 3 | 10 | 5 | 12 h | **7/10** |
| **UX-17** Annulation validation 5 min | 9 | 8 | 3 | 6 h | **9/10** |
| **UX-07** Statuts pleine largeur (sessions + visites) | 9 | 8 | 2 | 6 h | **10/10** |
| **UX-18** Statuts session simplifiés à 3 + menu Autres | 9 | 6 | 2 | 4 h | **9/10** |
| **MT-10** Backup automatisé SQLite | 1 | 10 | 2 | 4 h | **8/10** |
| **M1** Validation MIME + taille upload photos | 2 | 8 | 2 | 4 h | **7/10** |
| **M3** Rate-limit login | 1 | 8 | 3 | 5 h | **6/10** |
| **M20** Reset password par lien email | 7 | 7 | 3 | 6 h | **8/10** |

**Total** : 19 items, ~99 h. Tiendra sur Sprints 1 + 2.

### 1.2 Fonctionnalités à REPORTER

Intéressantes, mais coûteuses, dépendantes ou à valeur différée. À traiter en Sprint 3-5.

| Item | Impact U | Impact M | Compl. | Coût | ROI | Pourquoi reporter |
|---|---|---|---|---|---|---|
| **UX-01** Écran Aujourd'hui USER | 10 | 10 | 7 | 30 h | 8/10 | Cœur Sprint 2 |
| **M-02** Page profil `/me` | 8 | 8 | 5 | 20 h | 8/10 | Cœur Sprint 2-3 |
| **M-01** Dashboard EDITOR « Ma tournée » | 8 | 10 | 7 | 30 h | 8/10 | Cœur Sprint 4 |
| **Hub Échéances** | 10 | 10 | 8 | 50 h | 7/10 | Pivot Sprint 4 |
| **V-07** Notifications push | 8 | 10 | 7 | 25 h | 7/10 | Dépend Hub Échéances |
| ~~V-02~~ Reconnaissance vocale | — | — | — | — | — | ⛔ **abandonnée définitivement (PO 2026-06-14)** |
| **M-03** Audit log consultable | 4 | 10 | 4 | 12 h | 8/10 | Sprint 3 |
| **M-05** Vue NC ouvertes consolidée | 8 | 10 | 5 | 18 h | 7/10 | Avec Dashboard manager Sprint 4 |
| **M-06** Visites en retard calculées | 8 | 10 | 5 | 16 h | 8/10 | Avec Hub Échéances Sprint 4 |
| **M-11** Alertes péremption équipements | 6 | 10 | 5 | 16 h | 7/10 | Avec Hub Échéances Sprint 4 |
| **M-14** Export CSV / XLSX généralisé | 6 | 10 | 4 | 16 h | 8/10 | Sprint 3 |
| **M-04** CRUD complet templates de visite | 6 | 10 | 7 | 25 h | 6/10 | Sprint 5 |
| **M-07** Galerie photo `/photos` | 8 | 6 | 5 | 18 h | 6/10 | Sprint 5 |
| **M-19** Rapport hebdo emailé | 4 | 10 | 5 | 15 h | 7/10 | Avec push Sprint 4 |
| **V-01** QR Code site | 10 | 10 | 6 | 25 h | 8/10 | Sprint 5 (besoin SSO/auth solide d'abord) |
| **MT-01** Migration Postgres | 4 | 10 | 7 | 25 h | 6/10 | Quand on dépasse 50 users simultanés |
| **MT-02** Hiérarchie Établissement/Unité/Équipe | 6 | 10 | 8 | 40 h | 5/10 | Phase plateformisation |
| **MT-04** SSO / OIDC | 6 | 10 | 7 | 30 h | 6/10 | Phase plateformisation |
| **V-04** IA Vision détection équipement | 8 | 10 | 7 | 30 h | 7/10 | Sprint 5 ou après |
| **V-03** Annotation photo | 8 | 8 | 7 | 25 h | 6/10 | Post-V3.0 |

### 1.3 Fonctionnalités à ABANDONNER (ou simplifier drastiquement)

Valeur trop faible vs coût, ou périmètre déjà couvert autrement.

| Item | Pourquoi abandonner | Décision proposée |
|---|---|---|
| **V-06** Mode binôme (saisie simultanée) | XL complexité (WebSocket + conflict resolution), valeur réelle ★★ (les binômes peuvent se passer la tablette à 2 sans co-édition temps réel) | **Abandonner** — solution low-tech existe (handoff) |
| **V-09** Plan interactif des sites | L complexité (upload plan + drag&drop + persistance) pour un gain marginal vs liste catégorisée d'équipements déjà existante | **Abandonner** ou reporter post-V3.0 indéfiniment |
| **V-10** Indicateur qualité de saisie | Gadget qui ajoute du bruit visuel ; la qualité se mesure mieux côté dashboard manager (M-01 / M-05) | **Abandonner** — couverte par M-01 |
| **MT-11** Multi-langue | Pertinent uniquement si déploiement international réel ; pour l'instant FR exclusivement. Risque : sur-engineering | **Abandonner** jusqu'à demande explicite client |
| **MT-12** Branding par établissement | Charme cosmétique mais aucun manager ne le réclame en priorité. Maintient une seconde source de vérité (logo, en-tête). | **Abandonner** ou reporter en optionnel V3.x |
| **m26** Routes API GET /procedures et /visit-templates | Servies en SSR ; les endpoints dupliquent la requête Prisma | **Supprimer les endpoints** |
| **m29** PATCH/DELETE photo orphelins | Pas de besoin métier exprimé (les photos sont attachées à une obs, pas indépendantes) | **Supprimer les endpoints** |
| **PATCH/DELETE actions/[id]** | Le PATCH ne sert pas l'UI ; le DELETE est couvert par le soft-delete `localStatus` | **Supprimer les endpoints PATCH/DELETE** |
| **PATCH/DELETE actions/validations/[id]** | UI d'annulation à livrer (UX-17). Le PATCH n'a pas de cas d'usage clair (modifier le commentaire ?). | **Garder DELETE** (UX-17), **supprimer PATCH** |
| **Suggestions IA basées sur historique** | Valeur charme, complexité L, ROI faible vs Aujourd'hui + Échéances qui couvrent déjà 80 % du besoin | **Abandonner** |
| **Templates de notifications configurables** | Sur-engineering V1. Notifications fixées + opt-in suffit pour atteindre 100 équipes | **Abandonner** dans le périmètre 6 mois |
| **Modèles Prisma morts** (Mnemonique, Abreviation, Comment, Report, SiteVisitReport, ObservationHistory) | Code mort sans UI prévue avant V3 | **Supprimer du schéma** en Sprint 1 (économie de surface) |

**Économie d'effort** : ~150 heures.

---

## 2. Analyse ROI exhaustive — classement complet

### 2.1 Formule de scoring

```
Score brut = Impact_utilisateur + Impact_metier
ROI = min(10, Score_brut / Complexité × 5)
Au-delà de 10, c'est plafonné — au moins c'est lisible.
```

### 2.2 Top 10 fonctionnalités les PLUS rentables

| Rang | Item | Impact U | Impact M | Compl. | Coût | ROI |
|---|---|---|---|---|---|---|
| 1 | **UX-02** Menu mobile « ⋯ Plus » | 10 | 8 | 2 | 4 h | **10/10** |
| 2 | **C5** Variables CSS fantômes | 9 | 7 | 1 | 1 h | **10/10** |
| 3 | **UX-19** Bouton « Voir le rapport » | 9 | 7 | 1 | 2 h | **10/10** |
| 4 | **UX-13** AgentAutocomplete filtres | 9 | 9 | 2 | 4 h | **10/10** |
| 5 | **C6** Bouton « + Nouvelle procédure » | 7 | 8 | 1 | 2 h | **10/10** |
| 6 | **C2** Bug scope teamId multi-équipes | 8 | 10 | 2 | 4 h | **10/10** |
| 7 | **UX-07** Statuts pleine largeur | 9 | 8 | 2 | 6 h | **10/10** |
| ~~8~~ | ~~V-02 Reconnaissance vocale~~ — ⛔ abandonnée (PO 2026-06-14) | — | — | — | — | — |
| 9 | **UX-17** Annulation validation 5 min | 9 | 8 | 3 | 6 h | **9/10** |
| 10 | **UX-10** Toaster + ConfirmDialog | 9 | 7 | 3 | 6 h | **9/10** |

Ces 10 items totalisent **~43 heures** pour un gain UX et métier très visible. **À traiter dans Sprints 1 et 2.**

### 2.3 Top 10 fonctionnalités les MOINS rentables (à reporter ou abandonner)

| Rang | Item | Impact U | Impact M | Compl. | Coût | ROI | Action |
|---|---|---|---|---|---|---|---|
| 1 | **V-06** Mode binôme | 8 | 8 | 10 | 80 h | 4/10 | **Abandon** |
| 2 | **V-09** Plan interactif sites | 8 | 8 | 9 | 60 h | 4/10 | **Abandon** |
| 3 | **MT-11** Multi-langue | 2 | 4 | 6 | 25 h | 3/10 | **Abandon** |
| 4 | **V-10** Indicateur qualité saisie | 6 | 7 | 7 | 25 h | 5/10 | **Abandon** (couvert M-01) |
| 5 | **MT-12** Branding par établissement | 4 | 6 | 5 | 20 h | 5/10 | Report V3.x |
| 6 | **MT-06** Workflow approbation rapports | 4 | 7 | 7 | 30 h | 4/10 | Report V3.x |
| 7 | **MT-07** API publique / Webhooks | 4 | 9 | 7 | 35 h | 5/10 | Report quand demande client |
| 8 | **V-03** Annotation photo | 8 | 8 | 8 | 35 h | 5/10 | Report post-V3.0 |
| 9 | **MT-02** Hiérarchie Établissement | 6 | 10 | 8 | 40 h | 5/10 | Quand >50 équipes |
| 10 | **M-04** CRUD templates visite | 6 | 9 | 7 | 25 h | 6/10 | Sprint 5 |

**Économie** : abandonner les 4 premiers libère ~190 heures = environ 2 mois de capacité solo.

---

## 3. Backlog structuré — Epics, Features, User Stories

### 3.1 Epic E1 — Stabilisation et confiance

**Objectif** : lever les irritants critiques + bugs visibles + dette technique bloquante.

#### Feature E1-F1 — Bugs et dead-ends critiques

**US-1.1** : En tant qu'**utilisateur**, je souhaite **que les pages s'affichent correctement** (pas de blanc-sur-blanc) afin de **lire les comptes-rendus sans bug visuel**.
- Critères : aperçu rapport session lisible, page offline visible, page 404 stylée.
- Complexité : S — 1 h.
- Dépendances : aucune.
- Réf : C5.

**US-1.2** : En tant qu'**EDITOR**, je souhaite que **le bouton « + Nouvelle procédure » ouvre un formulaire** afin de **créer une procédure**.
- Critères : créer `/admin/procedures/new/page.tsx` qui rend `ProcedureEditClient` en mode création ; POST `/api/procedures` accepte les mêmes champs que PATCH.
- Complexité : S — 2 h.
- Dépendances : aucune.
- Réf : C6.

**US-1.3** : En tant qu'**utilisateur multi-équipes**, je souhaite **pouvoir valider une action sur un de mes agents** afin que **mon scope d'équipe ne soit pas bloquant**.
- Critères : factoriser `assertTeamAccess(scope, teamId)` qui gère `{} | {teamId: "__none__"} | {teamId: {in: [...]}}` ; appliquer dans `api/actions/[id]/validate/route.ts`, `api/observations/[id]/route.ts`. Tests unitaires des 3 formes × 3 rôles.
- Complexité : S — 4 h.
- Dépendances : aucune.
- Réf : C2.

**US-1.4** : En tant qu'**utilisateur**, je souhaite **pouvoir ouvrir le rapport PDF d'une session/visite déjà clôturée** depuis la liste afin de **ne pas devoir deviner l'URL**.
- Critères : bouton « 📄 Voir le rapport » sur cartes statut `completed` dans `SessionsListClient` et `VisitsListClient`.
- Complexité : S — 2 h.
- Dépendances : aucune.
- Réf : UX-19.

#### Feature E1-F2 — Sécurité technique fondamentale

**US-1.5** : En tant qu'**admin**, je souhaite **que les photos ne soient plus accessibles publiquement** afin de **respecter la confidentialité multi-équipes**.
- Critères : déplacer `public/uploads/` vers `data/uploads/` hors `public/` ; créer `GET /api/photos/[id]/file` qui vérifie auth + scope team puis stream le fichier ; mettre à jour tous les `<img src>` ; supprimer bypass `/uploads/` du middleware.
- Complexité : M — 12 h.
- Dépendances : aucune.
- Réf : C1.

**US-1.6** : En tant qu'**admin**, je souhaite **que l'application valide les uploads photos** afin d'**éviter une attaque DoS disque**.
- Critères : allowlist MIME (`image/jpeg`, `image/png`, `image/webp`) ; plafond 10 Mo ; rejet 415/413.
- Complexité : S — 4 h.
- Dépendances : C1 (changement d'API).
- Réf : M1.

**US-1.7** : En tant qu'**admin**, je souhaite **que le login soit limité en débit** afin d'**éviter le bruteforce**.
- Critères : compteur en mémoire par IP+email ; back-off exponentiel après 3 échecs ; alerte au-delà de 5 ; journal des `LOGIN_FAILED` dans AuditLog.
- Complexité : S — 5 h.
- Dépendances : aucune.
- Réf : M3.

**US-1.8** : En tant qu'**équipe ops**, je souhaite **que la base soit sauvegardée quotidiennement** afin de **garantir la continuité d'activité**.
- Critères : script `VACUUM INTO` quotidien (cron) + retention 30 j + rsync vers stockage distant + procédure de restauration documentée et testée.
- Complexité : S — 4 h.
- Dépendances : aucune.
- Réf : MT-10.

**US-1.9** : En tant qu'**équipe dev**, je souhaite **versionner le schéma Prisma** afin de **garantir des déploiements sans perte de données**.
- Critères : `prisma migrate dev --name initial` ; vérifier que la migration représente l'état réel ; règle CI : tout changement de schéma = nouvelle migration. Supprimer `db push` du workflow.
- Complexité : S — 4 h.
- Dépendances : aucune.
- Réf : C4.

**US-1.10** : En tant qu'**équipe dev**, je souhaite **voir les erreurs en production** afin de **réagir avant que les utilisateurs ne se plaignent**.
- Critères : Sentry (free tier) installé côté client et serveur ; logs structurés JSON ; healthcheck `/api/health`.
- Complexité : S — 5 h.
- Dépendances : aucune.
- Réf : MT-09.

#### Feature E1-F3 — Quick wins UX globaux

**US-1.11** : En tant qu'**utilisateur**, je souhaite **avoir des feedbacks visuels modernes** au lieu des `alert()` / `confirm()` natifs.
- Critères : `sonner` installé ; composant `<ConfirmDialog>` (sheet sur mobile, modal sur desktop) ; remplacer 13 `confirm()` + 13 `alert()`.
- Complexité : M — 6 h.
- Dépendances : aucune.
- Réf : UX-10.

**US-1.12** : En tant qu'**utilisateur**, je souhaite **annuler une validation d'action erronée** dans les 5 minutes.
- Critères : icône poubelle sur la ligne d'historique de validation < 5 min ; appel `DELETE /api/actions/validations/[id]` ; trace AuditLog. Au-delà de 5 min, le bouton n'apparaît plus.
- Complexité : S — 6 h.
- Dépendances : E1-F2 (AuditLog actif).
- Réf : UX-17.

**US-1.13** : En tant qu'**admin**, je souhaite **réinitialiser le mot de passe d'un utilisateur par email** au lieu de le taper en clair.
- Critères : bouton « Envoyer lien de réinitialisation » ; token signé HMAC court (1h) ; page `/reset-password?token=...` ; email transactionnel (à brancher sur un SMTP type Resend / SendGrid). Suppression du champ MDP de la modale d'édition.
- Complexité : M — 6 h.
- Dépendances : config SMTP (variable env).
- Réf : M20.

**US-1.14** : En tant qu'**utilisateur mobile**, je souhaite **avoir accès à Contacts / Sessions / Stats / Liens** sans devoir taper l'URL.
- Critères : 6e bouton « ⋯ Plus » dans bottom-nav ; ouvre un `<BottomSheet>` avec navigation vers Mon Profil / Sessions / Stats / Liens / Contacts / Admin (si rôle).
- Complexité : S — 4 h.
- Dépendances : `<BottomSheet>` (à créer dans E2-F1).
- Réf : UX-02.

#### Feature E1-F4 — Dette technique bloquante

**US-1.15** : En tant qu'**équipe dev**, je souhaite **supprimer le code mort** afin de **simplifier la maintenance**.
- Critères : supprimer modèles Prisma `Mnemonique`, `Abreviation`, `Comment`, `Report`, `SiteVisitReport`, `ObservationHistory` ; supprimer dossier vide `src/app/(auth)/` ; supprimer routes API orphelines (cf. §1.3 décision) ; supprimer champs Prisma jamais lus (`Agent.rawLabel`, `Photo.clientId/byteSize/width/height/syncStatus`, `VeilleSession.clientGeneratedId`, etc.).
- Complexité : M — 8 h (migrations à écrire).
- Dépendances : US-1.9 (migrations versionnées).
- Réf : S-04, S-05, S-10, m11.

**US-1.16** : En tant qu'**utilisateur**, je souhaite **utiliser les tables admin sur tablette/mobile** afin de **gérer mon équipe en déplacement**.
- Critères : remplacer `overflow-hidden` par `overflow-x-auto` sur 5 tables admin (Users, Teams, Agents, Sites, Procedures) ; pattern de transformation en cards empilées sur < md.
- Complexité : M — 12 h.
- Dépendances : aucune.
- Réf : C7.

**US-1.17** : En tant qu'**utilisateur**, je souhaite **prendre des photos pendant une visite de site** afin de **documenter les NC**.
- Critères : intégrer `PhotoControls` (existant dans SessionClient) dans `VisitClient` et `VisitInventoryClient` ; relier `Photo.visitObservationId` ou créer une nouvelle FK.
- Complexité : M — 8 h.
- Dépendances : modèle photo polymorphe (Prisma migration légère).
- Réf : M8.

**Récapitulatif Epic E1** : 17 stories, ~95 heures. **Sprints 1 + début Sprint 2.**

---

### 3.2 Epic E2 — Refonte mobile-first et patterns

**Objectif** : poser les composants réutilisables (BottomSheet, EntityCard, ConfirmDialog) et les patterns mobiles (swipe, FAB, statuts) qui serviront aux Epics suivants.

#### Feature E2-F1 — Composants partagés

**US-2.1** : En tant qu'**équipe dev**, je souhaite **un composant `<BottomSheet>` réutilisable** afin de **standardiser les modales mobiles**.
- Critères : `min-h-[40vh] max-h-[90vh] overflow-y-auto`, header sticky avec ✕, footer sticky avec CTA, drag handle, backdrop semi-transparent, swipe-down to close, bascule en modal centré sur >= md.
- Complexité : M — 10 h.
- Dépendances : aucune.
- Réf : UX-03, P-01.

**US-2.2** : En tant qu'**équipe dev**, je souhaite **un composant `<EntityCard>` configurable** afin d'**éliminer la duplication des 7 listes**.
- Critères : slots `leadingMedia / title / subtitle / badges / trailingActions / swipeActions` ; mode list vs grid.
- Complexité : M — 12 h.
- Dépendances : aucune.
- Réf : UX-04.

**US-2.3** : En tant qu'**utilisateur**, je souhaite **swiper sur les cartes** pour archiver/supprimer afin de **réduire les erreurs de tap**.
- Critères : geste swipe gauche révèle [Valider / Reporter] ; swipe droit révèle [Archiver] ; long swipe gauche révèle [Supprimer définitivement avec confirm].
- Complexité : M — 10 h.
- Dépendances : US-2.2 (`<EntityCard>`).
- Réf : UX-05.

**US-2.4** : En tant qu'**utilisateur mobile**, je souhaite **un bouton flottant « + »** afin d'**ajouter rapidement sans scroller**.
- Critères : composant `<FAB>` positionné `bottom-[88px] right-4` ; se contracte au scroll-down ; geste contextualisable (Nouvelle visite, Nouveau contact, etc.).
- Complexité : S — 4 h.
- Dépendances : aucune.
- Réf : UX-06.

#### Feature E2-F2 — Statuts pleine largeur (sessions + visites)

**US-2.5** : En tant qu'**utilisateur terrain**, je souhaite **des boutons statut larges et lisibles** afin de **saisir au pouce ou en gants**.
- Critères : remplacer `flex gap-1.5 flex-wrap` par `grid grid-cols-3 gap-2 min-h-12` (~56 px hauteur) ; 3 statuts principaux + menu « Autres » pour AR/NO ; identique sur SessionClient et VisitClient.
- Complexité : S — 6 h.
- Dépendances : aucune.
- Réf : UX-07, UX-18.

#### Feature E2-F3 — Vocabulaire harmonisé

**US-2.6** : En tant qu'**équipe produit**, je souhaite **un vocabulaire cohérent** dans toute l'application.
- Critères : table de correspondance (cf. VISION-V2.md §12.4). Renommages :
  - `/procedures` → label « Catalogue »
  - `/sessions` → label « Mes veilles »
  - `/visits` CHECKLIST → label « Inspection »
  - `/visits` INVENTORY → label « Inventaire »
  - « Observateur » / « Créateur » → « Auteur » partout
  - Statuts anglais → français (`active` → « En cours », etc.)
  - ONLINE/OFFLINE mobile → EN LIGNE/HORS LIGNE
- Complexité : S — 4 h.
- Dépendances : aucune.
- Réf : UX-15.

#### Feature E2-F4 — Filtres recherchables et tableaux

**US-2.7** : En tant qu'**utilisateur**, je souhaite **rechercher un agent ou un site dans les filtres** au lieu de scroller un `<select>` géant.
- Critères : utiliser `AgentAutocomplete` (existant) dans `/history` et `/stats` ; créer `<SiteAutocomplete>` (~50 lignes) sur le même patron ; remplacer les 3 `<select>` filtres.
- Complexité : S — 4 h.
- Dépendances : aucune.
- Réf : UX-13.

#### Feature E2-F5 — Refonte chrome admin mobile

**US-2.8** : En tant qu'**EDITOR/ADMIN mobile**, je souhaite **un menu admin compact** afin de **récupérer l'espace écran**.
- Critères : remplacer `flex flex-col lg:flex-row` (qui pose une grille 2-col en haut = 300 px de chrome) par : top-bar admin compact (logo + hamburger + bouton « ← Application ») + drawer latéral coulissant au tap hamburger ; bottom-nav app reste visible.
- Complexité : M — 12 h.
- Dépendances : US-2.1 (`<BottomSheet>` style pour drawer).
- Réf : UX-11.

#### Feature E2-F6 — Drawer / Filters sheet

**US-2.9** : En tant qu'**utilisateur**, je souhaite **un panneau de filtres avancés** pour `/history` et `/stats` afin de **garder l'écran principal lisible**.
- Critères : bouton « Filtres » dans header → ouvre `<BottomSheet>` plein écran avec filtres ; chips au-dessus de la liste résument les filtres actifs (cliquables pour retirer).
- Complexité : M — 10 h.
- Dépendances : US-2.1.
- Réf : UX-08.

**Récapitulatif Epic E2** : 9 stories, ~72 heures. **Sprint 2 + chevauchement Sprint 3.**

---

### 3.3 Epic E3 — Refonte Accueil (Aujourd'hui USER + Mon Profil)

**Objectif** : livrer le pivot produit côté USER terrain. Implémenter l'écran « Aujourd'hui » + la page profil.

#### Feature E3-F1 — Écran « Aujourd'hui » USER

**US-3.1** : En tant qu'**utilisateur**, je souhaite **arriver sur un écran personnalisé** (au lieu du catalogue de procédures) afin de **voir directement ce que je dois faire**.
- Critères : remplacer la redirection `/` → `/procedures` par `/` → `/today`. Page `/today` rend l'écran « Aujourd'hui » selon le rôle de l'utilisateur.
- Complexité : S — 4 h.
- Dépendances : US-3.2 à US-3.6.
- Réf : UX-01.

**US-3.2** : En tant qu'**utilisateur**, je souhaite **voir mes sessions/visites en cours** afin de **reprendre instantanément**.
- Critères : carte sticky en haut avec une seule session OU visite en `status="draft" | "active"` la plus récente ; bouton « Reprendre » qui pointe vers `/sessions/[id]` ou `/visits/[id]`.
- Complexité : M — 6 h.
- Dépendances : aucune.

**US-3.3** : En tant qu'**utilisateur**, je souhaite **voir 3 à 5 items à traiter aujourd'hui** triés par urgence.
- Critères : agrège (a) actions importées avec `dueAt = today ± 1 jour` ou retard ; (b) NC qui m'ont été assignées ; (c) vus prioritaires (agent en fraîcheur rouge). Carte avec libellé, contexte (date / nom), CTA « Valider » ou « Démarrer ».
- Complexité : M — 10 h.
- Dépendances : Hub Échéances v1 (modèle Échéance v0).
- Réf : UX-01 + Hub Échéances.

**US-3.4** : En tant qu'**utilisateur**, je souhaite **3 raccourcis natifs** : QR Scanner / Appel astreinte / Nouvelle veille.
- Critères : 3 boutons gros en grid 3 colonnes (chacun ~96 px haut) ; raccourci « Astreinte » = lien `tel:` direct au premier contact d'astreinte de l'équipe (à modéliser : ajouter `Contact.isOnCall` ou utiliser une convention type tag).
- Complexité : M — 8 h.
- Dépendances : modèle « contact d'astreinte » (S — 1 h).

**US-3.5** : En tant qu'**utilisateur**, je souhaite **voir mes 3 dernières activités** afin d'**avoir un sentiment de continuité**.
- Critères : 3 lignes texte (date + libellé) non-cliquables ; data = dernières entrées de l'historique unifié.
- Complexité : S — 4 h.
- Dépendances : aucune.

**US-3.6** : En tant qu'**utilisateur**, je souhaite **une salutation contextuelle** « Bonjour Jessy ☀️/🌙 » selon l'heure afin que **l'app me semble personnelle**.
- Critères : header dynamique avec prénom + emoji selon heure (☀️ 8h-17h, 🌙 17h-7h) + nom de l'équipe principale + date FR.
- Complexité : S — 2 h.
- Dépendances : aucune.

#### Feature E3-F2 — Page Mon Profil `/me`

**US-3.7** : En tant qu'**utilisateur**, je souhaite **une page profil avec mes infos** afin de **m'approprier l'outil**.
- Critères : page `/me` avec sections : Identité (nom, email, équipes, rôle), Mes chiffres 30j (veilles, visites, vus), Mes activités en cours (sessions / visites / brouillons offline), Mon scope (équipes, sites, agents), Préférences, Sécurité (changer MDP, déconnexion), Synchronisation offline.
- Complexité : L — 16 h.
- Dépendances : US-3.8 à US-3.11.
- Réf : M-02.

**US-3.8** : En tant qu'**utilisateur**, je souhaite **changer mon mot de passe** depuis mon profil.
- Critères : modale (ou page) avec champ MDP actuel + nouveau MDP + confirmation ; validation côté serveur (`PATCH /api/auth/me/password`) ; rate-limit ; logout des autres sessions.
- Complexité : M — 6 h.
- Dépendances : aucune.

**US-3.9** : En tant qu'**utilisateur**, je souhaite **toggler ma vue cross-équipe** depuis mon profil.
- Critères : switch `viewAllTeams` ; appel `PATCH /api/auth/me` ; feedback toast.
- Complexité : S — 3 h.
- Dépendances : `/api/auth/me PATCH` (à créer).
- Réf : M-15.

**US-3.10** : En tant qu'**utilisateur**, je souhaite **voir mes mutations en file offline** et pouvoir les forcer.
- Critères : section « Synchronisation » avec compteur + bouton « Forcer la sync » qui appelle `syncQueue.replayAll()`. Liste des éléments en file (date, opération).
- Complexité : S — 4 h.
- Dépendances : E4-F1 (syncQueue activée).
- Réf : M-02.

**US-3.11** : En tant qu'**utilisateur**, je souhaite **changer la langue / le mode sombre / la signature PDF** depuis mon profil.
- Critères : panneau Préférences avec switch dark mode (CSS classes `dark:`) + signature (champ texte court ou upload image) ; préférences stockées dans `UserPreferences` (nouvelle table simple : key/value JSON par user).
- Complexité : M — 8 h.
- Dépendances : modèle UserPreferences (S — 2 h).

#### Feature E3-F3 — Démarrage unifié « Mon contrôle »

**US-3.12** : En tant qu'**utilisateur**, je souhaite **un écran de démarrage unifié** qui me propose toutes les options de contrôle.
- Critères : page `/start` (ou onglet « Mon contrôle » de la nav) avec 5 boutons gros : Scanner QR / Veille agent / Visite site / Inventaire / Vu agent/site. Section « En cours » au-dessus + section « 5 derniers contrôles » en-dessous.
- Complexité : M — 12 h.
- Dépendances : E2-F1.
- Réf : VISION-V2.md §4.5.

#### Feature E3-F4 — Refonte démarrage veille (Agent d'abord)

**US-3.13** : En tant qu'**utilisateur**, je souhaite **choisir l'agent AVANT les procédures** afin de **suivre la logique métier (je viens veiller cet agent, pas appliquer cette procédure)**.
- Critères : refonte du wizard `/start/veille` en 2 étapes : Étape 1 « L'agent » avec autocomplete + récents triés par fraîcheur ; Étape 2 « Procédures » avec suggestions (procédures jamais observées sur cet agent) + standard. Au démarrage, la session est créée avec l'agent.
- Complexité : L — 16 h.
- Dépendances : US-3.12.
- Réf : VISION-V2.md §4.7.

**Récapitulatif Epic E3** : 13 stories, ~99 heures. **Sprint 2 + Sprint 3.**

---

### 3.4 Epic E4 — Mode offline réel

**Objectif** : tenir la promesse PWA. Brancher `syncQueue` aux mutations critiques.

#### Feature E4-F1 — syncQueue branchée

**US-4.1** : En tant qu'**utilisateur en intervention sans réseau**, je souhaite que **mes saisies soient mises en file** afin de **ne rien perdre**.
- Critères : remplacer `fetch(...)` par `resilientFetch(...)` dans 6 mutations critiques : PATCH `/api/observations/:id` (SessionClient), POST `/api/sessions` (ProceduresClient), POST `/api/visits/:id/observations` (VisitClient), POST `/api/agents/:id/sight` (NoteModal), POST `/api/actions/:id/validate` (AgentActionsClient), POST `/api/photos` (NoteModal, SessionClient). Envoyer `clientGeneratedId` à chaque mutation.
- Complexité : L — 20 h.
- Dépendances : modèle idempotence côté serveur (à valider).
- Réf : C3.

**US-4.2** : En tant qu'**utilisateur**, je souhaite **que la file soit rejouée automatiquement** au retour de la connexion.
- Critères : event listener `window.addEventListener("online", replayAll)` ; backoff exponentiel sur les échecs ; max 3 retries par mutation ; au-delà, mutation marquée « failed » et exposée dans `/me`.
- Complexité : M — 8 h.
- Dépendances : US-4.1.

**US-4.3** : En tant qu'**utilisateur**, je souhaite **voir un toast** quand une mutation est mise en file ou rejouée avec succès.
- Critères : `resilientFetch` retourne `"queued" | Response` ; le caller affiche toast `« Mise en file. Sera envoyé au retour de la connexion »` ; au replay, toast `« 3 mutations synchronisées »`.
- Complexité : S — 4 h.
- Dépendances : E1-F3 toaster, US-4.1.

**US-4.4** : En tant qu'**utilisateur**, je souhaite **être averti des conflits** quand une saisie offline s'oppose à une saisie online plus récente.
- Critères : stratégie last-write-wins par défaut ; si l'observation a été modifiée par un autre utilisateur entre-temps (timestamp comparé), bottom-sheet `« Une mise à jour récente existe. Garder ma version / Voir la version récente »`.
- Complexité : L — 16 h.
- Dépendances : US-4.1.

#### Feature E4-F2 — Photos offline

**US-4.5** : En tant qu'**utilisateur**, je souhaite **prendre une photo hors-ligne** et qu'**elle soit envoyée au retour de la connexion**.
- Critères : photo stockée localement en IndexedDB (blob + métadonnées) ; mise en file ; au retour online, upload séquentiel avec progress dans `/me`.
- Complexité : L — 20 h.
- Dépendances : US-4.1, idéalement US-4.2.

**Récapitulatif Epic E4** : 5 stories, ~68 heures. **Sprint 3 ou Sprint 4 selon priorité.**

---

### 3.5 Epic E5 — Hub Échéances

**Objectif** : moteur central qui agrège visites en retard, péremptions, actions, etc. dans un flux unique.

#### Feature E5-F1 — Modèle conceptuel Échéance

**US-5.1** : En tant qu'**équipe dev**, je souhaite **un modèle conceptuel « Échéance »** afin de **représenter tous les items à traiter sous un format unifié**.
- Critères : pas une table SQL, mais une **vue dérivée** calculée à chaque requête (au moins en V1). Type TypeScript :
  ```
  type Echeance = {
    id: string  // composé : "action:abc", "visit:xyz", "equipment:pq"
    sourceType: "action" | "visit" | "equipment" | "habilitation" | ...
    sourceId: string
    label: string
    description: string
    dueAt: Date
    contextSiteId?: string
    contextAgentId?: string
    assignedToUserId?: string
    assignedToTeamId?: string
    status: "open" | "in_progress" | "closed" | "cancelled"
    urgency: "late" | "today" | "week" | "month" | "later"
    priority: "P0" | "P1" | "P2" | "P3"
    cta: { label: string; href: string }
  }
  ```
- Complexité : M — 8 h.
- Dépendances : aucune.
- Réf : VISION-V2.md §8.

**US-5.2** : En tant qu'**équipe dev**, je souhaite **un agrégateur backend** qui retourne la liste consolidée pour un utilisateur.
- Critères : endpoint `GET /api/echeances?scope=mine|team|all&period=30d` qui agrège (a) actions importées avec dueAt, (b) visites en retard `lastVisitDate + expectedFrequencyDays < today + N`, (c) équipements `expirationDate < today + N`, (d) sessions brouillon > 7j. Sortie : array d'Echeance trié par urgency puis priority.
- Complexité : L — 16 h.
- Dépendances : US-5.1.

#### Feature E5-F2 — Écran « Échéances »

**US-5.3** : En tant qu'**utilisateur**, je souhaite **un onglet Échéances** dans la nav afin de **voir tous mes items à traiter**.
- Critères : page `/echeances` listée dans nav (bottom-nav + sidebar) ; regroupement par buckets (En retard / Aujourd'hui / Cette semaine / Ce mois-ci / Plus tard) ; chaque carte avec libellé, contexte, CTA contextuel.
- Complexité : M — 12 h.
- Dépendances : US-5.2.

**US-5.4** : En tant qu'**utilisateur**, je souhaite **filtrer les échéances** par type, période, assigné.
- Critères : bouton « Filtres » → `<BottomSheet>` avec switches type ; chips actifs au-dessus de la liste.
- Complexité : M — 8 h.
- Dépendances : US-5.3, US-2.9.

**US-5.5** : En tant qu'**utilisateur**, je souhaite **« reporter » une échéance** avec justification afin d'**absorber les imprévus**.
- Critères : bouton « Reporter » sur chaque carte → modale avec nouvelle date + commentaire obligatoire ; trace AuditLog.
- Complexité : M — 8 h.
- Dépendances : US-5.3, E1-F2 (AuditLog).

#### Feature E5-F3 — Intégration Aujourd'hui

**US-5.6** : En tant qu'**utilisateur**, je souhaite **que l'écran Aujourd'hui affiche les 3-5 échéances prioritaires** au lieu d'une liste statique.
- Critères : remplacer la logique custom de US-3.3 par un appel `/api/echeances?scope=mine&priority=P0,P1&limit=5`.
- Complexité : S — 4 h.
- Dépendances : US-3.3, US-5.2.

#### Feature E5-F4 — Nouvelles sources d'échéances

**US-5.7** : En tant qu'**EDITOR/ADMIN**, je souhaite **définir des habilitations agent** avec date de validité.
- Critères : modèle `AgentHabilitation { agentId, type, validFrom, validUntil, source }` ; UI CRUD dans `/admin/agents/[id]/habilitations` ; intégration dans le hub Échéances (validUntil < today + 30j → P1).
- Complexité : L — 16 h.
- Dépendances : US-5.2.

**US-5.8** : En tant qu'**EDITOR/ADMIN**, je souhaite **modéliser des exercices périodiques** (incendie, secours).
- Critères : modèle `RegulatoryExercise { siteId, type, expectedFrequencyDays, lastDoneAt }` ; UI CRUD légère.
- Complexité : M — 10 h.
- Dépendances : US-5.2.

**US-5.9** : En tant qu'**EDITOR/ADMIN**, je souhaite **modéliser des documents à renouveler**.
- Critères : modèle `RegulatoryDocument { siteId, type, expirationDate, reminderDays[] }` ; UI CRUD.
- Complexité : M — 10 h.
- Dépendances : US-5.2.

**Récapitulatif Epic E5** : 9 stories, ~92 heures. **Sprint 4.**

---

### 3.6 Epic E6 — Dashboard Manager

**Objectif** : transformer le manager en utilisateur quotidien grâce à un tableau de bord opérationnel.

#### Feature E6-F1 — Écran Aujourd'hui MANAGER

**US-6.1** : En tant que **manager**, je souhaite **un écran de tournée** différent de l'écran USER.
- Critères : si rôle = EDITOR / ADMIN ou `UserTeam.role = MANAGER`, l'écran `/today` rend la variante MANAGER (cf. VISION-V2.md §6.3). Bannière diagnostic + 3 progress bars (visites / veilles / actions) + listes Agents à veiller / Sites sans visite + 3 raccourcis manager.
- Complexité : L — 20 h.
- Dépendances : Hub Échéances (E5), Dashboard Manager (E6-F2).
- Réf : M-01.

**US-6.2** : En tant que **manager**, je souhaite **voir les 5 agents les plus anciens sans veille** sur mon périmètre.
- Critères : section sur Aujourd'hui MANAGER ; requête `SELECT agents WHERE memberships IN myTeams ORDER BY lastSessionAt ASC LIMIT 5`.
- Complexité : M — 6 h.
- Dépendances : aucune (logique freshness déjà existante).

**US-6.3** : En tant que **manager**, je souhaite **voir les 5 sites les plus en retard de visite** sur mon périmètre.
- Critères : tri par `(lastVisitDate + expectedFrequencyDays) - now()` ascendant.
- Complexité : M — 6 h.
- Dépendances : US-5.7 (modèle visites en retard) ou logique inline.

#### Feature E6-F2 — Page « Pilotage »

**US-6.4** : En tant que **manager**, je souhaite **une page de pilotage profonde** (au-delà d'Aujourd'hui).
- Critères : page `/pilotage` accessible depuis menu ⋯ Plus. Sections : KPI géants (Sites à jour %, Actions ouvertes #, Veilles ce mois #) avec comparaison période précédente ; Bannière diagnostic ; Top 3 alertes ; onglets « Activité » / « Qualité » / « Risque » / « Conformité » (cf. VISION-V2.md §7.1).
- Complexité : L — 25 h.
- Dépendances : US-6.5 à US-6.7.

**US-6.5** : En tant que **manager**, je souhaite **un onglet « Activité »** : qui fait quoi.
- Critères : Top 10 observateurs par nombre de veilles ; Top 10 par visites ; Top 10 par validations ; Taux de couverture agents et sites.
- Complexité : M — 10 h.
- Dépendances : US-6.4.

**US-6.6** : En tant que **manager**, je souhaite **un onglet « Qualité »** : comment c'est saisi.
- Critères : Taux de NC avec photo / commentaire ; Délai moyen NC → clôture ; Taux de sessions clôturées avec commentaire général.
- Complexité : M — 10 h.
- Dépendances : US-6.4.

**US-6.7** : En tant que **manager**, je souhaite **un onglet « Risque »** : où ça brûle.
- Critères : Top 10 procédures NON_CONFORME ; Top 10 agents avec actions ouvertes ; Top 10 sites avec NC ouvertes ; Distribution gravités.
- Complexité : M — 10 h.
- Dépendances : US-6.4.

**US-6.8** : En tant que **manager**, je souhaite **drill-down depuis tout indicateur** vers la liste filtrée.
- Critères : chaque KPI / barre / ligne est cliquable et navigue vers la liste filtrée correspondante.
- Complexité : M — 10 h.
- Dépendances : US-6.5/6/7.
- Réf : M-18.

#### Feature E6-F3 — Vue NC consolidée

**US-6.9** : En tant que **manager**, je souhaite **un onglet « Non-conformités »** avec toutes les NC ouvertes sur mon périmètre.
- Critères : page `/pilotage/nc` avec filtres responsable / échéance / site / statut. Bouton « Assigner » / « Modifier responsable » / « Marquer redressée » par ligne.
- Complexité : L — 18 h.
- Dépendances : aucune.
- Réf : M-05.

#### Feature E6-F4 — Export généralisé

**US-6.10** : En tant que **manager**, je souhaite **exporter mes données** en CSV/XLSX.
- Critères : bouton « Exporter » sur `/admin/users`, `/admin/agents`, `/echeances`, `/history`, `/pilotage/nc`. Format CSV avec UTF-8 BOM (Excel-compatible). En option XLSX (réutilisation xlsx déjà en dépendance).
- Complexité : M — 12 h.
- Dépendances : aucune.
- Réf : M-14.

**Récapitulatif Epic E6** : 10 stories, ~127 heures. **Sprint 4.**

---

### 3.7 Epic E7 — Notifications

**Objectif** : passer l'app en mode push. Email + push web.

#### Feature E7-F1 — Email transactionnel

**US-7.1** : En tant qu'**équipe ops**, je souhaite **un service email** intégré.
- Critères : intégration Resend (free tier 3000/mois suffisant) ou SMTP générique ; helper `sendEmail({ to, subject, html, tags })` ; templates simples React Email ou similaire.
- Complexité : M — 8 h.
- Dépendances : config env.

**US-7.2** : En tant qu'**utilisateur**, je souhaite **recevoir un email récap hebdomadaire** lundi 8h.
- Critères : cron lundi 8h ; pour chaque utilisateur : récap semaine passée (mes contributions) + semaine en cours (mes échéances) ; opt-out individuel dans `/me`.
- Complexité : L — 16 h.
- Dépendances : US-7.1, US-5.2.
- Réf : M-19.

**US-7.3** : En tant qu'**utilisateur**, je souhaite **un email d'alerte** quand une échéance bascule en retard.
- Critères : cron quotidien à 7h ; pour chaque échéance qui est devenue P0 (retard) depuis hier, email à l'assigné.
- Complexité : M — 8 h.
- Dépendances : US-7.1, US-5.2.

#### Feature E7-F2 — Push web (PWA)

**US-7.4** : En tant qu'**utilisateur**, je souhaite **autoriser les notifications push** depuis mon profil.
- Critères : Notification API + Service Worker existant ; clé VAPID générée ; opt-in dans `/me` ; subscription enregistrée serveur.
- Complexité : L — 16 h.
- Dépendances : config VAPID.

**US-7.5** : En tant qu'**utilisateur**, je souhaite **recevoir une push quotidienne** si > 0 échéances pour aujourd'hui.
- Critères : cron 7h ; envoi push aux utilisateurs avec échéances P0/P1 du jour ; sound off ; click → ouvre `/today`.
- Complexité : M — 8 h.
- Dépendances : US-7.4, US-5.2.

**Récapitulatif Epic E7** : 5 stories, ~56 heures. **Sprint 4 (email) + Sprint 5 (push).**

---

### 3.8 Epic E8 — Audit, archives, gouvernance ADMIN

**Objectif** : combler les manques admin identifiés (audit log, archives, paramètres).

#### Feature E8-F1 — AuditLog systématique

**US-8.1** : En tant qu'**admin**, je souhaite **un journal d'audit consultable** afin de **savoir qui a fait quoi**.
- Critères : helper `logAudit(action, entity, entityId, before, after)` ; appel systématique sur ~15 routes mutantes sensibles (user CRUD, team CRUD, role change, hard-delete agent/site, validation, validation cancel, import Excel, photo delete). Page `/admin/audit` avec filtres.
- Complexité : L — 18 h.
- Dépendances : aucune.
- Réf : M-03, M11.

#### Feature E8-F2 — Page Archives

**US-8.2** : En tant qu'**utilisateur** (et admin), je souhaite **voir mes éléments archivés** et **les restaurer**.
- Critères : toggle « Afficher archivés » sur listes `/sessions`, `/visits`, `/agents`, `/sites` ; bouton « Restaurer » qui passe `status` ou `isVisible` à actif.
- Complexité : M — 10 h.
- Dépendances : aucune.
- Réf : M-10.

#### Feature E8-F3 — Aujourd'hui ADMIN

**US-8.3** : En tant qu'**admin**, je souhaite **un écran de pilotage système** au lieu du dashboard actuel.
- Critères : écran `/today` pour rôle ADMIN ≠ USER/MANAGER (cf. VISION-V2.md §6.4). État global + Alertes système + Usage 7j + Conformité + À arbitrer + Actions rapides.
- Complexité : L — 20 h.
- Dépendances : US-8.1.

#### Feature E8-F4 — Manager d'équipe et gestion fine

**US-8.4** : En tant qu'**admin**, je souhaite **désigner un MANAGER** dans une équipe.
- Critères : exposer `UserTeam.role` (radio MEMBER/MANAGER) dans `/admin/teams/[id]` ; mise à jour via PATCH `members`. Le rôle MANAGER hérite des droits EDITOR sur cette équipe.
- Complexité : M — 8 h.
- Dépendances : aucune.
- Réf : M-15.

**US-8.5** : En tant qu'**admin**, je souhaite **créer un agent manuellement** depuis l'UI.
- Critères : bouton « + Nouvel agent » dans `/admin/agents` ; modale avec matricule, nom, prénom, équipes ; PATCH étendu pour les champs nom/prénom/matricule.
- Complexité : M — 8 h.
- Dépendances : aucune.
- Réf : M-16.

**Récapitulatif Epic E8** : 5 stories, ~64 heures. **Sprint 3 + Sprint 4.**

---

### 3.9 Epic E9 — ~~Reconnaissance vocale~~ et productivité saisie

> ⛔ **Feature E9-F1 (US-9.1) abandonnée définitivement (PO 2026-06-14)**. Voir [memory/business-rules.md](memory/business-rules.md) §Audio. L'Epic E9 conserve uniquement les features non vocales (E9-F2 capture photo, E9-F3 NC mobile).

**Objectif** : amplifier la productivité de saisie terrain par patterns simples.

#### ~~Feature E9-F1 — Voix → commentaire~~ — ⛔ ABANDONNÉE DÉFINITIVEMENT (PO 2026-06-14)

~~**US-9.1** : En tant qu'**utilisateur**, je souhaite **dicter mes commentaires** au lieu de taper.~~
~~- Critères : bouton 🎤 à droite de chaque textarea de commentaire (session, visite, NC, note, validation) ; Web Speech API en `lang="fr-FR"` ; affichage live du texte transcrit ; tap pour démarrer / arrêter ; fallback élégant si non supporté.~~
~~- Complexité : S — 8 h.~~
~~- Dépendances : aucune.~~
~~- Réf : V-02.~~

#### Feature E9-F2 — Capture photo rapide

**US-9.2** : En tant qu'**utilisateur**, je souhaite **un raccourci 📷 unifié** qui ouvre directement la caméra arrière.
- Critères : composant `<CaptureButton>` qui utilise `<input type="file" accept="image/*" capture="environment">` ; auto-compression existante ; rendu vignette ; replace fonctionnel actuel par ce composant.
- Complexité : S — 4 h.
- Dépendances : aucune.

#### Feature E9-F3 — Refonte saisie NC mobile

**US-9.3** : En tant qu'**utilisateur**, je souhaite **saisir une NC en 3 champs** sur mobile.
- Critères : sur mobile (`md:hidden`), exposer Description + Responsable + Échéance uniquement ; bouton « Détails » → accordéon ou bottom-sheet pour les 4 autres champs.
- Complexité : M — 10 h.
- Dépendances : aucune.
- Réf : UX-20.

**Récapitulatif Epic E9** : 3 stories, ~22 heures. **Sprint 3.**

---

### 3.10 Epic E10 — QR Codes et identification physique

**Objectif** : scan QR pour identifier site / équipement et démarrer un contrôle.

#### Feature E10-F1 — Génération QR

**US-10.1** : En tant qu'**admin**, je souhaite **générer des QR codes** pour mes sites.
- Critères : page `/admin/qr-codes` avec sélection « tous les sites de mon équipe » ou par site ; génération PDF imprimable A4 (étiquettes prédécoupées) ; URL format `https://veille.app/qr/site/{id}?token={hmac}` (HMAC signature à expiration).
- Complexité : M — 12 h.
- Dépendances : librairie qrcode (~50 ko).
- Réf : V-01.

**US-10.2** : En tant qu'**admin**, je souhaite **générer des QR par équipement**.
- Critères : sur fiche site, bouton « Générer QR équipements » → PDF avec un QR par SiteEquipment actif.
- Complexité : S — 4 h.
- Dépendances : US-10.1.

#### Feature E10-F2 — Lecture QR

**US-10.3** : En tant qu'**utilisateur**, je souhaite **scanner un QR site** depuis l'app pour ouvrir directement la fiche.
- Critères : bouton « 📷 Scanner QR » sur Aujourd'hui + Mon contrôle ; utilise `BarcodeDetector` natif ou fallback ZXing ; redirige vers `/sites/[id]` avec bandeau « 🎯 Site identifié » + propositions d'action.
- Complexité : L — 18 h.
- Dépendances : permission caméra.

**US-10.4** : En tant qu'**utilisateur**, je souhaite **scanner un QR équipement** pour vérifier rapidement.
- Critères : ouvre `/sites/[siteId]/equipment/[id]` avec photo précédente + date péremption en gros + bouton « Vérifier maintenant » qui crée une observation directe.
- Complexité : M — 12 h.
- Dépendances : US-10.3.

**Récapitulatif Epic E10** : 4 stories, ~46 heures. **Sprint 5.**

---

### 3.11 Epic E11 — Templates de visite éditables

**Objectif** : combler la promesse « édition ultérieure ». Autonomie métier sur le référentiel.

#### Feature E11-F1 — Édition de template

**US-11.1** : En tant qu'**EDITOR**, je souhaite **dupliquer un template existant**.
- Critères : bouton « Dupliquer » sur `/admin/visit-templates` ; POST `/api/visit-templates/[id]/duplicate` ; ouverture du nouveau template en mode édition.
- Complexité : M — 8 h.
- Dépendances : aucune.

**US-11.2** : En tant qu'**EDITOR**, je souhaite **éditer un template** (sections + items + champs).
- Critères : page `/admin/visit-templates/[id]/edit` avec UI similaire à ProcedureEditClient ; CRUD sections + items + drag&drop ordering ; champs `pdfLayout`, `expectedFrequencyDays`, `metaSchema` (rendu simplifié).
- Complexité : L — 25 h.
- Dépendances : US-11.1.

**US-11.3** : En tant qu'**EDITOR**, je souhaite **désactiver un template** sans le supprimer.
- Critères : toggle `isActive` sur la liste templates ; les templates inactifs ne sont plus proposés au démarrage de visite mais restent visibles pour les visites passées.
- Complexité : S — 3 h.
- Dépendances : US-11.2.

**Récapitulatif Epic E11** : 3 stories, ~36 heures. **Sprint 5.**

---

### 3.12 Epic E12 — Industrialisation et multi-tenant (post-V3.0)

**Objectif** : préparer le passage à 20+ équipes.

#### Feature E12-F1 — Tests automatisés

**US-12.1** : En tant qu'**équipe dev**, je souhaite **un socle de tests** pour éviter les régressions.
- Critères : Vitest pour unitaires (`auth.ts:teamScope/agentScope/siteScope/actionScope`, `tags.ts`, `pdfFilename.ts`, `auth-edge.ts`, `dedupHash`) ; Playwright pour 3 flows critiques (login + démarrer veille + valider action) ; GitHub Actions sur push.
- Complexité : L — 30 h.
- Dépendances : aucune.
- Réf : MT-08.

#### Feature E12-F2 — Migration Postgres

**US-12.2** : En tant qu'**équipe ops**, je souhaite **passer en Postgres** pour permettre le scaling.
- Critères : provider Postgres dans Prisma ; tests sur env de pré-prod ; script de migration data SQLite → Postgres ; bascule progressive.
- Complexité : L — 25 h.
- Dépendances : US-1.9 (migrations versionnées), US-12.1 (tests).
- Réf : MT-01.

#### Feature E12-F3 — Hiérarchie organisationnelle

**US-12.3** : En tant qu'**ADMIN**, je souhaite **modéliser Établissement → Unité → Équipe**.
- Critères : modèle `Establishment { id, name }`, `Unit { id, establishmentId, name }`, `Team.unitId` ; UI admin pour gestion hiérarchie ; scopes étendus pour `viewAllInUnit` / `viewAllInEstablishment`.
- Complexité : XL — 40 h.
- Dépendances : US-12.2.
- Réf : MT-02.

#### Feature E12-F4 — SSO / OIDC

**US-12.4** : En tant qu'**ADMIN**, je souhaite **brancher l'auth sur Microsoft/Keycloak**.
- Critères : NextAuth ou Auth.js avec provider OIDC ; provisionnement automatique des utilisateurs au premier login (mappage email → équipe via attribut) ; coexistence avec auth locale en transition.
- Complexité : L — 30 h.
- Dépendances : décision config IdP côté client.
- Réf : MT-04.

**Récapitulatif Epic E12** : 4 stories, ~125 heures. **Post-V3.0, après évaluation usage réel.**

---

## 4. Dépendances — carte exécutive

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│  E1 (Stabilisation)                                         │
│   ├─ US-1.9 Migrations Prisma                               │
│   │    └─ US-1.15 Suppression code mort                     │
│   ├─ US-1.5 Photos privées (route streaming)                │
│   │    └─ US-1.6 Validation MIME upload                     │
│   └─ US-1.10 Sentry                                         │
│                                                             │
│  E2 (Mobile-first patterns)                                 │
│   ├─ US-2.1 <BottomSheet>                                   │
│   │    ├─ US-1.14 Menu mobile « ⋯ Plus »                    │
│   │    ├─ US-2.8 Refonte chrome admin                       │
│   │    └─ US-2.9 Drawer filtres                             │
│   ├─ US-2.2 <EntityCard>                                    │
│   │    └─ US-2.3 Swipe-to-action                            │
│   └─ US-2.7 <SiteAutocomplete>                              │
│                                                             │
│  E3 (Aujourd'hui USER + Profil)                             │
│   ├─ US-3.1 Page /today                                     │
│   │    ├─ US-3.2 Carte « En cours »                         │
│   │    ├─ US-3.3 « À traiter aujourd'hui »                  │
│   │    │     └─ DÉPEND : E5-F1 Modèle Échéance              │
│   │    ├─ US-3.4 3 raccourcis natifs                        │
│   │    ├─ US-3.5 3 dernières activités                      │
│   │    └─ US-3.6 Salutation                                 │
│   ├─ US-3.7 Page /me                                        │
│   │    ├─ US-3.8 Changer MDP                                │
│   │    ├─ US-3.9 Toggle viewAllTeams                        │
│   │    │     └─ DÉPEND : PATCH /api/auth/me                 │
│   │    ├─ US-3.10 File offline                              │
│   │    │     └─ DÉPEND : E4-F1                              │
│   │    └─ US-3.11 Préférences                               │
│   └─ US-3.12 Mon contrôle (unifié)                          │
│         └─ US-3.13 Wizard agent d'abord                     │
│                                                             │
│  E4 (Offline réel)                                          │
│   ├─ US-4.1 resilientFetch branché                          │
│   │    ├─ US-4.2 Replay auto online                         │
│   │    │     └─ US-4.3 Toasts queued/synced                 │
│   │    └─ US-4.4 Gestion conflits                           │
│   └─ US-4.5 Photos offline (IndexedDB)                      │
│                                                             │
│  E5 (Hub Échéances) ★ pivot central                         │
│   ├─ US-5.1 Modèle Echeance                                 │
│   │    └─ US-5.2 Agrégateur /api/echeances                  │
│   │         ├─ US-5.3 Écran /echeances                      │
│   │         │     ├─ US-5.4 Filtres (utilise US-2.9)        │
│   │         │     └─ US-5.5 Reporter (utilise E8 AuditLog)  │
│   │         └─ US-5.6 Intégration Aujourd'hui (US-3.3)      │
│   ├─ US-5.7 Habilitations                                   │
│   ├─ US-5.8 Exercices                                       │
│   └─ US-5.9 Documents                                       │
│                                                             │
│  E6 (Dashboard Manager)                                     │
│   ├─ US-6.1 Aujourd'hui MANAGER                             │
│   │    └─ DÉPEND : E5 Hub Échéances                         │
│   │    ├─ US-6.2 Agents à veiller                           │
│   │    └─ US-6.3 Sites sans visite                          │
│   ├─ US-6.4 Page /pilotage                                  │
│   │    ├─ US-6.5 Onglet Activité                            │
│   │    ├─ US-6.6 Onglet Qualité                             │
│   │    ├─ US-6.7 Onglet Risque                              │
│   │    └─ US-6.8 Drill-down                                 │
│   ├─ US-6.9 Vue NC consolidée                               │
│   └─ US-6.10 Export CSV/XLSX généralisé                     │
│                                                             │
│  E7 (Notifications)                                         │
│   ├─ US-7.1 Service email                                   │
│   │    ├─ US-7.2 Récap hebdo                                │
│   │    │     └─ DÉPEND : US-5.2                             │
│   │    └─ US-7.3 Alerte échéance retard                     │
│   └─ US-7.4 Push web                                        │
│        └─ US-7.5 Push quotidienne                           │
│              └─ DÉPEND : US-5.2                             │
│                                                             │
│  E8 (Gouvernance ADMIN)                                     │
│   ├─ US-8.1 AuditLog systématique                           │
│   │    └─ Pré-requis pour US-5.5, US-1.12                   │
│   ├─ US-8.2 Page Archives                                   │
│   ├─ US-8.3 Aujourd'hui ADMIN                               │
│   │    └─ DÉPEND : US-8.1                                   │
│   ├─ US-8.4 Manager d'équipe assignable                     │
│   └─ US-8.5 Création manuelle agent                         │
│                                                             │
│  E9 (Productivité saisie)                                   │
│   ├─ US-9.1 Voix → commentaire           ⛔ ABANDONNÉE      │
│   ├─ US-9.2 <CaptureButton> unifié                          │
│   └─ US-9.3 NC mobile 3 champs                              │
│                                                             │
│  E10 (QR Codes)                                             │
│   ├─ US-10.1 Génération QR site                             │
│   │    └─ US-10.2 Génération QR équipement                  │
│   └─ US-10.3 Scan QR (caméra)                               │
│        └─ US-10.4 Scan QR équipement                        │
│                                                             │
│  E11 (Templates éditables)                                  │
│   └─ US-11.1 Duplication                                    │
│        └─ US-11.2 Édition complète                          │
│             └─ US-11.3 Désactivation                        │
│                                                             │
│  E12 (Industrialisation)                                    │
│   ├─ US-12.1 Tests automatisés                              │
│   │    └─ Pré-requis pour US-12.2                           │
│   ├─ US-12.2 Migration Postgres                             │
│   │    └─ Pré-requis pour US-12.3                           │
│   ├─ US-12.3 Hiérarchie Établissement                       │
│   └─ US-12.4 SSO / OIDC                                     │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 4.1 Chemin critique

Le chemin critique de la V2 est :

```
E1 (Stabilisation) ─→ E2 (Patterns) ─→ E3 (Aujourd'hui USER) ─→ E5 (Hub Échéances) ─→ E6 (Dashboard Manager) ─→ E7 (Notifications)
```

Sans ce chemin, l'app reste un outil de saisie et non un centre de pilotage. Les autres epics (E4 offline, E8 admin, E9 voix, E10 QR, E11 templates) sont parallélisables ou différables.

### 4.2 Dépendances critiques externes

- **US-7.1** : nécessite décision SMTP/Resend + variable env API key.
- **US-7.4** : nécessite génération clés VAPID.
- **US-10.3** : nécessite HTTPS + permission caméra (PWA installée recommandée).
- **US-12.4** : nécessite IdP côté SI client.

---

## 5. Planification sprint par sprint

### Sprint 1 — Stabilisation et confiance (3 semaines, ~55 h)

**Objectif** : corriger les plus gros irritants visibles, lever la dette technique bloquante. Construire la confiance utilisateur.

**Périmètre** :

| Story | Effort | Notes |
|---|---|---|
| US-1.1 CSS fantômes | 1 h | Premier commit, effet visible immédiat |
| US-1.2 Bouton "+ Nouvelle procédure" | 2 h | |
| US-1.3 Bug scope teamId multi-équipes | 4 h | Tests unitaires obligatoires |
| US-1.4 Bouton "Voir le rapport" | 2 h | |
| US-1.9 Migrations Prisma versionnées | 4 h | Baseline + règle CI |
| US-1.10 Sentry + logs structurés | 5 h | Visibilité production |
| US-1.8 Backup quotidien SQLite | 4 h | VACUUM INTO + cron |
| US-1.7 Rate-limit login | 5 h | Compteur mémoire + AuditLog |
| US-1.11 Toaster + ConfirmDialog | 6 h | Remplace 26 alert/confirm |
| US-1.12 Annulation validation 5 min | 6 h | Utilise toaster |
| US-1.5 Photos privées | 12 h | Route streaming + déplacement uploads |
| US-1.6 Validation MIME + taille | 4 h | Sur la même route |

**Total** : 55 h.

**Définition de fait** :
- 12 stories livrées.
- Sentry actif en prod.
- Backup automatisé testé en restauration.
- Tests unitaires sur scope teamId.
- Aucune régression sur les 3 parcours principaux (login, démarrer veille, valider action).

**Livrable** : version 2.0.0-quickwins. Communication : *« Les irritants quotidiens sont corrigés. »*

### Sprint 2 — Première valeur visible (4 semaines, ~75 h)

**Objectif** : poser les patterns mobile-first (composants partagés) + livrer le pivot produit côté USER : écran Aujourd'hui + vocabulaire + statuts pleine largeur.

**Périmètre** :

| Story | Effort | Notes |
|---|---|---|
| US-2.1 `<BottomSheet>` | 10 h | Composant pivot |
| US-1.14 Menu mobile « ⋯ Plus » | 4 h | Utilise BottomSheet |
| US-2.6 Vocabulaire harmonisé | 4 h | Refactor labels |
| US-2.5 Statuts pleine largeur | 6 h | sessions + visites |
| US-2.7 SiteAutocomplete + filtres recherchables | 4 h | UX-13 |
| US-1.13 Reset password par email | 6 h | Resend ou SMTP |
| US-1.15 Suppression code mort | 8 h | Migrations Prisma |
| US-1.16 Tables admin overflow + cards mobile | 12 h | 5 tables |
| US-1.17 Photos en visites | 8 h | Réutilise PhotoControls |
| US-3.1 Page /today + redirect | 4 h | Routing |
| US-3.6 Salutation contextuelle | 2 h | Header |
| US-3.4 3 raccourcis natifs | 4 h | (Astreinte sans modèle pour l'instant : tap sur premier contact d'astreinte ou message si absent) |
| US-3.5 3 dernières activités | 4 h | Lit l'historique |

**Total** : 76 h.

**Définition de fait** :
- Page `/today` USER accessible et utile (cartes En cours / À traiter en placeholder / Raccourcis / Activité).
- BottomSheet généralisé.
- Tables admin utilisables sur tablette portrait.
- 0 `alert/confirm` natif restant.

**Livrable** : version 2.1.0-mobile-first. **Communication** : *« L'application s'ouvre maintenant sur vous, pas sur ses entités. »*

### Sprint 3 — Transformation UX (4 semaines, ~75 h)

**Objectif** : page profil complète + démarrage unifié + voix + offline + audit log.

**Périmètre** :

| Story | Effort | Notes |
|---|---|---|
| US-2.2 `<EntityCard>` | 12 h | Composant fondateur |
| US-2.3 Swipe-to-action | 10 h | Migration progressive 4 listes |
| US-2.4 FAB « + » | 4 h | Sur /visits, /sessions, /agents admin |
| US-2.8 Refonte chrome admin mobile (drawer) | 12 h | Récupère 300 px d'écran |
| US-3.7 Page `/me` (squelette) | 16 h | Identité + chiffres + scope |
| US-3.8 Changer MDP depuis profil | 6 h | |
| US-3.9 Toggle viewAllTeams + PATCH /api/auth/me | 3 h | |
| US-3.11 Préférences (dark mode + signature PDF) | 8 h | Modèle UserPreferences |
| ~~US-9.1 Voix → commentaire~~ | — | ⛔ abandonnée définitivement (PO 2026-06-14) |
| US-9.2 `<CaptureButton>` unifié | 4 h | |
| US-9.3 NC mobile 3 champs | 10 h | Détails en accordéon |
| US-8.1 AuditLog systématique (squelette) | 12 h | Helper + 8 mutations clés (les autres en sprint 4) |

**Total** : 105 h → **excès de 30 h**. Découpe :
- Conserver tout SAUF US-3.11 (-8 h) et US-9.3 (-10 h) → total 87 h. Encore en excès.
- Découper US-8.1 en 2 (squelette 6 h + couverture restante 6 h en sprint 4) → -6 h.
- Reporter US-2.4 FAB en sprint 4 (-4 h).
- Total final : 73 h. **Acceptable.**

**Trade-offs assumés** : US-3.11 (dark mode / signature) et US-9.3 (NC mobile 3 champs) glissent en Sprint 4.

**Définition de fait** :
- Page `/me` utilisable (changement MDP, viewAllTeams toggle).
- Voix sur les textareas commentaire.
- AuditLog actif sur 8 mutations.

**Livrable** : version 2.2.0-profil-voix. **Communication** : *« Mon profil, ma voix, mes archives. »*

### Sprint 4 — Pilotage manager (5 semaines, ~90 h)

**Objectif** : livrer le Hub Échéances + Dashboard Manager + Emails. C'est le pivot business.

**Périmètre** :

| Story | Effort | Notes |
|---|---|---|
| US-5.1 Modèle Echeance (TS + helpers) | 8 h | |
| US-5.2 Agrégateur /api/echeances | 16 h | Actions + visites en retard + équipements |
| US-5.3 Écran /echeances + buckets | 12 h | |
| US-5.6 Intégration Aujourd'hui USER | 4 h | Remplace placeholder de US-3.3 |
| US-5.4 Filtres /echeances (BottomSheet) | 8 h | |
| US-2.9 Drawer filtres /history et /stats | 10 h | |
| US-6.1 Aujourd'hui MANAGER | 20 h | Bannière + progress bars + listes |
| US-6.2 Agents à veiller | 6 h | |
| US-6.3 Sites sans visite | 6 h | |
| US-8.3 Aujourd'hui ADMIN | 20 h | |
| US-8.1 AuditLog : reste des mutations (6 h reportées) | 6 h | |
| US-2.4 FAB (reporté sprint 3) | 4 h | |

**Total** : 120 h → **excès de 30 h**. Découpe :
- US-8.3 Aujourd'hui ADMIN : reporter intégralement en sprint 5 (-20 h).
- Total : 100 h. **Toujours en excès de 10 h.**
- US-6.2 et US-6.3 simplifiées : juste afficher les listes sans tri intelligent dans un premier temps (-6 h).
- Total final : 94 h. **OK avec marge serrée.**

**Trade-offs assumés** : Aujourd'hui ADMIN repoussé Sprint 5. Le manager-pivot reste l'objectif.

**Définition de fait** :
- Hub Échéances V1 fonctionnel (actions + visites en retard + équipements périmés).
- Dashboard Manager visible avec bannière diagnostic + agents à veiller + sites en retard.
- Aujourd'hui USER alimenté par les vraies échéances.
- AuditLog complet.

**Livrable** : version 2.5.0-pilotage. **Communication** : *« Veille devient votre tableau de bord opérationnel quotidien. »* → **Jalon V2.5 atteint.**

### Sprint 5 — Industrialisation et plateformisation (6 semaines, ~110 h)

**Objectif** : notifications (email + push) + page pilotage + NC consolidée + templates éditables + QR codes.

**Périmètre** :

| Story | Effort | Notes |
|---|---|---|
| US-7.1 Service email | 8 h | Resend |
| US-7.2 Récap hebdo manager | 16 h | Cron + template HTML |
| US-7.3 Alerte échéance retard | 8 h | |
| US-7.4 Push web (opt-in) | 16 h | VAPID + SW |
| US-7.5 Push quotidienne | 8 h | |
| US-6.4 Page /pilotage (squelette + 1 onglet) | 15 h | Activité d'abord |
| US-6.9 Vue NC consolidée | 18 h | |
| US-6.10 Export CSV/XLSX | 12 h | |
| US-8.3 Aujourd'hui ADMIN (reporté) | 20 h | |
| US-8.4 Manager d'équipe assignable | 8 h | |
| US-8.5 Création manuelle agent | 8 h | |
| US-11.1 Duplication template | 8 h | |
| US-3.11 Préférences (dark mode + sig) | 8 h | (reporté sprint 3) |

**Total** : 153 h → **excès de 43 h**. Découpe importante :
- Ne livrer QUE 1 onglet de /pilotage (US-6.5 « Activité »), reporter les onglets 2 et 3 (-25 h)... non, US-6.4 inclut déjà juste 1 onglet (15 h).
- US-7.4 et US-7.5 : reporter le push web complet (16+8 h = 24 h) en post-V3.0, garder uniquement email (-24 h).
- Total : 129 h. **Encore en excès.**
- Reporter US-11.1 templates (-8 h) en post-V3.0.
- Total : 121 h. **Encore.**
- Reporter US-3.11 Préférences (-8 h).
- Total : 113 h. **Sprint réduit à ~110 h cible — OK avec marge serrée.**

**Trade-offs assumés** :
- Push web (US-7.4 / US-7.5) reportée en post-V3.0.
- Templates de visite éditables (E11) reportée.
- Préférences avancées (dark mode / signature) reportées.

**Définition de fait** :
- Email récap hebdo envoyé.
- Email alerte retard envoyé.
- Page Pilotage avec 1 onglet (Activité).
- Vue NC consolidée.
- Aujourd'hui ADMIN livré.
- Manager assignable + agent manuel.
- Export CSV/XLSX.

**Livrable** : version 3.0.0. **Communication** : *« Centre de Pilotage Opérationnel. »* → **Jalon V3.0 atteint.**

### Récapitulatif des 5 sprints

| Sprint | Durée | Capacité | Stories | ROI cumulé |
|---|---|---|---|---|
| Sprint 1 | 3 sem | 55 h | 12 | Très élevé (stabilisation, confiance) |
| Sprint 2 | 4 sem | 75 h | 13 | Très élevé (pivot UX visible) |
| Sprint 3 | 4 sem | 75 h | 12 | Élevé (profil + voix + audit) |
| Sprint 4 | 5 sem | 90 h | 11 | Très élevé (pivot pilotage) |
| Sprint 5 | 6 sem | 110 h | 11 | Élevé (industrialisation) |
| **Total** | **22 sem** | **405 h** | **59** | — |

**Calendrier indicatif** :
- Sprint 1 : juin 2026 — fin juin
- Sprint 2 : juillet 2026 — fin juillet
- Sprint 3 : août 2026 — fin août
- Sprint 4 : septembre 2026 — fin septembre
- Sprint 5 : octobre — novembre 2026

**Jalons** :
- **Fin Sprint 2 (~août 2026)** : **MVP V2.0** livré.
- **Fin Sprint 4 (~octobre 2026)** : **V2.5** livré.
- **Fin Sprint 5 (~novembre 2026)** : **V3.0** livré.

---

## 6. Définition des MVP V2.0 / V2.5 / V3.0

### 6.1 MVP V2.0 — « Les irritants corrigés + pivot UX visible »

**Cible** : déployable immédiatement après Sprint 2.

**INCLUS** (fin Sprint 2) :
- Tous les bugs critiques C1-C7 corrigés.
- Sécurité de base : photos privées, validation MIME, rate-limit login, backup, migrations.
- Quick wins UX : toaster, ConfirmDialog, menu mobile « ⋯ Plus », filtres recherchables, bouton « Voir le rapport », annulation validation 5 min.
- Patterns mobile : BottomSheet, statuts pleine largeur, vocabulaire harmonisé.
- **Pivot visible** : écran `/today` USER (basique : carte En cours + 3 raccourcis + 3 activités, sans Hub Échéances encore).
- Reset password par email.
- Tables admin utilisables sur tablette.
- Photos en visites.
- Code mort supprimé.

**EXCLUS** :
- Hub Échéances complet (vient en V2.5).
- Page profil complète (squelette seulement).
- Voix.
- Dashboard manager.
- Notifications.
- QR codes.

**Promesse client** : *« Les frictions quotidiennes sont éliminées. L'application s'ouvre maintenant sur vous, pas sur ses entités. »*

### 6.2 V2.5 — « Pilotage manager + Hub Échéances »

**Cible** : déployable après Sprint 4.

**INCLUS** (cumulatif depuis V2.0) :
- Page profil `/me` complète (identité, MDP, scope, viewAllTeams toggle, sync queue affichée).
- Composants partagés : `<EntityCard>`, swipe, FAB, drawer admin.
- Voix → commentaire dans les textareas.
- Capture photo unifiée.
- NC mobile à 3 champs.
- AuditLog systématique consultable.
- **Hub Échéances V1** : actions importées + visites en retard + équipements périmés + sessions brouillon vieillissantes.
- Écran `/echeances` avec buckets + filtres.
- **Dashboard Manager `/today` MANAGER** avec bannière + agents à veiller + sites en retard.

**EXCLUS** :
- Notifications (email + push).
- Page Pilotage approfondie.
- Vue NC consolidée.
- Exports CSV/XLSX.
- QR codes.
- Templates éditables.
- Aujourd'hui ADMIN.
- Habilitations / Exercices / Documents.

**Promesse client** : *« Vous savez ce qui doit être fait, par qui et quand. »*

### 6.3 V3.0 — « Centre de Pilotage complet »

**Cible** : déployable après Sprint 5.

**INCLUS** (cumulatif depuis V2.5) :
- Service email + récap hebdo + alertes retard.
- Page `/pilotage` avec 1 onglet « Activité » + KPI + diagnostic.
- Vue NC consolidée avec assignation.
- Export CSV/XLSX généralisé.
- Aujourd'hui ADMIN.
- Manager d'équipe assignable.
- Création manuelle d'agent.

**EXCLUS (reportés en V3.x)** :
- Push web (cap. atteinte sprint 5).
- Templates de visite éditables CRUD complet (US-11.1/2/3 → V3.1).
- Préférences avancées (dark mode, signature) → V3.1.
- Onglets Qualité, Risque, Conformité du pilotage → V3.1.
- Drill-down du pilotage → V3.1.
- QR Codes → V3.2.
- Habilitations / Exercices / Documents modélisés → V3.2.
- Industrialisation (E12 : tests, Postgres, hiérarchie, SSO) → V4.0 quand justifié par le scale.

**Promesse client** : *« Veille est devenu votre tableau de bord opérationnel quotidien, multi-équipes, multi-rôles. »*

### 6.4 Post-V3.0 — Backlog différé

À traiter par opportunité ou à la demande :
- E10 QR Codes complet.
- E11 Templates éditables complet.
- E7-F2 Push web.
- US-5.7, US-5.8, US-5.9 nouvelles sources d'échéances (habilitations, exercices, documents).
- US-6.5/6/7/8 onglets Pilotage Qualité / Risque / Conformité + drill-down.
- US-3.11 Préférences (dark mode, signature).
- E12 Industrialisation (tests, Postgres, hiérarchie, SSO) — déclenchée par le scale.
- V-04 IA Vision — exploratoire, R&D.

---

## 7. Dette technique priorisée (issue de AUDIT.md)

### 7.1 À corriger AVANT toute nouvelle fonctionnalité

Ces items sont déjà incorporés dans le Sprint 1 :

| Item | Sprint | Justification |
|---|---|---|
| C1 Photos privées | 1 | Fuite cross-équipe potentielle, bloquant multi-équipes |
| C2 Bug scope teamId | 1 | Casse l'isolation OU bloque les USER multi-équipes |
| C3 Mode offline (décision) | 1 (déc.) → 4 (impl.) | Promesse non tenue, bloquant PWA |
| C4 Migrations Prisma | 1 | Risque de perte de données au déploiement |
| C5 CSS fantômes | 1 | Pages rendues invisibles |
| C6 Bouton procedures/new | 1 | Friction directe sur paramétrage |
| C7 Tables admin coupées | 1 | Bloque admin tablette/mobile |
| M1 Validation MIME upload | 1 | DoS disque trivial |
| M3 Rate-limit login | 1 | Bruteforce SQLite-saturating |
| MT-09 Sentry + logs | 1 | Visibilité 0 sur erreurs prod |
| MT-10 Backup automatisé | 1 | Continuité d'activité |

**Total dette critique** : ~80 h, intégrée dans Sprint 1.

### 7.2 À corriger PROGRESSIVEMENT (peut attendre)

À traiter par opportunité ou en parallèle des epics produit :

| Item | Justification du report | Sprint cible |
|---|---|---|
| M2 Token cookie sans HMAC | Refonte JWT structurante mais pas urgente vu auth scrypt correcte | Sprint 5 ou V3.x |
| M9 N+1 generateInventoryNonConformities | Optimisation utile mais pas bloquante à l'échelle actuelle | Sprint 4 si temps |
| M10 Loop INSERT pointages | Idem, sur fichier de 5k lignes pénible mais pas bloquant | Sprint 4 si temps |
| M22 Pas de tests | Important mais ne bloque pas la livraison de valeur ; à brancher quand le coût des régressions devient sensible | Sprint 5 + post-V3 |
| M24 next/image | Optimisation Lighthouse, pas perçue immédiatement | V3.1 |
| M25 Filtres dates /history overflow | Petit fix CSS | Sprint 2 (5 min, intégré refactor table) |
| m17-m24 Code utilitaires dupliqués | Refactor opportuniste : extraire en passant | Permanent |
| m27 Pagination listes | Devient gênant > 200 items ; à traiter quand observé | V3.x |
| m28 Inconsistance ADMIN vs ADMIN+EDITOR | À normaliser quand on revisite les rôles | Sprint 5 + E12 |
| MT-01 Migration Postgres | Quand on dépasse 50 users concurrents | E12 (post-V3) |
| MT-02 Hiérarchie organisationnelle | Quand on dépasse 20 équipes | E12 (post-V3) |
| MT-04 SSO/OIDC | Quand un client le demande explicitement | E12 (post-V3) |

### 7.3 À NE PAS traiter (volontairement)

| Item | Raison |
|---|---|
| m13 `hover:${palette.ring}` Tailwind dynamique | Effet visuel marginal ; corriger uniquement si l'utilisateur s'en plaint |
| m26 GET /api/procedures et /api/visit-templates | Endpoints orphelins mais inoffensifs ; suppression incluse dans US-1.15 |
| MT-11 Multi-langue | Sur-engineering vs gain pour le périmètre actuel |
| MT-12 Branding par établissement | Cosmétique, à reporter indéfiniment |
| V-06 Mode binôme | Complexité XL pour valeur charme ; abandonner |
| V-09 Plan interactif sites | Complexité L vs liste catégorisée existante ; abandonner |
| V-10 Indicateur qualité saisie | Couvert par dashboard manager ; redondant |
| MT-06 Workflow approbation rapports | Sur-engineering V1 |

---

## 8. Risques et plan de mitigation

### 8.1 Risques de planification

| Risque | Probabilité | Impact | Mitigation |
|---|---|---|---|
| Capacité solo + IA surestimée | Moyenne | Élevé | Buffer 20 % déjà intégré ; option de glisser US-3.11, US-11 en V3.x |
| Bugs critiques production découverts en Sprint 2-3 | Élevée | Moyen | Sentry installé Sprint 1 = détection rapide ; backup garantit la reprise |
| Décision SMTP/IdP repoussée par le client | Élevée | Moyen | E7 démarre seulement Sprint 4 = 4 mois pour décider ; SSO en post-V3 |
| Migration Postgres au mauvais moment | Faible | Élevé | Postgres reporté en E12 post-V3 = quand le besoin est validé |

### 8.2 Risques produit

| Risque | Probabilité | Impact | Mitigation |
|---|---|---|---|
| Refus du vocabulaire harmonisé | Moyenne | Moyen | Communication interne 1 sem avant release ; coexistence anciens labels 2 sem |
| Aujourd'hui USER pas adopté | Faible | Élevé | Maintenir l'accès au catalogue procédures via Mon contrôle (pas de régression) |
| Dashboard manager pas utilisé | Moyenne | Élevé | Embarquer 2-3 managers pilotes en Sprint 4 ; ajuster avant V3 |
| Voix non utilisée (qualité variable) | Élevée | Faible | Fallback texte propre ; pas de friction si la voix ne marche pas |

### 8.3 Risques techniques

| Risque | Probabilité | Impact | Mitigation |
|---|---|---|---|
| syncQueue : conflits offline ↔ online | Élevée | Moyen | Stratégie last-write-wins + UI conflit (US-4.4) |
| Resend / Push : quotas atteints | Moyenne | Faible | Resend free 3k/mois suffit ; option SMTP générique en fallback |
| Browser caméra refuse permission QR | Moyenne | Moyen | Fallback saisie manuelle du code site |
| Webspeech indisponible sur certains devices | Moyenne | Faible | Bouton voix masqué si `!('webkitSpeechRecognition' in window)` |

---

## 9. Métriques de succès par sprint

### Sprint 1 (sortie V2.0-quickwins)
- 0 régression sur les 3 parcours principaux.
- Sentry capte ≥ 1 erreur réelle par semaine (la prod respire).
- Backup restauré avec succès sur env de pré-prod.

### Sprint 2 (sortie V2.0)
- Page `/today` ouvre par défaut.
- Aucun `alert/confirm` natif visible.
- 0 ticket support sur le vocabulaire dans les 30 jours.
- Taux de clics pour démarrer veille : mesurer avant et viser -30 %.

### Sprint 3 (sortie V2.2)
- Page `/me` visitée ≥ 1× / semaine par > 50 % des actifs.
- Taux d'utilisation de la voix : > 10 % des commentaires.
- AuditLog référencé dans au moins 1 incident résolu.

### Sprint 4 (sortie V2.5)
- 100 % des managers ouvrent `/today` MANAGER chaque matin de tournée.
- Hub Échéances : > 80 % des actions traitées dans les délais.
- 0 « j'ai oublié » remonté en rétro.

### Sprint 5 (sortie V3.0)
- Email récap hebdo : taux d'ouverture > 70 %.
- Export CSV utilisé > 10 fois / mois.
- NPS interne > +30.

---

## 10. Récapitulatif global

### 10.1 Vue d'ensemble du plan

```
SPRINT 1 (3 sem)  ─→ V2.0-quickwins ─→ Confiance restaurée
   │ Stabilisation, sécurité, dette critique
   │
SPRINT 2 (4 sem)  ─→ V2.0 ─→ Pivot UX visible
   │ Aujourd'hui USER + patterns mobile
   │
SPRINT 3 (4 sem)  ─→ V2.2 ─→ Profil et voix
   │ Page /me + voix + offline + audit
   │
SPRINT 4 (5 sem)  ─→ V2.5 ─→ Pilotage manager
   │ Hub Échéances + Dashboard Manager
   │
SPRINT 5 (6 sem)  ─→ V3.0 ─→ Centre de pilotage
   │ Notifications + pilotage + exports + admin

TOTAL : 22 semaines (~5,5 mois) — 59 stories — ~405 h de capacité
```

### 10.2 Capacité versus charge par epic

| Epic | Stories | Charge totale | Sprint(s) cible |
|---|---|---|---|
| E1 Stabilisation | 17 | 95 h | 1-2 |
| E2 Mobile-first | 9 | 72 h | 2-3 |
| E3 Aujourd'hui USER + Profil | 13 | 99 h | 2-3 |
| E4 Offline réel | 5 | 68 h | 3-4 (partiel) |
| E5 Hub Échéances | 9 | 92 h | 4 (US-5.1/2/3/4/6) + post-V3 (5.7/8/9) |
| E6 Dashboard Manager | 10 | 127 h | 4-5 (partiel) + post-V3 |
| E7 Notifications | 5 | 56 h | 5 (email) + post-V3 (push) |
| E8 Gouvernance ADMIN | 5 | 64 h | 3-5 |
| E9 Productivité saisie | 3 | 22 h | 3 |
| E10 QR Codes | 4 | 46 h | post-V3 |
| E11 Templates éditables | 3 | 36 h | post-V3 |
| E12 Industrialisation | 4 | 125 h | post-V3 (déclenché par scale) |
| **Total V2.0 → V3.0** | **59** | **~700 h** théoriques | **5 sprints livrent ~405 h** |

Conclusion : sur les 700 h théoriques, **les 5 sprints livrent ~405 h, soit ~58 % du backlog**. Le reste (E10 QR / E11 Templates / E12 Industrialisation / parties E4 / E7-push) est consciemment reporté en post-V3.0.

C'est cohérent avec un développement solo + IA sur 5-6 mois. Les éléments différés correspondent à des projets qui peuvent attendre une demande métier explicite ou un dépassement de seuil d'usage (50 équipes pour Postgres, etc.).

### 10.3 Conditions de réussite

1. **Tenir le focus** : ne pas dériver vers les features V3+ tant que V2.5 n'est pas livrée.
2. **Mesurer dès Sprint 1** : Sentry + analytics minimum + 5 entretiens utilisateurs par sprint.
3. **Communiquer chaque release** : changelog visible + vidéo 2 min « ce qui change pour vous ».
4. **Embarquer 2 managers pilotes** dès Sprint 4 pour valider le Dashboard Manager.
5. **Refuser le sur-engineering** : V2 ne vise PAS 500 équipes. Elle vise 5-20 équipes pilotes solides.
6. **Garder la marge** : si Sprint 4 dérive, supprimer US-8.3 (Aujourd'hui ADMIN), pas le Hub Échéances.

---

## 11. Lectures complémentaires

- [AUDIT.md](AUDIT.md) — Audit technique : Critiques C1-C7, Majeurs M1-M25, Mineurs m1-m30, matrices CRUD / permissions / routes / champs.
- [AUDIT-PRODUIT.md](AUDIT-PRODUIT.md) — Audit produit : verdict par rôle, module par module (15 modules), UX mobile (28 écrans), Top 20 UX / 20 métier / 10 valeur / 10 supprimer.
- [VISION-V2.md](VISION-V2.md) — Vision V2 : pivot Centre de Pilotage Opérationnel, nouvelle architecture, maquettes textuelles, Hub Échéances, mobile-first, QR codes, roadmap 5 phases.
- Ce document est le **plan d'exécution** qui traduit la vision en backlog priorisé prêt à dérouler.
