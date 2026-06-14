# Veille — application terrain mobile/PWA

Application interne de veille procédurale avec mode hors ligne, import Excel
des actions agent, génération de compte rendu PDF et back-office complet.

## Stack

- Next.js 16.1.6 (App Router, Turbopack, proxy.ts)
- React 19, Tailwind v4
- Prisma 7 + better-sqlite3 (configuré via `prisma.config.ts`)
- Auth maison Edge-safe (cookie `veille-auth`, base64)
- PWA via Serwist (`@serwist/next`)
- jsPDF + jsPDF-AutoTable pour le compte rendu
- XLSX pour l'import des actions

## Démarrage local

```bash
cp .env.example .env
# éditer VEILLE_AUTH_SECRET (16+ chars)
npm install
npm run pwa:icons         # génère les icônes PWA
npm run db:push           # crée le schéma SQLite
npm run db:seed           # crée admin + 62 procédures + catégories liens
npm run dev               # http://localhost:3002
```

Compte par défaut : `admin@veille.local` / `admin` (rôle ADMIN).

## Architecture

```
src/
  app/                       # App Router
    (app)/                   # group routes app utilisateur (avec AppShell)
      procedures/            # liste menu silos par domaine
      sessions/[id]/         # saisie terrain interactive
                report/      # compte rendu + export PDF
      agents/[id]/           # vue agent (actions + historique + sessions)
      links/                 # liens utiles
    admin/                   # back-office (ADMIN/EDITOR)
      procedures/            # CRUD procédures + checklist
      imports/               # import Excel des actions
    api/                     # routes JSON
      auth/                  # login / logout / me
      procedures/[id]        # CRUD
      sessions/[id]          # CRUD + /report (JSON snapshot)
      observations/[id]      # PATCH statut/commentaire
      photos                 # POST multipart
      actions/[id]/validate  # POST validation depuis l'app
      admin/actions/import   # POST upload Excel
    sw.ts                    # Service worker Serwist
    offline/                 # page de fallback hors ligne
    login/                   # page de connexion (unique route /login)
  components/AppShell.tsx    # layout mobile (bottom nav + sync indicator)
  lib/
    auth.ts                  # Node : hash, session, requireUser/requireRole
    auth-edge.ts             # Edge-safe : encode/decode token (atob/btoa)
    prisma.ts                # adapter better-sqlite3
    actionImport.ts          # parsing xlsx + matricules agent
    syncQueue.ts             # IndexedDB file de mutations offline
  proxy.ts                   # middleware Next.js (auth + redirections)
prisma/
  schema.prisma              # 25+ modèles couvrant tout le domaine
  seed.ts                    # admin + procédures (62) + catégories
  seed-procedures.ts         # données extraites du HTML d'origine
public/
  manifest.webmanifest
  icons/                     # générées via scripts/generate-pwa-icons.mjs
  uploads/                   # photos (gitignored)
```

## Modèle de données (vue d'ensemble)

- **User / Team** : ADMIN voit tout, USER/EDITOR scopés sur leur `teamId`
  (peuvent activer `viewAllTeams` pour basculer cross-équipe).
- **Procedure / ChecklistItem** : communes à toutes les équipes (cf. spec).
- **VeilleSession / ProcedureObservation / ObservationItem / ObservationHistory** :
  saisie terrain avec trace complète des modifications.
- **Comment / Photo** : rattachés à la session ou à l'observation.
- **ImportedAction / ActionValidation / ActionImport** : flux Excel + validation.
- **Agent / Poste / Secteur / Contact / Mnemonique / Abreviation** : référentiel.
- **Link / LinkCategory** : annuaire de liens.

## Cloisonnement équipe

`teamScope(user)` calcule le `where: { teamId: ... }` à passer à Prisma :
- ADMIN → `{}` (pas de filtre)
- USER / EDITOR avec `viewAllTeams=true` → `{}`
- USER / EDITOR sinon → `{ teamId: user.teamId }`
- USER sans équipe → `{ teamId: "__none__" }` (bloque tout)

L'utilisateur peut activer/désactiver `viewAllTeams` depuis son profil (à
ajouter dans la prochaine itération, le champ existe déjà).

## Auth

- Route unique : `/login` (le proxy redirige `/admin/login` → `/login`).
- Token : `base64(secret:userId)` dans le cookie `veille-auth`.
- Vérification Edge dans `proxy.ts` (atob), pas de Buffer.
- Vérification fine (rôle, scope) dans les handlers Node via `requireUser`
  / `requireRole`.

## Import Excel

Endpoint `POST /api/admin/actions/import`. Règles :
- la liste active de l'équipe est remplacée par le contenu du fichier ;
- les ACTIVE absentes deviennent OBSOLETE ;
- les actions déjà validées localement (`VALIDATED_LOCAL`) restent intactes ;
- les colonnes manquantes/null **ne sont pas** écrasées sur l'existant ;
- les agents sont créés/mis à jour via matricule (`/\b[0-9]{6,9}[A-Z]?\b/`).

## Mode hors ligne

- `Serwist` précache le shell + page `/offline`.
- `lib/syncQueue.ts` met en file IndexedDB les mutations PATCH/POST quand
  `navigator.onLine === false` et les rejoue via `replayAll()`.
- Photos compressées côté client avec `browser-image-compression` avant upload.

## Déploiement

Conçu pour un VPS Ubuntu derrière Nginx (cf. Point RH). Variables minimales :

```
DATABASE_URL=file:./prod.db
VEILLE_AUTH_SECRET=<32+ chars>
NEXT_SERVER_ACTIONS_ENCRYPTION_KEY=<openssl rand -base64 32>
NODE_ENV=production
```

Build :

```bash
npm run build && npm start
```

## Règles métier & décisions PO

Les règles métier validées et les décisions PO en vigueur sont consignées à la racine du dépôt et **font foi** en cas d'écart avec n'importe quel autre document de conception (audits, vision, backlogs) :

- [`memory/business-rules.md`](../memory/business-rules.md) — cadences de visites (trimestrielle 90 j, planifiées 180/365 j selon `Site.isOccupied`), multi-équipes sites, notifications équipe, audio abandonné.
- [`memory/decisions.md`](../memory/decisions.md) — état des sprints, capacités livrées, capacités déférées.

À consulter avant tout développement métier (Hub Échéances, modélisation, notifications, etc.).

## Feature flags

Les flags sont lus côté serveur depuis `process.env` (cf. `src/lib/featureFlags.ts`).

| Variable | Défaut | Effet |
|---|---|---|
| `ENABLE_TODAY` | `true` | Active l'écran `/today` et redirige `/` vers `/today`. Mettre à `false` pour rollback vers `/procedures` (legacy). |

Pour exposer un flag côté client, le passer en prop depuis un Server Component
vers un Client Component (cf. `app/(app)/layout.tsx` → `AppShell`).

## Prochaines évolutions suggérées

- **Tableaux de bord** : agrégats NC/AR par domaine, taux conformité par agent.
- **Cross-équipe** : interface profile pour toggle `viewAllTeams`.
- **Export Excel/Word** : la structure `/api/sessions/:id/report` est prête.
- **Statistiques** : récurrence des NC par point clé (vue Prisma agrégée).
- **Background sync API** : déléguer `syncQueue.replayAll()` au SW via tag.
- **Web Push** : notifications de nouvelles actions à traiter.
- **Versionnement assets** : header `Cache-Control: no-cache` sur `/sw.js`
  + bouton « Vider le cache » côté admin pour le bug Service Worker en dev.
