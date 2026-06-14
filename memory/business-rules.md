# Règles métier — Veille

> **Statut** : règles validées par le PO.
> **Dernière mise à jour** : 2026-06-14.
> Ce document fait foi en cas d'écart avec un autre document de conception.

## Visites

Il existe deux mécanismes distincts et indépendants.

### Visite trimestrielle

Fréquence fixe :

- tous les 90 jours
- quel que soit le type de site

Cette visite doit toujours être suivie.

### Visite planifiée

La fréquence dépend de la nature du site.

Site occupé :

- 180 jours

Site inoccupé :

- 365 jours

La nature occupé/inoccupé est portée par le paramètre `Site.isOccupied`.

Les visites trimestrielles et les visites planifiées doivent être suivies séparément dans le futur Hub Échéances.

## Sites

Un site peut appartenir à une ou plusieurs équipes.

Le cloisonnement des données repose sur les équipes.

Comme les agents, les sites sont multi-équipes.

## Notifications

Lorsqu'un utilisateur est ajouté à une équipe :

- tous les membres de cette équipe reçoivent une notification.

Lorsqu'un site est ajouté à une équipe :

- tous les membres de cette équipe reçoivent une notification.

Lorsqu'un utilisateur est retiré d'une équipe :

- tous les membres de cette équipe reçoivent une notification.

Lorsqu'un site est retiré d'une équipe :

- tous les membres de cette équipe reçoivent une notification.

## Audio

Toute fonctionnalité audio, dictée, reconnaissance vocale ou assistant vocal est abandonnée définitivement.

Ne plus proposer ni planifier de développements liés à l'audio.
