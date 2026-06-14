# Audit produit — Application Veille

> **Périmètre** : C:\Users\PC\Desktop\Veille\veille-app\
> **Date** : 2026-06-13
> **Posture** : responsable d'adoption multi-équipes terrain. Objectif : maximiser **utilité, simplicité, taux d'utilisation**.
> **Sources** : simulation des 3 rôles (ADMIN, EDITOR, USER terrain), parcours métier détaillés, analyse module par module (15 modules), audit UX mobile écran par écran (28 écrans).
> **Complément** : ce document est la phase produit. Pour les blocants techniques, voir [AUDIT.md](AUDIT.md).

---

## 0. Synthèse exécutive

L'application a **un cœur métier fonctionnel et soigné** (parcours veille USER : 6 clics pour démarrer, ouverture auto du commentaire sur NC, compression photo intégrée, sparkline de fraîcheur d'agent, cascade dedupHash). Elle a aussi une **vraie ambition documentaire** (PDF SNCF fidèle au document d'origine, layout VEILLE moderne, séparation INVENTORY/CHECKLIST).

Trois constats produits font qu'elle n'est pas encore une application terrain industrialisée :

1. **L'app pense ses fonctions par entité technique, pas par moment de la journée d'un utilisateur.** Un agent qui arrive le matin n'a pas d'écran « Aujourd'hui » : ses sessions en cours, ses actions à valider, ses contacts d'astreinte sont dispersés dans 4 onglets, dont 3 (Sessions, Contacts, Stats) sont absents du menu mobile. Un manager n'a pas de tableau de bord opérationnel : pour préparer sa tournée il consulte 3 écrans et reconstruit mentalement. Un admin n'a pas de page profil utilisateur. La conséquence est un taux d'utilisation qui dépend du goodwill de chaque utilisateur — l'app ne le tire pas vers l'usage.

2. **Le ratio "code mort vs code utilisable" est anormalement élevé côté EDITOR/ADMIN.** Le rôle `MANAGER` d'équipe existe en schéma mais n'a aucune UI. L'historique des observations (`ObservationHistory`) est écrit fidèlement mais jamais lu. L'`AuditLog` n'est alimenté que pour le login. L'annulation d'une validation est protégée côté API, jamais exposée côté UI. Les templates de visite sont « édition ultérieure ». Quatre modèles (Mnemonique, Abreviation, Comment, Report) sont entièrement orphelins. Le bouton « + Nouvelle procédure » mène à un 404. Tout cela donne l'impression d'un produit en cours d'industrialisation où plusieurs zones ont été codées sans être branchées.

3. **L'expérience mobile n'est pas pensée terrain malgré la promesse PWA.** Sur iPhone SE, 120 px de chrome (top-bar + bottom-nav) consomment 20 % de l'écran. Les boutons critiques sont à `text-[10px]` (24 px de cible touch, inutilisable en gants). Les actions destructives (archiver, supprimer) sont collées aux boutons d'ouverture. Les tables admin (7 à 9 colonnes) sont coupées sans scroll. Le mode INVENTORY est exemplaire (terrain-first), mais le mode CHECKLIST de visite (cœur du métier) est dense, illisible au soleil, et le récap NC avec 7 champs en ligne est inutilisable au pouce.

**Verdict d'usabilité par rôle :**
- **USER terrain** : 6,5 / 10. Cœur de saisie solide, mais friction quotidienne sur la nav mobile (Contacts, Sessions inaccessibles), pas d'annulation des erreurs, pas de photos en visite.
- **EDITOR manager** : 5 / 10. Promesse d'un back-office, dead-ends fréquents (procedures/new 404, users/agents avec 403 silencieux, aucun dashboard opérationnel).
- **ADMIN** : 6 / 10. Outils CRUD basiques OK, mais pas d'audit log, pas de templates visite, reset password en clair, pas de paramètres globaux.

**Score moyen produit** : 2,9 / 5. Les modules opérationnels USER tournent autour de 3,5+, les modules transverses/admin sous 3.

**Levier principal** : l'app fait 80 % du travail technique sur la saisie. Les 20 % restants (consolidation, vues croisées, push, export, parcours par moment) feront le saut **fonctionnel → indispensable** pour les utilisateurs réels.

---

## 1. Verdict par rôle (compact)

### USER terrain (6,5 / 10)
- **Forces** : multi-procédures sélectionnables, ouverture auto du commentaire en NC, compression photo, sparkline fraîcheur, mode INVENTORY terrain-first.
- **Frictions** : pas de page d'accueil "Aujourd'hui", `/sessions` `/contacts` `/stats` `/liens` absents du menu mobile, pas de photos en visites, pas d'annulation de validation, 5 statuts session (trop), boutons destructifs trop accessibles.
- **5 douleurs prioritaires** :
  1. Impossible d'annuler une validation accidentelle (l'API existe).
  2. Pas de "Mon journée" mobile — reprendre une veille de la veille = 4+ clics.
  3. Pas de photos en visites — alors que les NC de site sont les preuves visuelles les plus utiles.
  4. Double bouton "Vu" vs "Commentaire" → confusion (2 modales presque identiques).
  5. `/contacts` absent du menu mobile → impossible d'appeler une astreinte rapidement.

### EDITOR manager (5 / 10)
- **Forces** : imports Excel/CSV solides, gestion équipes / sites OK, création procédure prévue.
- **Frictions** : `/admin/procedures/new` 404, voit Users/Teams/Agents avec 403 sur tous les boutons, aucun tableau de bord opérationnel, NC ouvertes invisibles, visites en retard non calculées, manager d'équipe non assignable.
- **5 douleurs prioritaires** :
  1. Bouton « + Nouvelle procédure » → 404.
  2. Pas de dashboard « Ma tournée » — il reconstitue mentalement à partir de 3 écrans.
  3. Voit des actions interdites (rôles changeables → 403 silencieux).
  4. Pas d'écran « NC ouvertes » ni « Visites en retard ».
  5. Impossible de désigner un MANAGER d'équipe (rôle existe au schéma).

### ADMIN (6 / 10)
- **Forces** : modale édition user récente fonctionnelle, désactivation user efficace, équipes CRUD complet.
- **Frictions** : audit log inerte, templates visite read-only, reset password forcé en clair, archives non restaurables, pas de référentiel postes/secteurs.
- **5 douleurs prioritaires** :
  1. Pas d'écran d'audit — modèle existe, jamais visualisé.
  2. Templates visite non éditables — « version ultérieure » sans suite.
  3. Reset password en clair dans la modale.
  4. Postes / Secteurs / Mnémoniques / Abréviations sans UI.
  5. Pas de vue « archives » pour restaurer une session archivée par erreur.

---

## 2. Top 20 améliorations UX (les plus rentables)

Chaque amélioration : **description / problème résolu / impact utilisateur (★/5) / impact métier (★/5) / complexité (S/M/L/XL) / ROI (Très élevé/Élevé/Moyen) / priorité (P0/P1/P2)**.

### UX-01. Page d'accueil mobile « Aujourd'hui »
- Description : remplacer la redirection systématique `/` → `/procedures` par un dashboard contextuel mobile : sessions/visites en cours, actions à valider, contacts d'astreinte, raccourci « Démarrer une veille » et « Nouvelle visite ».
- Problème résolu : l'agent reprend sa veille de la veille en 1 clic au lieu de 4 ; les contacts d'astreinte deviennent atteignables.
- Impact utilisateur : ★★★★★ · Impact métier : ★★★★ · Complexité : M · ROI : Très élevé · **P0**.

### UX-02. Menu mobile à 6 entrées (ou drawer « Plus »)
- Description : remplacer une entrée moins prioritaire (« Histo. » par exemple) par un bouton « ⋯ Plus » qui ouvre un bottom-sheet avec Sessions, Stats, Liens, Contacts, Historique.
- Problème résolu : 4 fonctions critiques (dont Contacts en astreinte) deviennent atteignables sur smartphone.
- Impact utilisateur : ★★★★★ · Impact métier : ★★★★ · Complexité : S · ROI : Très élevé · **P0**.

### UX-03. Bottom-sheet pour toutes les modales mobiles
- Description : généraliser le pattern déjà appliqué dans `ManualActionModal` (`AgentActionsClient.tsx:502`) à toutes les modales : édition user, NoteModal, TeamPicker, EditSiteModal, ConfirmDialog. `inset-x-0 bottom-0 md:bottom-auto md:top-1/2`.
- Problème résolu : les modales centrées sont masquées par le clavier mobile ; les boutons « Annuler / Confirmer » sortent de l'écran.
- Impact utilisateur : ★★★★★ · Impact métier : ★★★ · Complexité : M · ROI : Très élevé · **P0**.

### UX-04. Composant `<EntityCard>` unique pour les listes
- Description : remplacer les 7 implémentations de carte (Visits, Sessions, Agents, Sites, History, Contacts, Links) par un seul composant avec slots `leadingMedia / title / subtitle / badges / trailingActions / swipeActions`.
- Problème résolu : cohérence visuelle, suppression des cibles 18-22 px disséminées, swipe-actions homogènes.
- Impact utilisateur : ★★★★ · Impact métier : ★★ · Complexité : L · ROI : Élevé · **P1**.

### UX-05. Swipe-to-archive et swipe-to-delete sur les listes
- Description : supprimer les boutons Archiver / Trash 18-22 px en bord de carte. Introduire un swipe latéral pour révéler les actions.
- Problème résolu : l'agent ne clique plus accidentellement « Supprimer » au lieu d'ouvrir une visite. Cibles touch retrouvent leur taille naturelle.
- Impact utilisateur : ★★★★ · Impact métier : ★★★ · Complexité : M · ROI : Élevé · **P1**.

### UX-06. Bouton flottant FAB « + » sur les listes
- Description : sur `/visits`, `/sessions`, `/agents` (admin) etc., remplacer le CTA dans le header par un bouton flottant en bas à droite (`bottom-[88px] right-4`).
- Problème résolu : l'agent peut créer une nouvelle visite sans scroller vers le haut. Le pouce reste en zone de confort.
- Impact utilisateur : ★★★★ · Impact métier : ★★ · Complexité : S · ROI : Élevé · **P1**.

### UX-07. Statuts à boutons pleine largeur
- Description : dans `SessionClient` et `VisitClient`, passer de `flex gap-1.5 flex-wrap` (3-5 boutons collés en `text-[11px]`) à `grid grid-cols-3 gap-2 min-h-12` → cible 48 px conforme HIG.
- Problème résolu : statut sélectionnable au pouce / en gants ; erreur de tap drastiquement réduite.
- Impact utilisateur : ★★★★★ · Impact métier : ★★★★ · Complexité : S · ROI : Très élevé · **P0**.

### UX-08. Drawer / Filters sheet pour `/history` et `/stats`
- Description : remplacer les 8-10 contrôles empilés en haut par un bouton « Filtres » qui ouvre un bottom-sheet plein écran.
- Problème résolu : `/history` et `/stats` deviennent utilisables sur mobile ; filtres complexes restent puissants sur desktop.
- Impact utilisateur : ★★★★ · Impact métier : ★★★ · Complexité : M · ROI : Élevé · **P1**.

### UX-09. Refonte des tables admin → cards empilées + scroll horizontal
- Description : remplacer `overflow-hidden` par `overflow-x-auto`. Ajouter un pattern de transformation en cards empilées sur mobile (`<tr className="block md:table-row">`).
- Problème résolu : un manager EDITOR peut administrer son équipe depuis sa tablette.
- Impact utilisateur : ★★★★ · Impact métier : ★★★★ · Complexité : M · ROI : Élevé · **P0**.

### UX-10. Toaster unifié + composant `<ConfirmDialog>`
- Description : adopter `sonner` (légère). Remplacer les 26 `alert/confirm` natifs par un toaster + composant bottom-sheet de confirmation.
- Problème résolu : feedback uniforme et lisible, pas de blocage du JS, texte de mise en garde visible.
- Impact utilisateur : ★★★★ · Impact métier : ★★ · Complexité : S · ROI : Très élevé · **P0**.

### UX-11. Refonte chrome admin mobile (drawer hamburger)
- Description : remplacer `flex flex-col lg:flex-row` qui pose la sidebar admin en grille 2-colonnes (300 px de chrome) par : top-bar admin compact + drawer hamburger.
- Problème résolu : +300 px de contenu utile sur tous les écrans admin (qui sont déjà chargés).
- Impact utilisateur : ★★★★ · Impact métier : ★★★ · Complexité : M · ROI : Élevé · **P1**.

### UX-12. Fusion « Vu » + « Commentaire » en un seul bouton
- Description : remplacer les 2 boutons par un seul « Interaction » qui ouvre une modale avec commentaire optionnel + photos optionnelles. Le kind (SIGHT / NOTE) est dérivé serveur.
- Problème résolu : confusion entre 2 modales presque identiques.
- Impact utilisateur : ★★★★ · Impact métier : ★★ · Complexité : S · ROI : Élevé · **P1**.

### UX-13. Filtres recherchables au lieu de `<select>` natifs
- Description : utiliser `AgentAutocomplete` (déjà existant, utilisé dans Session) dans `/history`, `/stats`, et créer un `<SiteAutocomplete>` sur le même patron.
- Problème résolu : filtres `/history` et `/stats` inutilisables au-delà de 30 entrées deviennent utiles.
- Impact utilisateur : ★★★★ · Impact métier : ★★★★ · Complexité : S · ROI : Très élevé · **P0**.

### UX-14. CTA flottant « Clôturer la session » mieux placé
- Description : actuellement `lg:hidden fixed bottom-[76px]` — chevauche le clavier iOS. Repositionner conditionnellement (au-dessus du clavier visible).
- Problème résolu : clôture impossible quand un commentaire est en cours de saisie.
- Impact utilisateur : ★★★ · Impact métier : ★★ · Complexité : S · ROI : Élevé · **P1**.

### UX-15. Vocabulaire harmonisé (Catalogue / Veille / Visite / Inventaire)
- Description : décider du nom canonique de chaque concept. Proposition : `/procedures` → **Catalogue**, `/sessions` → **Mes veilles**, `/visits` mode CHECKLIST → **Visite**, `/visits` mode INVENTORY → **Inventaire**. Aligner les libellés UI, les filtres (« Observateur » partout, plus « Créateur »).
- Problème résolu : un nouvel utilisateur ne sait plus si « Veille » = catalogue ou activité en cours. Confusion lexicale documentée.
- Impact utilisateur : ★★★ · Impact métier : ★★ · Complexité : S · ROI : Élevé · **P1**.

### UX-16. « Refaire identique » sur une visite passée
- Description : sur `/visits` ou `/sites/[id]`, bouton « Refaire la même visite » qui pré-remplit modèle + site + participants.
- Problème résolu : aujourd'hui l'agent passe par les 3 étapes du wizard même quand 80 % du temps c'est la même visite qu'hier.
- Impact utilisateur : ★★★★ · Impact métier : ★★ · Complexité : S · ROI : Élevé · **P1**.

### UX-17. Annulation validation avec fenêtre de 5 minutes
- Description : sur la fiche agent, dans l'historique des validations, icône poubelle pendant 5 min après création. Au-delà, demande de justification EDITOR.
- Problème résolu : l'erreur de double-tap aujourd'hui irrécupérable côté UI (API existe).
- Impact utilisateur : ★★★★ · Impact métier : ★★ · Complexité : S · ROI : Très élevé · **P0**.

### UX-18. Statuts simplifiés à 3 + menu « Autres »
- Description : dans `SessionClient`, exposer 3 statuts (Conforme / Non Conforme / N/A) en grands boutons pleine largeur ; AR (« À revoir ») et ? (« Non observé ») en menu « ⋯ Autres ».
- Problème résolu : 5 statuts en 2 colonnes serrées sur mobile = mauvais ratio tactile. La majorité des saisies utilisent les 3 principaux.
- Impact utilisateur : ★★★★ · Impact métier : ★★ · Complexité : S · ROI : Élevé · **P1**.

### UX-19. Bouton « Voir le rapport » dans les listes
- Description : sur `SessionsListClient` et `VisitsListClient`, lorsque le statut est `completed`, ajouter un bouton qui ouvre `/sessions/[id]/report` ou `/visits/[id]/report`.
- Problème résolu : les rapports déjà finalisés ne sont rouvrables qu'en saisissant l'URL.
- Impact utilisateur : ★★★★ · Impact métier : ★★★ · Complexité : S · ROI : Très élevé · **P0**.

### UX-20. Réduction des champs NC saisis sur le terrain
- Description : sur `VisitClient`, le tableau NC propose 7 champs en ligne (description, risque, EVRp, mesures, responsable, planifié, redressé). Sur mobile, réduire à 3 (description, responsable, échéance). Les autres champs en mode édition desktop ou en accordéon « Détails ».
- Problème résolu : le récap NC mobile est inutilisable au pouce ; ralentit la saisie terrain.
- Impact utilisateur : ★★★★ · Impact métier : ★★★ · Complexité : M · ROI : Élevé · **P1**.

---

## 3. Top 20 améliorations métier (les plus utiles)

### M-01. Dashboard EDITOR « Ma tournée »
- Description : page `/admin` (pour EDITOR) ou `/me/dashboard` (pour USER) avec : agents avec actions en retard, sites sans visite depuis > N jours, NC ouvertes par responsable, sessions/visites brouillon. Tout cliquable pour démarrer la suite.
- Problème résolu : aujourd'hui le manager reconstitue mentalement à partir de 3 écrans.
- Impact utilisateur : ★★★★ · Impact métier : ★★★★★ · Complexité : L · ROI : Très élevé · **P0**.

### M-02. Page profil utilisateur `/me`
- Description : page unique avec profil (nom, email, MDP), préférences (toggle viewAllTeams, masquage agents, dark mode, signature PDF), file de mutations offline (avec bouton « Forcer la sync »), mes stats personnelles, historique de mes actions.
- Problème résolu : aucun lieu unique pour ses préférences. Inexistant aujourd'hui.
- Impact utilisateur : ★★★★ · Impact métier : ★★★ · Complexité : M · ROI : Très élevé · **P0**.

### M-03. Page d'audit consultable `/admin/audit`
- Description : table filtrable par user / action / entité / date, avec rétention configurable (1 an minimum).
- Problème résolu : « qui a fait quoi quand » sans accès direct à la BDD. Conformité auditeur.
- Impact utilisateur : ★★ · Impact métier : ★★★★★ · Complexité : M · ROI : Élevé · **P1**.

### M-04. CRUD complet des templates de visite
- Description : créer / éditer / dupliquer / désactiver un template (sections, items, layout PDF, périodicité, metaSchema). Permet aux EDITOR métier d'évoluer le référentiel sans intervention dev.
- Problème résolu : « édition ultérieure » assumée. Toute évolution exige actuellement une intervention DB.
- Impact utilisateur : ★★★ · Impact métier : ★★★★★ · Complexité : L · ROI : Élevé · **P1**.

### M-05. Vue NC ouvertes consolidée par périmètre
- Description : page `/admin/non-conformities` ou onglet dans `/visits`. Filtres : responsable, échéance, site, statut (à traiter / en cours / redressée / clôturée).
- Problème résolu : pour suivre ses NC, l'EDITOR doit ouvrir chaque visite une à une.
- Impact utilisateur : ★★★★ · Impact métier : ★★★★★ · Complexité : M · ROI : Très élevé · **P0**.

### M-06. Visites en retard calculées (expectedFrequencyDays)
- Description : exploiter `SiteVisitTemplate.expectedFrequencyDays` (champ existant jamais utilisé) pour générer une page « Sites avec visite en retard ». Cron quotidien + badge dashboard.
- Problème résolu : impossible aujourd'hui de savoir qu'un site n'a pas eu sa Trimestrielle depuis 4 mois.
- Impact utilisateur : ★★★★ · Impact métier : ★★★★★ · Complexité : M · ROI : Très élevé · **P0**.

### M-07. Galerie photo centralisée `/photos`
- Description : route avec filtres (agent / site / période / observation / type d'événement), lightbox, légendes éditables, suppression.
- Problème résolu : aujourd'hui les photos sont disséminées entre observations, sightings, photos de site, sans vue d'ensemble.
- Impact utilisateur : ★★★★ · Impact métier : ★★★ · Complexité : M · ROI : Élevé · **P1**.

### M-08. Photos sur les visites (CHECKLIST + INVENTORY)
- Description : réutiliser `PhotoControls` de `SessionClient` dans `VisitClient` et `VisitInventoryClient`. Une NC sans photo n'a quasi pas de valeur de preuve.
- Problème résolu : régression UX entre 2 surfaces équivalentes (sessions ont les photos, visites non).
- Impact utilisateur : ★★★★★ · Impact métier : ★★★★ · Complexité : S · ROI : Très élevé · **P0**.

### M-09. Annulation/édition validation accessible UI (cf. UX-17)
- Description : voir UX-17. Côté métier : trace l'annulation dans AuditLog + commentaire requis si > 5 min.
- Problème résolu : erreurs aujourd'hui irrécupérables sans contact admin.
- Impact utilisateur : ★★★★ · Impact métier : ★★★★ · Complexité : S · ROI : Très élevé · **P0**.

### M-10. Page archives + restauration
- Description : sur `/sessions`, `/visits`, `/admin/sites`, `/admin/agents`, ajouter un toggle « Afficher les archivées » + bouton « Restaurer » par item.
- Problème résolu : aujourd'hui, archiver est irréversible côté UI.
- Impact utilisateur : ★★★ · Impact métier : ★★★ · Complexité : S · ROI : Élevé · **P1**.

### M-11. Alertes péremption équipements
- Description : cron quotidien qui notifie les chefs de site quand `SiteEquipment.expirationDate < today + 30j`. Centre de notifications in-app + email.
- Problème résolu : aucune alerte aujourd'hui ; un extincteur périmé reste invisible jusqu'à la prochaine inspection.
- Impact utilisateur : ★★★ · Impact métier : ★★★★★ · Complexité : M · ROI : Très élevé · **P1**.

### M-12. Champ « lieu » sur les sessions de veille
- Description : ajouter un champ optionnel `siteId` à `VeilleSession`. La veille se passe quelque part — gare X, poste Y. Permet drill-down et stats par site.
- Problème résolu : aucun lien session ↔ lieu aujourd'hui (poste/secteur chargés mais jamais affichés).
- Impact utilisateur : ★★★ · Impact métier : ★★★★ · Complexité : M · ROI : Élevé · **P1**.

### M-13. Signature manuscrite participant visite
- Description : `SiteVisitParticipant.signature` existe au schéma. Capturer en canvas à la clôture, intégrer dans le PDF.
- Problème résolu : signature absente du rapport — limite la valeur juridique du document.
- Impact utilisateur : ★★ · Impact métier : ★★★★ · Complexité : M · ROI : Élevé · **P1**.

### M-14. Export CSV / Excel pour toutes les entités
- Description : boutons d'export sur `/admin/users`, `/admin/agents`, `/admin/sites`, `/admin/imports` (historique), `/history`, `/stats`. Format CSV minimum, XLSX optimal.
- Problème résolu : les chefs ne peuvent rien remonter à leur N+1 en dehors des PDF.
- Impact utilisateur : ★★★ · Impact métier : ★★★★★ · Complexité : M · ROI : Élevé · **P1**.

### M-15. Manager d'équipe assignable
- Description : exposer `UserTeam.role` (MEMBER / MANAGER) dans `/admin/teams/[id]`. Radio à côté de chaque membre.
- Problème résolu : rôle existe au schéma, jamais exposé. Empêche la délégation.
- Impact utilisateur : ★★ · Impact métier : ★★★★ · Complexité : S · ROI : Élevé · **P1**.

### M-16. Création manuelle d'agent (hors import)
- Description : modale « + Nouvel agent » dans `/admin/agents` + extension PATCH pour matricule, nom, prénom, poste, secteur.
- Problème résolu : impossible d'ajouter un agent ponctuel (nouveau venu, prestataire) sans rejouer un import Excel complet.
- Impact utilisateur : ★★★ · Impact métier : ★★★ · Complexité : S · ROI : Élevé · **P1**.

### M-17. Site avec type structuré et contacts liés
- Description : `Site.type` aujourd'hui texte libre. Le passer à une liste contrôlée (Poste d'aiguillage, Gare, Dépôt, Local technique, ...). Ajouter `Site.contactIds[]` lien vers Contact.
- Problème résolu : pas filtrable aujourd'hui. Pas de « qui appeler sur ce site ».
- Impact utilisateur : ★★★ · Impact métier : ★★★ · Complexité : M · ROI : Élevé · **P2**.

### M-18. Drill-down dans les statistiques
- Description : cliquer « Top créateur Bardella » ouvre la liste de ses interventions. Cliquer un sous-segment du donut ouvre la liste filtrée.
- Problème résolu : aujourd'hui les graphes sont contemplatifs, non actionnables.
- Impact utilisateur : ★★★ · Impact métier : ★★★★ · Complexité : M · ROI : Élevé · **P1**.

### M-19. Rapport hebdomadaire emailé « mon équipe en chiffres »
- Description : cron lundi matin → email aux EDITOR avec récap semaine passée + objectifs semaine en cours.
- Problème résolu : la donnée existe (stats), il manque la diffusion. Crée une habitude de consultation.
- Impact utilisateur : ★★ · Impact métier : ★★★★★ · Complexité : M · ROI : Très élevé · **P1**.

### M-20. Reset password par lien email (au lieu de saisie en clair)
- Description : bouton « Envoyer lien de réinitialisation » à la place du champ MDP en clair. Token court (1h) signé.
- Problème résolu : reset actuel exige communication hors-app, l'admin tape un MDP en clair.
- Impact utilisateur : ★★★ · Impact métier : ★★★ · Complexité : S · ROI : Élevé · **P1**.

---

## 4. Top 10 fonctionnalités à très forte valeur ajoutée

### V-01. QR code site → veille préchargée
- Description : QR code apposé physiquement sur la porte du poste / gare. Scan → ouverture `/sites/[id]/veille-rapide` avec procédures suggérées + lieu + observateur préchargés. Zéro clic avant d'observer.
- Problème résolu : élimine la recherche du site + la sélection des procédures. Garantit l'identification du site.
- Impact utilisateur : ★★★★★ · Impact métier : ★★★★ · Complexité : M · ROI : Très élevé · **P1**.

### ~~V-02. Reconnaissance vocale → commentaire~~ — ⛔ ABANDONNÉE DÉFINITIVEMENT (PO 2026-06-14)

> Toute fonctionnalité audio / dictée / vocale est abandonnée définitivement. Voir [memory/business-rules.md](memory/business-rules.md) §Audio. Section conservée à titre historique.

~~- Description : Web Speech API (natif sur navigateurs modernes) sur les textareas de commentaire. Parler plutôt que taper sur gants.~~
~~- Problème résolu : sur le terrain (mains occupées, gants, froid), la saisie clavier est lente et imprécise.~~
~~- Impact utilisateur : ★★★★★ · Impact métier : ★★★ · Complexité : S · ROI : Très élevé · **P1**.~~

### V-03. Annotation photo (cercle / flèche / texte)
- Description : après prise photo, ouvrir un éditeur léger pour pointer le défaut. Sauvegarde avec calque.
- Problème résolu : une photo brute d'un local de graissage ne montre pas où regarder ; l'annotation rend la NC explicite.
- Impact utilisateur : ★★★★ · Impact métier : ★★★★ · Complexité : L · ROI : Élevé · **P2**.

### V-04. Détection équipement par photo (LLM vision)
- Description : prise photo d'un extincteur → reconnaissance type + date péremption (OCR du libellé) → préfill de l'observation INVENTORY.
- Problème résolu : la saisie inventaire devient quasi-automatique. Impact ÉNORME sur la fréquence des inventaires.
- Impact utilisateur : ★★★★ · Impact métier : ★★★★★ · Complexité : L · ROI : Très élevé · **P2**.

### V-05. Comparaison « Δ depuis la dernière visite »
- Description : sur chaque ligne d'inventaire, badge « -2 cartouches depuis 2026-03-04 » ou « ✓ inchangé ». Bandeau « Rien n'a changé en 30 jours, êtes-vous sûr ? ».
- Problème résolu : la visite INVENTORY est aujourd'hui un état figé sans mémoire.
- Impact utilisateur : ★★★ · Impact métier : ★★★★ · Complexité : M · ROI : Élevé · **P2**.

### V-06. Mode binôme — saisie simultanée
- Description : sur une même visite, deux utilisateurs peuvent saisir en parallèle. Sync temps réel (WebSocket).
- Problème résolu : reflète la réalité terrain (les visites se font souvent à 2). Aujourd'hui l'app force un seul saisisseur.
- Impact utilisateur : ★★★★ · Impact métier : ★★★★ · Complexité : XL · ROI : Élevé · **P3**.

### V-07. Notifications push (PWA)
- Description : centre de notifications in-app + push web (PWA installée). Cas : action arrivée à échéance, NC ouverte > 30j, visite en retard, équipement périmé.
- Problème résolu : l'app est aujourd'hui 100 % pull. L'utilisateur doit y aller. Avec push, l'app vient à lui.
- Impact utilisateur : ★★★★ · Impact métier : ★★★★★ · Complexité : L · ROI : Très élevé · **P1**.

### V-08. Plan d'action automatique post-visite (email)
- Description : à la clôture d'une visite avec NC, agréger les NC par responsable et envoyer un email de plan d'action.
- Problème résolu : élimine le travail manuel post-visite (resaisie dans un autre outil, mail Excel).
- Impact utilisateur : ★★★ · Impact métier : ★★★★★ · Complexité : M · ROI : Très élevé · **P1**.

### V-09. Plan interactif des sites avec localisation des équipements
- Description : upload du plan du site, drag&drop des SiteEquipment dessus. Parcours guidé pendant la visite.
- Problème résolu : réduit les oublis (un extincteur oublié au sous-sol). Optimise le parcours physique.
- Impact utilisateur : ★★★★ · Impact métier : ★★★★ · Complexité : L · ROI : Élevé · **P3**.

### V-10. Indicateur qualité de saisie + auto-évaluation
- Description : indicateur « Saisie complète à 92 % » basé sur ratio commentaires/photos vs items NON_CONFORME. Feedback formateur à l'observateur.
- Problème résolu : pas de retour qualitatif aujourd'hui ; l'observateur ne sait pas s'il « saisit bien ».
- Impact utilisateur : ★★★ · Impact métier : ★★★★ · Complexité : M · ROI : Élevé · **P2**.

---

## 5. Top 10 fonctionnalités à supprimer ou simplifier

### S-01. Fusionner « Vu » + « Commentaire » + « Validation » en un seul flux « Interaction agent »
- Description : trois entités distinctes (`ActionValidation`, `AgentSighting kind=SIGHT`, `AgentSighting kind=NOTE`) qui sont en réalité 1-2 concepts métier. Unifier sous une notion « Interaction » avec type / intensité.
- Problème résolu : l'historique devient lisible ; les boutons d'action sur fiche agent se réduisent ; le code unifié est plus simple à maintenir.
- Impact utilisateur : ★★★★ · Impact métier : ★★★ · Complexité : L · ROI : Élevé · **P2**.

### S-02. Fusionner liste publique et liste admin (toggle « Mode admin »)
- Description : `/agents` + `/admin/agents` = 1 page avec toggle. Idem `/sites` + `/admin/sites`, `/contacts` + `/admin/contacts`, `/links` + `/admin/links`.
- Problème résolu : 4 paires de pages, 80 % du code dupliqué. Cohérence visuelle.
- Impact utilisateur : ★★★ · Impact métier : ★★ · Complexité : L · ROI : Élevé · **P2**.

### S-03. Supprimer le « Dashboard admin » actuel
- Description : `/admin/page.tsx` n'apporte aucune valeur métier (compteurs globaux + imports). Soit le supprimer et rediriger admin vers `/admin/imports` ou un vrai dashboard métier (cf. M-01). Soit le transformer en bandeau d'alertes actionnables.
- Problème résolu : promesse non tenue. Place gaspillée.
- Impact utilisateur : ★★ · Impact métier : ★★★ · Complexité : S · ROI : Élevé · **P1**.

### S-04. Supprimer les modèles morts du schéma Prisma
- Description : `Mnemonique`, `Abreviation`, `Comment`, `Report`, `SiteVisitReport` — soit livrer une UI, soit supprimer. `ObservationHistory` — soit livrer un visualiseur, soit la supprimer.
- Problème résolu : code mort, migrations plus lourdes, confusion lecture du schéma.
- Impact utilisateur : ★ · Impact métier : ★★ · Complexité : S · ROI : Élevé · **P2**.

### S-05. Supprimer les champs Prisma jamais écrits ou jamais lus
- Description : `Agent.rawLabel`, `SiteVisitTemplate.metaSchema`, `Photo.clientId/byteSize/width/height/syncStatus`, `VeilleSession.clientGeneratedId`, `ImportedAction.{actionPlan, transferredTo, initialOwner, sharedWith, establishment, unit, space, observedElement, veilleType, veilleGroup}`.
- Problème résolu : champs fantômes qui suggèrent des fonctions inexistantes.
- Impact utilisateur : ★ · Impact métier : ★ · Complexité : S · ROI : Moyen · **P2**.

### S-06. Réduire les 5 statuts session à 3 actifs
- Description : 5 statuts (Conforme / NC / À revoir / NA / Non observé) sont trop pour un terrain rapide. Exposer 3 + menu « ⋯ » pour AR / NO.
- Problème résolu : pavé tactile session trop dense (cf. UX-18).
- Impact utilisateur : ★★★★ · Impact métier : ★★ · Complexité : S · ROI : Élevé · **P1**.

### S-07. Découper `/admin/imports` en 3 pages séparées
- Description : aujourd'hui 3 fonctions distinctes empilées (Quick action, Import Excel, Import pointages) + historique. Séparer en `/admin/imports/actions`, `/admin/imports/pointages`, `/admin/quick-action`.
- Problème résolu : page surchargée, hiérarchie illisible.
- Impact utilisateur : ★★★ · Impact métier : ★★ · Complexité : S · ROI : Élevé · **P1**.

### S-08. Simplifier les 7 champs NC en saisie terrain
- Description : sur mobile, n'exposer que description + responsable + échéance. Les 4 autres (risque, EVRp, mesures, dates redressement/clôture) en accordéon ou en post-traitement desktop.
- Problème résolu : tableau NC inutilisable mobile (cf. UX-20).
- Impact utilisateur : ★★★★ · Impact métier : ★★ · Complexité : M · ROI : Élevé · **P1**.

### S-09. Cacher les tags « veille légale » + « obligatoire »
- Description : actuellement imposés sur création manuelle d'action (l. 459, 555-556 `AgentActionsClient`). Folklore SNCF non explicable. Remplacer par un switch « Action légale (recommandé) ».
- Problème résolu : confusion pour nouveaux utilisateurs.
- Impact utilisateur : ★★ · Impact métier : ★ · Complexité : S · ROI : Moyen · **P2**.

### S-10. Supprimer les routes API jamais appelées
- Description : `GET /api/auth/me`, `GET /api/procedures`, `GET /api/visit-templates`, `PATCH/DELETE /api/actions/[id]`, `PATCH/DELETE /api/actions/validations/[id]` (sauf si livraison UI prévue), `PATCH/DELETE /api/photos/[id]` (sauf si galerie livrée).
- Problème résolu : surface d'attaque inutile + code mort.
- Impact utilisateur : ★ · Impact métier : ★ · Complexité : S · ROI : Moyen · **P2**.

---

## 6. Évolutions nécessaires pour un déploiement multi-équipes à grande échelle

### MT-01. Migration SQLite → PostgreSQL
- Description : SQLite single-writer bloque les utilisateurs concurrents pendant un import Excel (~5 s pour 17 000 lignes). Au-delà de 50 utilisateurs simultanés, devient un goulot.
- Problème résolu : permet multi-process, cluster, sauvegarde standardisée, lecture en parallèle.
- Impact utilisateur : ★★ · Impact métier : ★★★★★ · Complexité : L · ROI : Très élevé · **P0**.

### MT-02. Hiérarchie organisationnelle (Établissement → Unité → Équipe)
- Description : aujourd'hui une seule notion d'« Équipe ». Or la réalité SNCF est Établissement (EIC, EVEN, etc.) → Unité Opérationnelle → Équipe locale. Modèle déjà partiellement présent dans `ImportedAction.establishment/unit/secteur` mais non exploité.
- Problème résolu : reflète l'organisation réelle. Permet agrégation stats par établissement, droit de regard hiérarchique (un manager d'unité voit toutes les équipes de son unité).
- Impact utilisateur : ★★★ · Impact métier : ★★★★★ · Complexité : L · ROI : Très élevé · **P1**.

### MT-03. Rôles plus fins (5 au lieu de 3)
- Description : ADMIN_SYSTEME (config technique), ADMIN_REFERENTIEL (procédures, templates), MANAGER_UNITE (multi-équipes), MANAGER_EQUIPE (mono-équipe), USER. Sépare l'admin technique de l'admin métier.
- Problème résolu : actuellement EDITOR voit tout l'admin avec des 403 mélangés. Une séparation claire libère cette ambiguïté (M4 du premier audit).
- Impact utilisateur : ★★★ · Impact métier : ★★★★ · Complexité : M · ROI : Élevé · **P1**.

### MT-04. SSO / OIDC (Microsoft / Keycloak)
- Description : intégration SI entreprise (probablement déjà en place pour les agents). Plus de mot de passe à gérer.
- Problème résolu : provisionnement automatique des utilisateurs, déprovisionnement à la sortie, MFA via le provider.
- Impact utilisateur : ★★★ · Impact métier : ★★★★★ · Complexité : L · ROI : Très élevé · **P1**.

### MT-05. Centre de notifications + email + push web
- Description : la donnée existe (actions en retard, NC ouvertes, équipements à renouveler). Il manque la diffusion.
- Problème résolu : passage en mode « push » — l'app va vers l'utilisateur.
- Impact utilisateur : ★★★★ · Impact métier : ★★★★★ · Complexité : L · ROI : Très élevé · **P0**.

### MT-06. Workflow d'approbation des rapports
- Description : un rapport visite/session devient « brouillon → vérifié → publié → diffusé ». Trace de qui a validé quoi.
- Problème résolu : aujourd'hui un rapport généré est diffusé tel quel sans validation hiérarchique.
- Impact utilisateur : ★★ · Impact métier : ★★★★ · Complexité : L · ROI : Élevé · **P2**.

### MT-07. API publique / Webhooks pour intégration SI
- Description : connecter Veille à un GMAO existant (Maximo, EAM), un SIRH, un ERP. Bidirectionnel : import RH automatique, export d'actions vers Maximo.
- Problème résolu : aujourd'hui import Excel manuel hebdo. Double saisie entre outils.
- Impact utilisateur : ★★ · Impact métier : ★★★★★ · Complexité : L · ROI : Très élevé · **P2**.

### MT-08. Plan de tests + CI/CD
- Description : Vitest socle unitaire (auth.ts scopes, parsing xlsx, dedupHash), Playwright sur 3 flows critiques (login + veille + validation). GitHub Actions.
- Problème résolu : sécurise les déploiements futurs ; détecte les régressions multi-team avant prod.
- Impact utilisateur : ★ · Impact métier : ★★★★ · Complexité : M · ROI : Élevé · **P1**.

### MT-09. Observabilité (Sentry + logs structurés + healthchecks)
- Description : voir les bugs avant que les utilisateurs ne les reportent. Logs JSON, request-id, page `/status`.
- Problème résolu : aujourd'hui zéro visibilité sur les erreurs en prod.
- Impact utilisateur : ★ · Impact métier : ★★★★ · Complexité : S · ROI : Très élevé · **P1**.

### MT-10. Backup automatisé + plan de reprise testé
- Description : script `VACUUM INTO` quotidien (ou PG_DUMP après MT-01), retention 30 j, rsync vers stockage distant. Procédure de restauration testée trimestriellement.
- Problème résolu : continuité d'activité. Aujourd'hui un crash disque = perte définitive.
- Impact utilisateur : ★ · Impact métier : ★★★★★ · Complexité : S · ROI : Très élevé · **P0**.

### MT-11. Multi-langue
- Description : i18n via `next-intl`, FR par défaut, EN/ES/DE pour filiales.
- Problème résolu : prépare un déploiement international si pertinent.
- Impact utilisateur : ★ (FR seulement court terme) · Impact métier : ★★ · Complexité : M · ROI : Moyen · **P3**.

### MT-12. Configuration par établissement (branding, en-tête PDF, logo)
- Description : table `EstablishmentConfig` avec logo, en-tête PDF custom, mentions légales. Sélection automatique sur la base de l'équipe de l'utilisateur.
- Problème résolu : aujourd'hui un seul branding « VEILLE TERRAIN ». Limite l'identification par établissement.
- Impact utilisateur : ★★ · Impact métier : ★★★ · Complexité : M · ROI : Moyen · **P2**.

---

## 7. Roadmap produit 12 mois

> **Objectif** : 200+ utilisateurs actifs sur 5+ équipes en 12 mois, avec un taux d'usage hebdomadaire > 80 %.

### Mois 1 — Lever les bloquants critiques + Quick wins UX

Capacité ≈ 15-20 jours-homme dev. Décharge bloquants + 4-5 améliorations UX à haute visibilité utilisateur.

**Bloquants** (cf. AUDIT.md C1-C7) :
- C1. Photos privées (route API streaming, hors `/public/`).
- C2. Bug scope `teamId` multi-équipes.
- C3. Décision et début de branchement réel `syncQueue` (voir J1).
- C4. Migrations Prisma versionnées (baseline).
- C5. Variables CSS fantômes (alias dans `globals.css`).
- C6. Bouton « Nouvelle procédure » réparé.
- C7. Tables admin avec `overflow-x-auto` + mode card mobile.

**Quick wins UX (mois 1)** :
- UX-02. Menu mobile 6e bouton « Plus ».
- UX-10. Toaster `sonner` + ConfirmDialog.
- UX-13. Filtres recherchables dans `/history` et `/stats`.
- UX-17. Annulation validation 5 min window.
- UX-19. Bouton « Voir le rapport » dans listes.

**Quick wins métier (mois 1)** :
- M-08. Photos en visites (réutilisation `PhotoControls`).
- M-20. Reset password par email (lien temporaire).
- MT-10. Backup automatisé (script `VACUUM INTO` quotidien).

**Quick wins à supprimer (mois 1)** :
- S-09. Tags imposés cachés derrière un switch.
- S-10. Routes API jamais appelées supprimées (sauf si livraison prévue).

### Mois 2-3 — Tableau de bord opérationnel + page profil

Capacité ≈ 30-40 jours-homme. Construction des deux modules qui transforment le taux d'usage.

**Modules nouveaux (cœur)** :
- M-01. Dashboard EDITOR « Ma tournée » (priorité absolue pour l'adoption manager).
- M-02. Page profil `/me` (centralise préférences + sync queue + stats perso).
- M-05. Vue NC ouvertes consolidée.
- M-06. Visites en retard (`expectedFrequencyDays` exploité).

**UX (mois 2-3)** :
- UX-01. Page d'accueil mobile « Aujourd'hui ».
- UX-03. Bottom-sheet généralisé (modal, NoteModal, TeamPicker).
- UX-05. Swipe-to-archive sur listes.
- UX-06. FAB « + » mobile.
- UX-07. Statuts pleine largeur (sessions + visites).
- UX-11. Refonte chrome admin mobile (drawer).
- UX-15. Vocabulaire harmonisé (Catalogue / Veille / Visite / Inventaire).
- UX-18. Statuts session simplifiés à 3.

**Métier (mois 2-3)** :
- M-03. Audit log consultable.
- M-10. Page archives + restauration.
- M-15. Manager d'équipe assignable.
- M-16. Création manuelle d'agent.
- M-14. Export CSV pour utilisateurs / agents / actions.

**À simplifier** :
- S-03. Dashboard admin actuel remplacé par M-01.
- S-04 / S-05. Modèles et champs morts supprimés du schéma.
- S-06 / S-08. Statuts et champs NC simplifiés sur mobile.
- S-07. `/admin/imports` éclaté en 3 pages.

**Multi-tenant fondations** :
- MT-08. Socle tests Vitest + Playwright critique.
- MT-09. Sentry + logs structurés.

### Mois 4-6 — Industrialisation + features push

Capacité ≈ 60-80 jours-homme. Transformer l'app en plateforme.

**Modules nouveaux** :
- M-04. CRUD complet des templates de visite (clé pour autonomie référentiel).
- M-07. Galerie photo `/photos`.
- M-11. Alertes péremption automatiques.
- M-12. Champ « lieu » sur les sessions.
- M-13. Signature manuscrite participant.
- M-18. Drill-down dans les statistiques.
- M-19. Rapport hebdomadaire emailé.

**Features valeur ajoutée (mois 4-6)** :
- V-01. QR code site → veille préchargée.
- ~~V-02. Reconnaissance vocale → commentaire.~~ — ⛔ abandonnée définitivement (PO 2026-06-14)
- V-07. Notifications push (PWA).
- V-08. Plan d'action automatique post-visite (email).

**Multi-tenant** :
- MT-01. Migration PostgreSQL.
- MT-05. Centre de notifications + email + push web.
- MT-03. Rôles plus fins (5 au lieu de 3).
- MT-04. SSO / OIDC (Microsoft / Keycloak).

**Cohérence transverse** :
- UX-04. Composant `<EntityCard>` unique pour les listes.
- UX-09. Refonte tables admin → cards empilées sur mobile.
- S-01. Fusion Vu / Commentaire / Validation en « Interaction ».
- S-02. Fusion liste publique et admin (toggle mode admin).

### Mois 7-12 — Plateformisation et innovation

Capacité ≈ 100-150 jours-homme. Différenciation produit et préparation déploiement multi-établissement.

**Multi-tenant avancé** :
- MT-02. Hiérarchie Établissement → Unité → Équipe (modèle + UI + scopes).
- MT-06. Workflow d'approbation des rapports.
- MT-07. API publique / Webhooks pour intégration SI (GMAO, SIRH, ERP).
- MT-12. Configuration par établissement (branding, PDF).

**Features innovantes** :
- V-03. Annotation photo (cercle / flèche).
- V-04. Détection équipement par photo (LLM vision).
- V-05. Comparaison « Δ depuis la dernière visite ».
- V-10. Indicateur qualité de saisie.
- V-09. Plan interactif des sites avec localisation équipements.

**Optionnels selon contexte** :
- V-06. Mode binôme (saisie simultanée 2 users).
- MT-11. Multi-langue.

---

## 8. Indicateurs de succès du programme

À mesurer dès la mise en production :

**Adoption**
- Nombre d'utilisateurs actifs hebdomadaires (objectif : >80 % des comptes provisionnés).
- Nombre de sessions/visites créées par semaine et par équipe.
- Taux de visites mobile vs desktop (objectif terrain : >50 % mobile).

**Productivité**
- Temps moyen pour démarrer une veille (objectif : < 30 s sur mobile).
- Nombre de clics moyens pour valider une action (objectif : < 4).
- Taux de NC clôturées dans les délais (responsabilité métier).

**Qualité**
- Taux de NC avec photo (objectif : > 80 %).
- Taux de sessions clôturées avec commentaire général (objectif : > 60 %).
- Délai moyen entre prise de NC et validation (objectif : < 7 j).

**Fiabilité**
- Taux d'erreurs côté client (Sentry) — objectif : < 0,1 % des sessions.
- Taux de sync offline réussie (post-MT-05).
- Disponibilité (uptime) — objectif : > 99,5 %.

**Vocabulaire & Confiance**
- Nombre de tickets support liés à la confusion lexicale (Veille / Session / Visite) — doit tomber à 0 après UX-15.
- Nombre de tickets « j'ai cliqué supprimer par erreur » — doit baisser de 80 % après UX-05 et UX-17.

---

## 9. Lectures complémentaires

- [AUDIT.md](AUDIT.md) — premier audit (technique + responsive + navigation + permissions + données + opportunités). Contient les 7 critiques (C1-C7) référencés ici et le détail des matrices CRUD / permissions.
- Annexes techniques disponibles sur demande : matrices détaillées par module, parcours par rôle avec chronométrage des clics, audit UX écran par écran (28 écrans).
