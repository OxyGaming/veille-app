# Backup automatisé SQLite — Veille

> **Référence** : AUDIT.md §MT-10 (assurance avant tout chantier risqué) /
> BACKLOG-V2.md US-1.8 / DECISIONS-SPRINT1.md commit 10.

## Principe

- **Méthode** : `VACUUM INTO` — copie atomique, cohérente, sans verrouillage
  long de l'application. Supportée depuis SQLite 3.27 (2019). Plus sûr que
  `cp dev.db` car gère proprement les journaux WAL en cours.
- **Stockage** : local sur le VPS, dossier `backups/` à la racine du repo
  (configurable).
- **Rétention** : 30 jours par défaut (configurable).
- **Pas de chiffrement, pas de stockage distant** dans ce commit — voir
  « Évolutions » en bas.

## Pré-requis

```bash
sudo apt update && sudo apt install -y sqlite3 bash coreutils findutils
```

## Variables d'environnement (toutes optionnelles)

| Variable | Rôle | Défaut |
|---|---|---|
| `VEILLE_DB_PATH` | Chemin de la base à sauvegarder | `veille-app/prisma/dev.db` (relatif à la racine du repo) |
| `VEILLE_BACKUP_DIR` | Dossier des backups | `backups/` |
| `VEILLE_BACKUP_RETENTION_DAYS` | Rétention en jours | `30` |

## Backup manuel

```bash
./scripts/backup-sqlite.sh
```

Produit un fichier `backups/veille-YYYYMMDD-HHMMSS.db`.

Sortie type :

```
[backup 2026-06-13T03:00:01+02:00] source=/opt/veille/veille-app/prisma/dev.db
[backup 2026-06-13T03:00:01+02:00] cible=/opt/veille/backups/veille-20260613-030001.db
[backup 2026-06-13T03:00:01+02:00] OK veille-20260613-030001.db (4,2M)
[backup 2026-06-13T03:00:01+02:00] purge des fichiers > 30 jours dans /opt/veille/backups…
[backup 2026-06-13T03:00:01+02:00] purge terminée (2 fichier(s) supprimé(s))
```

## Installation du cron (1× / jour à 03h00)

Éditer la crontab de l'utilisateur qui exécute Veille :

```bash
crontab -e
```

Ajouter la ligne suivante (adapter le chemin) :

```
0 3 * * * cd /opt/veille && ./scripts/backup-sqlite.sh >> /var/log/veille-backup.log 2>&1
```

Vérifier que la crontab est bien chargée :

```bash
crontab -l
```

Vérifier le lendemain matin que le fichier de log a bien progressé et
qu'un nouveau backup est apparu :

```bash
tail -n 20 /var/log/veille-backup.log
ls -lh /opt/veille/backups/
```

## Restauration

> **L'application DOIT être arrêtée** pendant la restauration.
> `better-sqlite3` garde un handle ouvert sur `dev.db` ; remplacer le
> fichier pendant qu'il tourne corrompt la base.

```bash
# 1. Arrêter le service (adapter au nom réel)
sudo systemctl stop veille

# 2. Restaurer depuis un backup
./scripts/restore-sqlite.sh backups/veille-20260601-030000.db

# 3. Redémarrer
sudo systemctl start veille

# 4. Vérifier que l'application répond
curl -s http://localhost:3002/api/health | jq .
```

Le script `restore-sqlite.sh` :

- vérifie que le backup est une base SQLite saine (`PRAGMA integrity_check`),
- demande confirmation explicite (tape `oui`),
- copie l'actuel `dev.db` en `.pre-restore-YYYYMMDD-HHMMSS` avant remplacement
  (filet de sécurité en cas d'erreur).

## Test de restauration recommandé (à faire chaque trimestre)

Sur un environnement de pré-prod ou une copie :

1. Identifier le backup à restaurer.
2. Lancer `restore-sqlite.sh` dessus.
3. Démarrer l'app, se connecter, vérifier qu'une session récente est présente
   et que les chiffres sont cohérents (nombre d'agents, dernière visite).
4. Documenter les éventuelles erreurs et corriger le runbook.

## Évolutions prévues (hors périmètre US-1.8)

- **Stockage distant** : rsync vers S3 / Backblaze / autre VPS — à ajouter
  quand le déploiement multi-équipes commence (cf. Sprint 4 / MT-01).
- **Chiffrement au repos** : si les backups contiennent des données
  personnelles, envisager `age` ou `gpg` côté serveur avant transfert.
- **Notification d'échec** : envoyer un email / push si le cron échoue
  (intégration avec le centre de notifications du Sprint 4 E7).
- **Backup horaire** sur la WAL : pour les périodes critiques (post-déploiement
  par ex.).

## Validation du commit

- Test scénario : `./scripts/backup-sqlite.sh` produit un fichier non
  vide dans `backups/`, le `sqlite3 PRAGMA integrity_check` retourne `ok`.
- Test rétention : créer un fichier de simulation
  `touch -d '40 days ago' backups/veille-old.db` puis relancer le script ;
  vérifier que `veille-old.db` est supprimé.
- Test restauration : lancer `restore-sqlite.sh` sur un backup ; vérifier
  le fichier `.pre-restore-*` créé et l'app démarre correctement.
