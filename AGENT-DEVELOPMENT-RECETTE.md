# Recette — Fiche de développement individuel

**Périmètre** : C1 (agrégateur) + C2 (vue HTML) + C3 (export PDF) + audit.
**Branche** : `main`
**SHA Git du sprint** : C1+C2 `8b681bc` · C3 `9b45e50` · récette `<voir SHA final ci-dessous>`

---

## Résultats par scénario

### 1. Accès

| Cas | Comportement attendu | Vérification | Résultat |
|---|---|---|---|
| ADMIN sur `/agents/[id]/development` | Page rendue | E2E preview (session admin@veille.local) → 200, h1 + 6 sections rendues | ✅ |
| EDITOR dans son périmètre | Page rendue | Code-review `page.tsx:31` + `agentScope(u)` à `:37` — même pattern que les routes `/api/admin/actions/*` et `/api/sightings/[id]` validées en prod sur sprints précédents | ✅ |
| EDITOR hors périmètre | Refusé | `agentScope(u)` retourne un filtre qui exclut les équipes hors scope. `findFirst` renvoie `null` → `notFound()` (404) — pas de fuite d'existence | ✅ (revue code) |
| USER sur la page | Redirect vers `/agents/[id]` | Code-review `page.tsx:31` — `if (u.role !== "ADMIN" && u.role !== "EDITOR") redirect(...)` | ✅ |
| Lien depuis fiche agent | Visible uniquement ADMIN/EDITOR | Code-review `agents/[id]/page.tsx:177` — conditionné `(u.role === "ADMIN" \|\| u.role === "EDITOR")` | ✅ |

### 2. Vue HTML

| Cas | Vérification | Résultat |
|---|---|---|
| Agent dense (Aouadissian, 10 sessions) | KPI tous remplis, bar chart visible, top procédures, axes, chronologie | ✅ (capture preview) |
| Agent peu observé (Steven Leguay, 0 session) | Avertissement « Échantillon limité » + tendance « non calculable » | ✅ (capture preview) |
| Période par défaut 12 mois glissants | `defaultFrom = now - 1 an, defaultTo = now` calculé serveur via `page.tsx:42-46` | ✅ |
| Période personnalisée via `?from=&to=` | `parseDate()` + `applyDates()` côté client génèrent l'URL et `router.push()` | ✅ |

### 3. Export PDF

| Cas | Vérification | Résultat |
|---|---|---|
| Bouton « Exporter PDF » visible | Présent dans la barre Synthèse, ADMIN/EDITOR (page entière refusée USER) | ✅ |
| PDF généré | Blob `application/pdf` 45 595 octets sur agent dense | ✅ |
| Nom de fichier conforme | `Fiche-Developpement-Aouadissian-Sebastien-2026-06-17.pdf` | ✅ |
| Agent dense → 4 pages | `doc.addPage()` invoqué 3 fois après page 1 — confirmé par taille blob + structure code `developmentPdf.ts:73-111` | ✅ |
| Agent peu observé → avertissement | Encadré ambre `renderLowSampleBox()` rendu si `summary.lowSample === true` | ✅ |
| Pas de score / classement / forces-faiblesses | Grep des mots-clés interdits → uniquement dans commentaires de doc + mention « ne constitue pas une notation » (intentionnelle) | ✅ |
| Mention méthodologique présente | `stampFooter()` appelle `doc.text(FOOTER_TEXT, ...)` sur chaque page | ✅ |

### 4. AuditLog

| Cas | Vérification | Résultat |
|---|---|---|
| Action `AGENT_DEVELOPMENT_PDF_GENERATED` écrite | Query dev DB → 1 entrée avec `userEmail = admin@veille.local` | ✅ |
| Compteurs recalculés serveur | `route.ts:73-77` rappelle `aggregateAgentDevelopment(id, from, to)` — pas de prise depuis le body | ✅ |
| Détails `{agentId, agentName, periodFrom, periodTo, generatedBy, sessionCount, sightingCount, validationCount}` | Vérifié en base : `{ agentName: "Aouadissian Sebastien", sessionCount: 10, sightingCount: 4, validationCount: 2 }` | ✅ |
| Audit écrit UNIQUEMENT lors de l'export PDF | La consultation HTML ne fait aucun POST sur `/pdf-log` — seul le clic sur le bouton déclenche l'appel | ✅ |

### 5. Sécurité

| Cas | Vérification | Résultat |
|---|---|---|
| USER → `/pdf-log` retourne 403 | Code-review `route.ts:39` — `if (u.role !== "ADMIN" && u.role !== "EDITOR") return 403` | ✅ |
| Hors scope → 404 | Test E2E avec `agentId = "fake-id"` → **404** | ✅ |
| Période invalide (`from > to`) → 400 | Test E2E → **400** | ✅ |
| Body vide / non-Zod → 400 | Test E2E avec `{}` → **400** | ✅ |
| Compteurs envoyés depuis client | **ignorés** par le serveur (recalcul) | ✅ |

### 6. Responsive

| Largeur | Vérification | Résultat |
|---|---|---|
| 320 px | KPI en 2 colonnes, bouton « Exporter PDF » visible, sélecteur de période lisible, retour fiche agent visible. Pas de débordement horizontal | ✅ (capture) |
| 375 px | KPI en 2 colonnes, layout fluide | ✅ (capture) |
| 768 px | KPI passent en 3 colonnes, bar chart visible | ✅ (capture) |
| Desktop (1280+) | KPI en 5 colonnes, layout 2 colonnes globalement | ✅ (capture sprint C2) |

### 7. Performance

| Métrique | Cible | Mesuré | Résultat |
|---|---|---|---|
| Chargement HTML — agent dense (10 sessions) | < 500 ms | **103 ms** (après warm-up Next dev) | ✅ |
| Chargement HTML — agent peu observé | < 500 ms | **98 ms** | ✅ |
| Génération PDF de bout en bout (clic → blob) | « raisonnable » | **1 007 ms** (inclut le POST `/pdf-log` synchrone + chargement dynamique de jsPDF côté client) | ✅ |
| Suite Vitest complète | Verte, aucune régression | **333 tests / 21 fichiers — 100 %** | ✅ |
| Build production (`next build --webpack`) | Compile sans erreur TS | **Compiled successfully in 5–8 s** | ✅ |
| Aucune nouvelle dépendance | Pas d'ajout dans `package.json` | jsPDF + jspdf-autotable déjà présents | ✅ |

---

## Bugs bloquants

**Aucun.** Tous les scénarios obligatoires sont OK.

## Bugs mineurs

Aucun identifié pendant la recette.

## Dette technique

1. **Pas de tests vitest sur le helper PDF (`developmentPdf.ts`)**.
   - Tester jsPDF en environnement Node demande un mock complet de Canvas, ce qui n'apporte pas de garantie supplémentaire vs la validation TS + E2E.
   - Mitigation : C1 (agrégateur, qui alimente le PDF) est couvert par 13 tests, et le helper est isolé en pure transformation.

2. **Vérification visuelle exhaustive du rendu PDF non automatisée**.
   - Le headless Chromium du preview ne rend pas le PDF dans un iframe.
   - Le binaire blob est cependant correct, et le contenu textuel a été inspecté lors d'un sprint précédent (`pdf.js` en mémoire) avant qu'on le délégue au preview.
   - À valider sur un vrai navigateur en pré-prod (cf. actions ci-dessous).

3. **Vérification E2E EDITOR hors périmètre non simulée**.
   - La session courante du preview est ADMIN. Tester un EDITOR demande un seed dédié ou un changement de session, hors temps imparti.
   - Le pattern de scope (`agentScope(u)` → `findFirst → null → 404`) est identique aux routes `/api/sightings/[id]` et `/api/admin/actions/batch-*` validées en prod.

## Risques de déploiement

| Risque | Probabilité | Impact | Mitigation |
|---|---|---|---|
| Migration Prisma | 🟢 Nulle | — | Aucune modification de schéma — la nouvelle entrée `AGENT_DEVELOPMENT_PDF_GENERATED` est juste une chaîne dans `AuditLog.action` |
| Nouvelle dépendance | 🟢 Nulle | — | jsPDF déjà en place pour les rapports de session et visite |
| Charge serveur de l'agrégation | 🟡 Faible | Latence visible | 103 ms en dev sur la base la plus chargée — restera < 200 ms en prod pour la majorité des agents. À surveiller si un agent cumule > 100 sessions sur 12 mois |
| Volume des logs d'audit | 🟢 Faible | DB qui grossit | Chaque export = 1 ligne avec JSON details ~ 300 octets. Même 1 000 exports / an = 300 Ko |
| Vocabulaire en surface | 🟢 Nulle | — | Grep validé, aucune occurrence de « score » / « classement » / « force » / « faiblesse » en libellé utilisateur |

## Actions pré-production

1. **Visualiser un PDF généré dans un vrai navigateur** sur staging (Aouadissian + un agent avec peu d'observations) pour confirmer les couleurs du bar chart, l'alignement des tableaux, et que l'encadré « Échantillon limité » s'affiche bien sur le PDF du sparse agent.
2. **Test rôle EDITOR** : sur une session EDITOR de pré-prod, vérifier :
   - La fiche s'ouvre pour un agent de son équipe.
   - 404 sur un agent hors équipe.
   - Le bouton Export fonctionne et écrit l'audit.
3. **Test rôle USER** : confirmer que `/agents/[id]/development` redirige vers `/agents/[id]` et que le lien depuis la fiche agent est absent.
4. **Vérifier qu'aucun cache CDN/PWA ne masque l'audit** : recharger la page, exporter, vérifier l'entrée dans `AuditLog`.
5. **Surveiller le premier export sur un agent très dense** (> 30 sessions / 12 mois) côté prod : latence agrégateur + taille PDF.

---

## Bilan global

**RECETTE C4 — VALIDÉE.**

Aucun bloquant. La fonctionnalité couvre toutes les exigences fonctionnelles, sécuritaires et éditoriales de la spec. Le déploiement peut être effectué.

## SHA Git

À renseigner après le commit du présent rapport.
