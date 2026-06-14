# Sprint 5 — Recette finale (C10)

> Date : 2026-06-14
> Reviewer : Claude Code (Opus 4.7) — automatisé, validation PO requise
> Branche : `main` — état au commit `63e547a` (C9) + recette
> Périmètre : C1 → C9 du Sprint 5 (Centre de notifications, Audit, Pilotage, Rétention, Perf)

## 1. Méthodologie

Fixtures Sprint 3 C10 réutilisées (`recette-editor-s3`, `recette-user-b-s3`, `admin@veille.local`, Site A/B). Notifications créées en C3 ont été utilisées comme dataset. 3 cookies curl (`/tmp/c_admin.txt`, `/tmp/c_editor.txt`, `/tmp/c_userb.txt`).

Tests :
- API REST via curl + Python pour assertions JSON
- Preview MCP pour responsive 320 / 375 / 768 / desktop (C5 à C7)
- Vitest pour les helpers purs (237 verts)
- Mesures perf : médianes 3 samples à chaud (warm-up préalable)

## 2. Notifications (lots A + E + F)

### Accès
| Acteur | `/api/notifications` |
|---|---|
| Sans cookie | **401** ✅ |
| USER-B | **200** ✅ |
| EDITOR | **200** ✅ |
| ADMIN | **200** ✅ |

### Création automatique (C3)
| Type | Détecté en DB |
|---|---|
| `ACTION_ASSIGNED_TO_ME` | **2** ✅ |
| `ACTION_VALIDATED_ON_MY_ACTION` | **2** ✅ |
| `VISIT_FINISHED_ON_MY_SITE` | 0 (couvert tests unitaires C3, non re-déclenché ici) |
| `ECHEANCE_CRITICAL_ON_MY_PERIMETER` | **72** ✅ |

### Déduplication
- 2e fetch `/today` EDITOR n'a pas créé de notifs supplémentaires (P2002 silencieux) → confirmé en C3.
- Contrainte `@@unique([userId, dedupKey])` testée en DB.

### `targetUrl`
- Toutes les notifs portent `targetUrl` exploitable.
- Click row → navigation vers la cible (vérifié C5).

### Cloisonnement
| Acteur | `unreadCount` | Items visibles |
|---|---|---|
| EDITOR | 0 (tout marqué lu en C5) | Ses propres notifs |
| ADMIN | 1 | Sa notif `ACTION_ASSIGNED_TO_ME` |
| USER-B | 0 | Aucune (jamais destinataire) ✅ pas de fuite |

### Centre `/notifications` (C5)
| Fonctionnalité | Vérifié | Statut |
|---|---|---|
| Page accessible USER+EDITOR+ADMIN | preview C5 | ✅ |
| Liste avec pastilles colorées par type | preview C5 | ✅ |
| Filtre `unread` → tous `readAt=null` | curl T3 | ✅ |
| Filtre `read` → tous `readAt!=null` | curl T4 | ✅ |
| Marquage individuel + optimistic UI | preview C5 | ✅ |
| « Tout marquer comme lu » | preview C5 + unreadCount → 0 | ✅ |
| Pagination cursor `?limit=5` | page1 / page2 distinctes | ✅ |
| Badge dans header mobile + sidebar desktop | preview C5 | ✅ |
| Aucune entrée bottom-nav | preview C5 | ✅ |

## 3. Audit ADMIN (lot B + G)

### Accès
| Acteur | `/api/admin/audit` | `/admin/audit` |
|---|---|---|
| USER-B | **403** ✅ | 307 redirect ✅ |
| EDITOR | **403** ✅ | 307 redirect ✅ |
| ADMIN | **200** ✅ | 200 ✅ |

### Fonctionnel
| Test | Résultat |
|---|---|
| Filtre `?action=RETENTION_PURGE` | 3 entrées récupérées, `filtersApplied.action="RETENTION_PURGE"` ✅ |
| Filtres URL persistants | `?from=…&to=…&userId=…&action=…` propagés ✅ |
| Pagination cursor « Afficher 50 de plus » | C6 ✅ |
| Export CSV `Content-Type: text/csv; charset=utf-8` | ✅ |
| Export CSV `Content-Disposition: attachment; filename="audit-…csv"` | ✅ |
| Export CSV `X-Audit-Truncated: 0` | ✅ (volume < 10 000) |
| Détail JSON expandable par ligne | preview C6 ✅ |
| Mobile responsive (320, 375) | preview C6 ✅ aucun overflow |

## 4. Dashboard Pilotage (lots D + H)

### Accès
| Acteur | `/dashboard` |
|---|---|
| USER-B | **307** redirect `/today` ✅ |
| EDITOR | **200** ✅ |
| ADMIN | **200** ✅ |

### Contenu
- EDITOR : sous-titre **« Périmètre de mes équipes »**, filtre équipe **masqué** ✅
- ADMIN : sous-titre **« Vue globale »**, dropdown **« Toutes les équipes »** présent ✅
- 6 KPI affichés (Échéances critiques, Actions ouvertes, Actions en retard, Sites sans visite trim, Sites sans visite plan, Équipements expirés) — chiffres remontés par `aggregateDashboard`
- 4 sparklines SVG natives (Activité, Notifications créées, Visites réalisées, Actions validées)
- Filtre période 30 / 90 jours via chips URL `?period=`
- Responsive 320 / 375 / 768 / desktop validé en C7 (aucun overflow)

## 5. Rétention (lot I)

### Accès
| Acteur | POST `/api/admin/maintenance/purge` |
|---|---|
| Sans cookie | **401** ✅ |
| USER-B | **403** ✅ |
| EDITOR | **403** ✅ |
| ADMIN | **200** ✅ |

### Comportement
| Test | Résultat |
|---|---|
| Dry-run par défaut (sans param) | `dryRun=true`, seuils 90/180/180/365, `detected=0/deleted=0` (dataset < 365 j) ✅ |
| `?dryRun=false` | `dryRun=false`, `detected=0/deleted=0`, **AuditLog `RETENTION_PURGE` créé** (vérifié C8) ✅ |
| Idempotence (2e apply immédiat) | `detected=0/deleted=0` ✅ |
| Seuils respectés | `notificationsRead=90`, `notificationsUnread=180`, `teamActivity=180`, `auditLog=365` ✅ |

3 entrées `AuditLog action=RETENTION_PURGE` retrouvées dans l'audit (cumul C8 + C10).

## 6. Performance (lot J)

Médianes 3 samples à chaud (port 3002, dataset 323 échéances + 76 notifs + 53 audit logs) :

| Route | Médiane | Cible | Statut |
|---|---|---|---|
| `/today` (EDITOR) | **423 ms** | < 500 ms | ✅ |
| `/notifications` (EDITOR) | **89 ms** | < 500 ms | ✅ |
| `/admin/audit` (ADMIN) | **87 ms** | < 500 ms | ✅ |
| `/dashboard` (EDITOR) | **116 ms** | < 500 ms | ✅ |
| `/api/echeances` (EDITOR) | **23 ms** | < 500 ms | ✅ |

Toutes les routes sous 500 ms. `/today` est la plus lente — fan-out complet de C7 critique (badge + 6 sources Sprint 2) + side-effect `notifyEcheancesCriticalForUser` via `after()`.

## 7. Responsive

Vérifications preview MCP par commit :
| Page | 320 | 375 | 768 | Desktop |
|---|---|---|---|---|
| `/notifications` (C5) | ✅ | ✅ | ✅ | ✅ |
| `/admin/audit` (C6) | ✅ | ✅ | ✅ | ✅ |
| `/dashboard` (C7) | ✅ | ✅ | ✅ | ✅ |
| Badge header mobile + sidebar (C5) | ✅ | ✅ | ✅ | ✅ |

Aucun overflow horizontal (`scrollWidth === clientWidth`). Bottom-nav fixe préservée.

## 8. Sécurité (lots A + B + C + D)

| Fonctionnalité | USER | EDITOR | ADMIN | No-auth |
|---|---|---|---|---|
| `/api/notifications` | 200 (perso) | 200 (perso) | 200 (perso) | 401 |
| `/notifications` (page) | 200 (perso) | 200 (perso) | 200 (perso) | 307 login |
| `/api/admin/audit` | 403 | 403 | 200 | 401 |
| `/admin/audit` (page) | 307 today | 307 today | 200 | 307 login |
| `/api/admin/maintenance/purge` | 403 | 403 | 200 | 401 |
| `/dashboard` (page) | 307 today | 200 (scope) | 200 (global) | 307 login |
| `/api/admin/audit/export.csv` | 403 | 403 | 200 | 401 |

**Cloisonnement notifications confirmé** : USER-B ne voit aucune notif d'un autre user (`unreadCount=0`, 0 items).
**Audit / purge ADMIN-only confirmé** : EDITOR bloqué.

## 9. Migrations Prisma (lot K)

5 migrations cumulées (Sprint 3 → Sprint 5), toutes appliquées :
```
0_init
20260614093408_add_site_is_occupied      (S3 C3)
20260614103126_add_team_activity          (S3 C6)
20260614163330_add_notification           (S5 C2)
20260614202524_perf_indexes               (S5 C9)
```

`prisma migrate status` → **« Database schema is up to date! »** ✅
`migration_lock.toml` → provider sqlite ✅

## 10. Couverture Vitest (lot L)

```
Test Files  16 passed (16)
     Tests  237 passed (237)
```

Décomposition Sprint 5 :
- `notifications.test.ts` — 15 (C2)
- `notifications-generators.test.ts` — 19 (C3)
- `notifications-aggregator.test.ts` — 19 (C4)
- `retention.test.ts` — 7 (C8)

Plus 177 tests Sprint 1-4. `tsc --noEmit` → **clean**.

## 11. Bugs / réserves / dette

### Bugs bloquants
**Aucun.**

### Bugs mineurs
**Aucun.**

### Réserves & limites assumées
| # | Sujet | Détail / mitigation |
|---|---|---|
| L1 | **Cron externe requis** pour la rétention | Pas de cron interne (D7). Sans cron externe, la base grossira indéfiniment. Documenté ; cf. § Actions pré-prod. |
| L2 | **Polling 60 s pour le badge non-lues** | Acceptable V1 (consigne PO). À reconsidérer si demande temps réel (WebSocket/SSE). |
| L3 | **Tendance « Notifications créées »** | ADMIN voit le global, EDITOR voit ses propres notifs (`Notification.userId` pas team-scoped). Documenté en C7. |
| L4 | **`VISIT_FINISHED_ON_MY_SITE` non testé runtime** | Couvert par tests unitaires C3 + pattern identique aux 2 autres types. À déclencher manuellement en recette de prod. |
| L5 | **Premier load `/today` EDITOR crée 72 notifs critiques d'un coup** | Dédup ensuite, mais volume initial à anticiper sur prod. Documenté en C3. |
| L6 | **Filtres `/notifications` non persistés dans l'URL** | Différent du Hub. Décision V1 simplifiée. |
| L7 | **Export CSV plafonné à 10 000 lignes** | Au-delà, header `X-Audit-Truncated: 1`. Pour grosses bases, streaming V2+. |
| L8 | **Indexes Prisma : gain marginal sur volume V1** | Bénéfice principal = prévention dégradation prod. Mesures faibles attendues sur dataset modeste. |
| L9 | **Pas d'API key dédiée pour le cron** | Cookie ADMIN requis — sensible au renouvellement. Compte `svc-cron@…` recommandé. |
| L10 | **`details` JSON dans AuditLog** peut contenir IPs/UA (login fail) | Accès ADMIN uniquement, conformité RGPD respectée. |
| L11 | **Réception `Cache-Control: private, max-age=10`** sur `/api/notifications` | Badge non-lues peut être en retard de quelques secondes. Polling 60 s rattrape. |

### Dette technique
- **Pas de UI de purge** : ADMIN doit utiliser curl ou Postman. À enrichir Sprint 6+ avec `/admin/maintenance` (bouton + dernier rapport).
- **Pas de API key maintenance** : authentification cron par Cookie de session.
- **Convention slug visite** (Sprint 3-4) toujours utilisée : `trimestrielle-*` / `planifiee-*` — voir SPRINT4-RECETTE.md L3.
- **Compteur Today refait 3 requêtes Prisma** pour le badge critique (C7 Sprint 4) — légère duplication, acceptable car parallèle.

## 12. Risques de déploiement

| # | Risque | Probabilité | Sévérité | Mitigation |
|---|---|---|---|---|
| R1 | **Cron externe oublié** → base grossit sans purge | élevée | moyenne | Documenter, mettre en place dès le déploiement |
| R2 | Premier load `/today` EDITOR sur prod crée des centaines de notifs critiques | élevée | basse | Comportement attendu, dédup prévient les répétitions |
| R3 | Cookie cron expiré → purge silencieusement OK 401 | moyenne | moyenne | Monitoring du log + compte `svc-cron@` long-lived |
| R4 | Volumes notifs explosent (mauvaise dédup) | basse | élevée | `@@unique([userId, dedupKey])` au niveau DB. Audit volume hebdo. |
| R5 | Performance dégrade avec dataset prod réel | moyenne | moyenne | Indexes C9 posés. Re-mesurer en prod. |
| R6 | Régression sur les fonctionnalités Sprint 1-4 | basse | élevée | 237 tests verts, aucune modification métier en C9 |
| R7 | Migration `perf_indexes` lente sur SQLite prod | basse | basse | 3 `CREATE INDEX` additifs ; lock bref attendu sur table SiteVisit (la plus volumineuse) |
| R8 | RGPD : Notification garde userId | basse | élevée | onDelete: Cascade sur User (S5 C2) + rétention 90/180 j |
| R9 | Export CSV expose des emails utilisateur | basse | basse | Accès ADMIN uniquement (D4) |
| R10 | Volumétrie audit explose si mutations massives | basse | moyenne | Rétention 365 j + purge automatique |

## 13. Actions pré-production

**Obligatoires (6)** :
1. `pnpm exec prisma migrate deploy` — applique les 5 migrations cumulées (incl. `perf_indexes` C9).
2. Vérifier `ENABLE_ECHEANCES` (déjà déployé Sprint 4) reste `true` ou absent.
3. **Configurer le cron externe** pour la rétention (cf. §14 commande recommandée).
4. **Créer le compte ADMIN dédié** `svc-cron@<host>` (compte technique, password long, non utilisé en interactif).
5. Vérifier en pre-deploy que les routes critiques restent < 500 ms sur dataset réel.
6. Sanity check post-déploiement : login ADMIN → `/admin/audit` → `/dashboard` → vérifier badge bell + notifications.

**Recommandées (4)** :
7. Smoke test : créer une action de test en EDITOR → vérifier que l'ADMIN reçoit `ACTION_ASSIGNED_TO_ME`.
8. Mesurer perf des routes critiques après 1 semaine de production réelle.
9. Mettre en place rotation log `/var/log/veille-retention.log` (logrotate hebdo).
10. Documenter dans le guide utilisateur le badge bell et le centre de notifications.

**Optionnelles (3)** :
11. Premier lancement de la purge en dry-run pour anticiper les volumes.
12. Alertes Sentry sur `notification.create.failed` et `retention.audit.failed`.
13. Page d'aide utilisateur expliquant la différence Notifications (perso) vs ActivityFeed (équipe) vs Today (tournée).

## 14. Cron externe recommandé

```cron
# Quotidien à 03:00 UTC — purge réelle des données expirées
# Compte service `svc-cron@veille.local` (ADMIN dédié)
# Cookie pré-renouvelé hebdo via job dédié

0 3 * * * curl -s -X POST \
  -H "Cookie: veille-auth=$ADMIN_COOKIE" \
  -H "Content-Type: application/json" \
  -d '{"dryRun":false}' \
  "https://app.veille.local/api/admin/maintenance/purge" \
  >> /var/log/veille-retention.log 2>&1
```

**Pré-requis** :
- `$ADMIN_COOKIE` géré en variable d'env du système cron (jamais en clair dans le crontab).
- Compte `svc-cron@veille.local` créé avec role=ADMIN.
- Rotation log hebdo (`logrotate`).
- Alerte si `deleted` > N (envoi mail/Slack) — script post-purge.

**Vérification dry-run** (1 fois par mois) :
```bash
curl -s -X POST -H "Cookie: …" \
  "https://app.veille.local/api/admin/maintenance/purge?dryRun=true" | jq
```

## 15. SHA Git

Recette jouée sur le commit `63e547a` (C9 — perf_indexes).
Le présent rapport sera committé en SHA distinct (C10) — référencé à la livraison.

Commits Sprint 5 :
- C1 (plan) : `c0079bc` (Sprint 4 — déjà committé) puis `6723b34` (Sprint 5 plan)
- C2 (modèle Notification) : `c72eb2f`
- C3 (génération auto 4 types) : `9252a41`
- C4 (route /api/notifications) : `6355748`
- C5 (UI Centre + badge) : `d31241a`
- C6 (Audit ADMIN) : `ca7c5e2`
- C7 (Dashboard Pilotage) : `4a27760`
- C8 (Rétention) : `7a3d047`
- C9 (Perf indexes) : `63e547a`
- **C10 (recette)** : à committer
