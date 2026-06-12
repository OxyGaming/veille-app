# Déploiement Veille

Scripts pour installer puis mettre à jour l'application sur un serveur Ubuntu/Debian.

## Première installation

```bash
# Sur le serveur, en root :
cd /tmp
git clone https://github.com/OxyGaming/veille-app.git veille-bootstrap
sudo bash veille-bootstrap/deploy/install.sh
rm -rf veille-bootstrap
```

Ce que fait `install.sh` :

1. Installe les paquets système (`git`, `nodejs` 20 via NodeSource si nécessaire, `build-essential`, `pm2` global).
2. Clone le dépôt dans `/var/www/veille` et le donne à l'utilisateur `ubuntu`.
3. Génère un `.env` avec des secrets aléatoires (`VEILLE_AUTH_SECRET` 32 hex, `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` 32 base64). Si un `.env` existe déjà, il est **respecté** — relance le script tranquille.
4. `npm ci` + `prisma generate` + `prisma db push` (crée le fichier `prisma/dev.db`).
5. `tsx prisma/seed.ts` — crée l'admin par défaut, l'équipe, les 62 procédures, les 2 templates de visite, les catégories de liens.
6. `npm run build` (production).
7. Démarrage PM2 sur le port voulu (`PORT=3004` par défaut) sous le nom `veille`.
8. Active la résurrection au boot via `pm2 startup systemd`.

**Identifiants initiaux** :
- email : `admin@veille.local`
- password : `admin`

Change-les depuis `/admin/users` après la première connexion.

### Variables surchargeables

```bash
sudo APP_DIR=/srv/veille APP_USER=www-data PORT=4000 PM2_NAME=veille-prod \
  bash veille-bootstrap/deploy/install.sh https://github.com/OxyGaming/veille-app.git
```

## Mise à jour

```bash
sudo bash /var/www/veille/deploy/update.sh
```

Ou, plus court une fois familier :

```bash
cd /var/www/veille
bash deploy/update.sh
```

Ce que fait `update.sh` :

1. `git pull --ff-only` sur la branche courante (`main` par défaut).
2. `npm ci` (lockfile-strict).
3. `prisma generate` + `prisma db push` (applique les éventuels changements de schéma — la BDD SQLite est patchée sur place).
4. `npm run build`.
5. `pm2 reload veille --update-env` (zero-downtime si l'app le supporte ; sinon `restart`).
6. `pm2 save`.

Il **ne touche pas** au `.env`. Si une nouvelle variable est requise par une mise à jour, lis le CHANGELOG/README à jour.

### Si pull --ff-only échoue

C'est qu'il y a des modifs locales. Soit tu les stash :

```bash
cd /var/www/veille && git stash && bash deploy/update.sh && git stash pop
```

Soit tu reset (destructif) :

```bash
cd /var/www/veille && git reset --hard origin/main && bash deploy/update.sh
```

## Alternative : `ecosystem.config.cjs`

Si tu préfères ne pas passer par `pm2 start npm ...` :

```bash
cd /var/www/veille
pm2 start deploy/ecosystem.config.cjs
pm2 save
```

Permet de versionner les logs (`/var/log/pm2/veille.{out,err}.log`) et le `max_memory_restart: 1G`.

## Diagnostic

| Commande | À quoi ça sert |
|---|---|
| `sudo -u ubuntu pm2 status` | l'app est-elle online ? |
| `sudo -u ubuntu pm2 logs veille --lines 100` | derniers logs |
| `curl -I http://127.0.0.1:3004/` | test HTTP local |
| `ls -lh /var/www/veille/veille-app/prisma/dev.db` | taille de la BDD |
| `sudo -u ubuntu npx prisma studio` (dans `veille-app/`) | navigateur de BDD |

## Reverse proxy / TLS

Pas géré par ces scripts. Tu peux mettre Caddy ou Nginx devant le port `3004` :

```caddy
rh.apps-reseau.fr {
  reverse_proxy 127.0.0.1:3004
}
```

Le `proxy.ts` interne au projet gère déjà l'auth et les en-têtes — pas besoin de manipuler ça côté reverse proxy.

## Sauvegarder la base

```bash
sudo cp /var/www/veille/veille-app/prisma/dev.db ~/veille-$(date +%F).db
```

SQLite supporte la copie chaude tant qu'aucune transaction n'est en cours. Pour un dump propre :

```bash
sudo sqlite3 /var/www/veille/veille-app/prisma/dev.db ".backup ~/veille-$(date +%F).db"
```
