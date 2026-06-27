# Jeu de données de préproduction / test

Seed reproductible pour exécuter le plan de test [`docs/PLAN-TEST-PREPROD.md`](../../docs/PLAN-TEST-PREPROD.md).

> ⚠️ **Données de TEST uniquement.** Ne jamais exécuter sur une base de production.
> Tout est identifiable (`id` préfixés `pp-`, équipes `PREPROD-*`, emails `@preprod.test`,
> matricules `PP…`, sites `PP-SITE-*`) et entièrement réversible.

## Commandes

```bash
# Créer / mettre à jour le jeu de test (idempotent)
npm run db:seed:preprod

# Tout supprimer (seed + données générées pendant les tests)
npm run db:seed:preprod:clean

# Repartir d'un état propre : cleanup puis re-seed
npm run db:seed:preprod:clean && npm run db:seed:preprod
```

Garde-fou : si `NODE_ENV=production`, les scripts refusent de s'exécuter.
Pour forcer (préprod jetable uniquement) : ajouter `-- --force`.
La cible `DATABASE_URL` (masquée) est toujours affichée avant exécution.

## Comptes créés

Mot de passe commun : **`Preprod2026!`**

| Email | Rôle | Équipes | Profil |
|---|---|---|---|
| `preprod.user.mono@preprod.test` | USER | A | USER mono-équipe |
| `preprod.user.multi@preprod.test` | USER | A + B | USER multi-équipes |
| `preprod.editor.mono@preprod.test` | EDITOR | A | EDITOR mono-équipe |
| `preprod.editor.multi@preprod.test` | EDITOR | A + B | EDITOR multi-équipes |
| `preprod.admin.team@preprod.test` | ADMIN | A | ADMIN vue équipe (`TEAM`=A) |
| `preprod.admin.global@preprod.test` | ADMIN | A | ADMIN vue globale (`GLOBAL`) |

## Données créées

- **2 équipes** : `PREPROD-A`, `PREPROD-B`.
- **3 agents** : A (`PP000001`), B (`PP000002`), **partagé A+B** (`PP000003`).
- **3 sites** : A, B, **partagé A+B**. **1 véhicule** (équipe A).
- **Actions** (équipe A sauf mention) :
  - états d'échéance : sans échéance · à venir (J+3) · planifiée (J+30) · en retard (J-1) · en retard critique (J-30) ;
  - cycle de vie : validée (avec validation) · obsolète · remplacée · réalisée via import ;
  - **groupe de 3 doublons** même `dedupHash` (badge ×3) ;
  - **sans `dedupHash`** (ne doit jamais être groupée) ;
  - **même `dedupHash`, équipes A ≠ B** sur l'agent partagé (vérifie l'absence de fusion) ;
  - action sur site ; actions d'auto-validation (A proposée, B exclue par cloisonnement) ; action liée à une NC.
- **Planning A et B** (créneaux du jour, agent partagé présent dans les deux).
- **Pointages** (`AgentSighting`, réf `pointage-PP-*`).
- **Session de veille** équipe A (à clôturer → teste clôture + auto-validation).
- **Visite de site + non-conformité** liée à une action (si un template de visite existe).
- **Notifications** de test (1 par USER).

Matricule **inconnu** à placer dans un fichier de planning pour tester
« agent inconnu ignoré » : **`PP999999`** (volontairement non créé).

## Notes

- **Idempotent** : ré-exécuter `db:seed:preprod` ne crée pas de doublon (upsert par `id` stable).
- La **visite + NC** nécessite au moins un `SiteVisitTemplate`. S'il n'y en a pas,
  lancer d'abord `npm run db:seed` (seed principal, qui seede les templates) ;
  sinon l'action `PP-ACT-NC` est tout de même créée (validable seule).
- Le **cleanup** supprime aussi les données produites par l'app pendant les tests
  (validations, sightings, sessions, visites, activités, notifications) tant
  qu'elles sont rattachées aux équipes/comptes préprod.
- Limite connue : des **photos** attachées manuellement à des sightings/observations
  préprod pendant les tests peuvent bloquer le cleanup (contrainte FK) ; les retirer
  d'abord le cas échéant. Le seed n'en crée aucune.
