# `data/` — stockage privé du serveur

Dossier hors `public/`, **jamais servi directement par Next**.

Contenu :

- `uploads/photos/` — photos uploadées via la route `/api/photos`. Lecture
  uniquement via la route auth `/api/photos/[id]/file` (Sprint 3 C9).

Variables d'environnement :

- `VEILLE_PRIVATE_UPLOAD_DIR` — surcharge la racine `data/uploads` (utile
  pour pointer un volume monté en production).

Le dossier `public/uploads/` reste utilisé pour les anciennes photos tant
que `scripts/migrate-uploads-to-private.ts` n'a pas été joué. La route
streaming sait servir les deux formats.
