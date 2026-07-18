-- CreateTable
CREATE TABLE "CilIncident" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "teamId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "reference" TEXT,
    "type" TEXT NOT NULL,
    "typeLibre" TEXT,
    "occurredAt" DATETIME NOT NULL,
    "lieu" TEXT NOT NULL,
    "poste" TEXT,
    "voie" TEXT,
    "observations" TEXT,
    "cilNom" TEXT,
    "cilPrenom" TEXT,
    "cilEtablissement" TEXT,
    "designatedAt" DATETIME,
    "arrivedOnSiteAt" DATETIME,
    "closedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "CilIncident_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "CilIncident_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CilEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "incidentId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "occurredAt" DATETIME NOT NULL,
    "seq" INTEGER NOT NULL,
    "label" TEXT NOT NULL,
    "note" TEXT,
    "actorId" TEXT,
    "actorName" TEXT,
    "refType" TEXT,
    "refId" TEXT,
    "metadata" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CilEvent_incidentId_fkey" FOREIGN KEY ("incidentId") REFERENCES "CilIncident" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CilDepeche" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "incidentId" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "subtype" TEXT NOT NULL,
    "sens" TEXT,
    "texte" TEXT NOT NULL,
    "numeroDonne" INTEGER NOT NULL,
    "numeroRecu" TEXT,
    "collationne" BOOLEAN NOT NULL DEFAULT false,
    "avisCrcAt" DATETIME,
    "avisCosAt" DATETIME,
    "avisOpjAt" DATETIME,
    "departEffectifAt" DATETIME,
    "repriseAuthorization" TEXT,
    "metadata" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CilDepeche_incidentId_fkey" FOREIGN KEY ("incidentId") REFERENCES "CilIncident" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CilDepecheDestinataire" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "depecheId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "numeroRecu" TEXT,
    CONSTRAINT "CilDepecheDestinataire_depecheId_fkey" FOREIGN KEY ("depecheId") REFERENCES "CilDepeche" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CilIntervenant" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "incidentId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "typeLibre" TEXT,
    "nom" TEXT,
    "tel" TEXT,
    "arrivedAt" DATETIME,
    "departedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CilIntervenant_incidentId_fkey" FOREIGN KEY ("incidentId") REFERENCES "CilIncident" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CilSignature" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "incidentId" TEXT NOT NULL,
    "ownerType" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "signerName" TEXT,
    "signerRole" TEXT,
    "imageB64" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CilSignature_incidentId_fkey" FOREIGN KEY ("incidentId") REFERENCES "CilIncident" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "CilIncident_teamId_status_idx" ON "CilIncident"("teamId", "status");

-- CreateIndex
CREATE INDEX "CilIncident_authorId_idx" ON "CilIncident"("authorId");

-- CreateIndex
CREATE INDEX "CilEvent_incidentId_occurredAt_seq_idx" ON "CilEvent"("incidentId", "occurredAt", "seq");

-- CreateIndex
CREATE UNIQUE INDEX "CilDepeche_eventId_key" ON "CilDepeche"("eventId");

-- CreateIndex
CREATE INDEX "CilDepeche_incidentId_subtype_idx" ON "CilDepeche"("incidentId", "subtype");

-- CreateIndex
CREATE UNIQUE INDEX "CilDepeche_incidentId_numeroDonne_key" ON "CilDepeche"("incidentId", "numeroDonne");

-- CreateIndex
CREATE INDEX "CilDepecheDestinataire_depecheId_idx" ON "CilDepecheDestinataire"("depecheId");

-- CreateIndex
CREATE INDEX "CilIntervenant_incidentId_idx" ON "CilIntervenant"("incidentId");

-- CreateIndex
CREATE INDEX "CilSignature_incidentId_idx" ON "CilSignature"("incidentId");

-- CreateIndex
CREATE INDEX "CilSignature_ownerType_ownerId_idx" ON "CilSignature"("ownerType", "ownerId");
