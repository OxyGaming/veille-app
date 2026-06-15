# Sprint 8 — Centre d'administration des équipes — Recette

## Périmètre livré

| Chap | Description | Commit |
|---|---|---|
| C1 | Vue globale `/admin/teams` : KPI + cartes M2M | `55115c6` |
| C2 | Détail `/admin/teams/[id]` : 3 onglets read-only + recherche | `ac7a891` |
| C3 | Routes POST/DELETE granulaires + UI ajout/retrait | `36e275a` |
| C4+C5 | `/admin/teams/health` : cloisonnement incomplet + sur-affectations | `02a6594` |
| C6 | Garde ADMIN spécifique au sprint 8 + recette + doc | (ce commit) |

Aucune migration Prisma — toutes les relations équipes ↔ users/agents/sites
(legacy `*.teamId` + M2M `UserTeam`/`AgentTeam`/`SiteTeam`) existaient déjà
depuis le sprint 1. La source de vérité reste les liens M2M.

---

## Accès

**ADMIN — accès complet**
- `/admin/teams` : 200, cartes + KPI affichés
- `/admin/teams/[id]` : 200, 3 onglets fonctionnels
- `/admin/teams/health` : 200, sections C4 + C5
- API : `POST/DELETE /api/admin/teams/[id]/members/[kind]/[refId]` → 200

**EDITOR — refusé**
- `/admin/teams*` : redirige vers `/admin` (layout autorise EDITOR mais
  les pages teams revérifient `role === "ADMIN"`)
- API `POST /api/admin/teams/[id]/members/*` : **403**

**USER — refusé**
- `/admin/teams*` : redirige vers `/procedures` (gating layout admin)
- API : **403**

Vérifié en preview avec `recette-editor-s3@veille.local` (EDITOR) et
`jessie.achille@import.local` (USER).

---

## Performance

Pages mesurées via `performance.now()` sur Next dev :

| Page | Temps |
|---|---|
| `/admin/teams` | 115 ms |
| `/admin/teams/[id]` | 103 ms |
| `/admin/teams/health` | 105 ms |

Tous bien sous le seuil 500 ms. Sur SQLite avec ~50 agents, 4 users,
2 sites. À recontrôler après import production complet (1000+ agents).

---

## Responsive

| Page | 320 px | 375 px | 768 px | desktop |
|---|---|---|---|---|
| `/admin/teams` | OK | OK | OK | OK |
| `/admin/teams/[id]` | OK | OK | OK | OK |
| `/admin/teams/health` | OK | OK | OK | OK |

Aucun overflow horizontal global sur les 3 pages. Tables avec
`min-w-[640px] + overflow-x-auto` (scroll horizontal interne sur les
écrans très étroits, comportement attendu).

---

## Routes API ajoutées

### `POST /api/admin/teams/[id]/members/[kind]/[refId]`
- ADMIN-only
- `kind` ∈ `user` | `agent` | `site`
- Idempotent : 200 + `{ alreadyMember: true }` si lien déjà existant
- AuditLog `TEAM_MEMBER_ADDED` snapshot `{ kind, refId, teamName }`
- 404 si team ou entité inconnue

### `DELETE /api/admin/teams/[id]/members/[kind]/[refId]`
- ADMIN-only
- Idempotent : 200 + `{ removed: false }` si lien absent
- AuditLog `TEAM_MEMBER_REMOVED` snapshot `{ kind, refId, teamName }`
- 404 si team inconnue ; pas de fuite d'existence sur l'entité

---

## Cas testés

- [x] ADMIN — vue globale, KPI corrects (2 teams / 4 users / 44 agents / 2 sites)
- [x] ADMIN — détail équipe, 3 onglets fonctionnels (3/44/1)
- [x] ADMIN — recherche locale par onglet
- [x] ADMIN — ajout user via picker, candidat retiré de la liste
- [x] ADMIN — retrait user via croix, ligne disparaît
- [x] ADMIN — diagnostic health, sections C4 + C5 affichées
- [x] ADMIN — édition nom/code de l'équipe
- [x] EDITOR — accès `/admin/teams` redirige vers `/admin`
- [x] EDITOR — API POST `/members/*` → 403
- [x] USER — accès `/admin/teams*` redirige vers `/procedures`
- [x] Idempotence : double POST → `alreadyMember`, double DELETE → `removed: false`
- [x] AuditLog `TEAM_MEMBER_ADDED` / `TEAM_MEMBER_REMOVED` créés
- [x] Responsive 375 px sans overflow horizontal global
- [x] TypeScript strict clean
- [x] Vitest vert (17 tests history-delete inchangés)

---

## Risques

1. **Volumétrie picker** — `/admin/teams/[id]` charge la liste COMPLÈTE
   des users/agents/sites actifs pour alimenter la modale d'ajout. À
   100+ agents c'est ~12 KB. À 1000+ agents → ~120 KB par requête.
   Mitigation V2 : endpoint async paginé pour la modale.

2. **`_count` Prisma hors `where`** — La détection sur-affectations C5
   filtre côté JS (`rows.filter(r => r._count.memberships > 5)`).
   Linéaire en nb d'users/agents/sites. À volumétrie production (1000+),
   reste sous la seconde mais à surveiller. Migration possible vers
   `$queryRaw` avec `GROUP BY HAVING COUNT(*)`.

3. **Confirmation native `confirm()`** — Le bouton de retrait utilise
   `window.confirm()` plutôt qu'un dialog stylé. Acceptable V1 mais
   visuellement incohérent avec `useConfirmDialog` utilisé ailleurs
   (admin agents notamment). À uniformiser.

4. **Pas de bulk** — l'ajout dans la modale est unitaire (1 clic =
   1 POST). Pour rattacher 30 agents à une équipe, il faut 30 clics.
   Acceptable V1 (opérations admin ponctuelles). V2 : checkboxes +
   bouton « Ajouter la sélection ».

---

## Dettes techniques

- **Layout admin laxiste** — `/admin/layout.tsx` accepte ADMIN +
  EDITOR pour l'ensemble des sections. Les 3 pages du sprint 8
  resserrent à ADMIN au cas par cas. Question ouverte : peut-être
  passer l'ensemble du layout à ADMIN-only et exposer les sections
  EDITOR ailleurs ? Pas dans le périmètre du sprint.

- **Bouton « Voir » des cartes** — pointe vers `/admin/teams/[id]`
  (intentionnel), mais l'utilisateur ADMIN pourrait aussi vouloir
  filtrer rapidement les vues métier scopées sur l'équipe. À
  considérer dans une évolution future.

- **`User.teamId` legacy** — toujours utilisé comme « équipe
  principale » dans le seed et certaines vues métier. Non traité
  dans ce sprint (hors périmètre). À documenter pour la V2 du
  scope ADMIN.

---

## Actions pré-déploiement

1. **Recensement production** — exécuter `/admin/teams/health` après
   import production pour identifier les orphelins existants. Selon
   le résultat, prévoir une opération de rattachement manuelle.

2. **Doc utilisateur** — guide rapide ADMIN sur les 3 vues + le
   workflow ajout/retrait. À glisser dans `Liens utiles` ou
   `Contacts` selon la convention équipe.

3. **Backup avant ouverture** — `update.sh` fait déjà un backup
   horodaté. Vérifier qu'il tourne bien (étape 2 non skip).

4. **AuditLog rotation** — les opérations sur les équipes vont
   générer des `TEAM_MEMBER_*` régulièrement. Vérifier que la
   purge audit (Sprint 6 ?) couvre ces actions.

---

## SHA livraison

Final C6 : `5aa414c`

À renseigner après le commit final de C6.
