# Notifications push — Sprint Push V1

PWA Web Push standard (RFC 8030 + VAPID RFC 8292). Pas de Firebase, pas
de OneSignal. Lib serveur : `web-push`.

## Plateformes supportées

| Plateforme | Statut | Pré-requis |
|---|---|---|
| Android Chrome ≥ 50 | OK | Permission Notifications accordée |
| Android Edge | OK | Idem |
| Android Samsung Internet | OK | Idem |
| iPhone iOS ≥ 16.4 | OK **uniquement PWA installée** | « Ajouter à l'écran d'accueil » puis lancer l'app depuis l'icône |
| Desktop Chrome / Edge / Firefox | OK | — |

## Variables d'environnement

Toutes obligatoires dès que `ENABLE_PUSH=true` :

| Variable | Côté | Rôle |
|---|---|---|
| `ENABLE_PUSH` | serveur | Master switch. `false` → push silencieux, l'app continue. |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | **client + serveur** | Clé publique base64url, exposée au bundle client. |
| `VAPID_PRIVATE_KEY` | serveur uniquement | Clé privée base64url. À ne JAMAIS exposer. |
| `VAPID_SUBJECT` | serveur | Contact mailto: requis par FCM (Chrome / Android). |
| `CRON_SECRET` | serveur | Secret partagé pour les routes cron (header `x-cron-secret`). |

## Générer les clés VAPID

```bash
npx web-push generate-vapid-keys --json
```

Sortie :

```json
{"publicKey":"BCK...","privateKey":"-bA..."}
```

Coller :
- `publicKey` → `NEXT_PUBLIC_VAPID_PUBLIC_KEY`
- `privateKey` → `VAPID_PRIVATE_KEY`

## Rotation des clés VAPID

Une rotation invalide **tous** les abonnements existants (chaque endpoint
est signé avec la paire courante côté push service).

Procédure :

1. Générer une nouvelle paire (`npx web-push generate-vapid-keys`).
2. Remplacer `NEXT_PUBLIC_VAPID_PUBLIC_KEY` + `VAPID_PRIVATE_KEY` en prod.
3. Bumper `SW_VERSION` dans `src/app/sw.ts` pour forcer la réinscription.
4. `TRUNCATE TABLE "PushSubscription"` (les anciennes lignes ne marcheront
   plus, autant les purger). À défaut, le cleanup 404/410 s'en chargera.

Pas de rotation automatique en V1.

## Cron — Échéances critiques

Une seule route : `POST /api/cron/echeances-push`.

Protégée par header `x-cron-secret: <CRON_SECRET>`.

Fréquence cible : **06:00 Europe/Paris, 1 fois par jour**.

Exemples de déclenchement :

- **Vercel cron** — `vercel.json` :
  ```json
  { "crons": [{ "path": "/api/cron/echeances-push", "schedule": "0 5 * * *" }] }
  ```
  (Vercel cron utilise UTC → 05:00 UTC = 06:00 Europe/Paris en CET hiver / 07:00 en CEST été ; ajuster si nécessaire.)

- **crontab Linux** :
  ```cron
  0 6 * * * curl -X POST https://veille.example.com/api/cron/echeances-push \
    -H "x-cron-secret: $CRON_SECRET" -H "Content-Length: 0"
  ```

## Sécurité

- Le `userId` cible n'est **jamais** transmis par le client. Toutes les
  routes `/api/push/*` et `/api/me/*` lisent l'utilisateur depuis la
  session.
- Les routes cron rejettent 401 si le header `x-cron-secret` est absent
  ou ne correspond pas à `CRON_SECRET`.
- Logs : on ne logge **jamais** `endpoint`, `p256dh`, `auth`. Format
  autorisé : `{ userId, httpStatus, endpointHash }` (sha-256 tronqué).
- Pas de RPC depuis le SW vers le serveur en push handler — uniquement
  `showNotification` pour rester hors `connect-src` CSP.

## Rollback

Mettre `ENABLE_PUSH=false` :
- L'écran préférences continue de s'afficher mais le toggle « Notifications
  push » est forcé à `false`.
- Les API `/api/push/*` renvoient 503.
- Les Notification in-app continuent d'être créées comme avant.

## Cloisonnement

Le push ne recalcule jamais le scope équipe. Il ne pousse qu'à un user
qui possède déjà une `Notification` créée pour lui (chaîne
`createNotification → sendPushNotification(notif.userId)`).
