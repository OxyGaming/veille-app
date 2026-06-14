-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'USER',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "teamId" TEXT,
    "viewAllTeams" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "User_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "UserAgentHidden" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "hiddenAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "UserAgentHidden_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "UserAgentHidden_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "IcareEntry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "refType" TEXT NOT NULL,
    "refId" TEXT NOT NULL,
    "doneAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "doneById" TEXT NOT NULL,
    CONSTRAINT "IcareEntry_doneById_fkey" FOREIGN KEY ("doneById") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "UserTeam" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'MEMBER',
    "joinedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "UserTeam_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "UserTeam_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Team" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Agent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "matricule" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "rawLabel" TEXT,
    "teamId" TEXT,
    "posteId" TEXT,
    "secteurId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isVisible" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Agent_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Agent_posteId_fkey" FOREIGN KEY ("posteId") REFERENCES "Poste" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Agent_secteurId_fkey" FOREIGN KEY ("secteurId") REFERENCES "Secteur" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AgentTeam" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "agentId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "joinedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AgentTeam_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AgentTeam_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AgentSighting" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "agentId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "observerId" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'SIGHT',
    "comment" TEXT,
    "sightedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "externalRef" TEXT,
    CONSTRAINT "AgentSighting_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AgentSighting_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "AgentSighting_observerId_fkey" FOREIGN KEY ("observerId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SiteSighting" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "siteId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "observerId" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'SIGHT',
    "comment" TEXT,
    "sightedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "externalRef" TEXT,
    CONSTRAINT "SiteSighting_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SiteSighting_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "SiteSighting_observerId_fkey" FOREIGN KEY ("observerId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Site" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT,
    "name" TEXT NOT NULL,
    "type" TEXT,
    "address" TEXT,
    "description" TEXT,
    "teamId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isVisible" BOOLEAN NOT NULL DEFAULT true,
    "hasGreasingArea" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Site_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SiteEquipment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "siteId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "expectedQuantity" INTEGER,
    "isPerishable" BOOLEAN NOT NULL DEFAULT false,
    "expirationDate" DATETIME,
    "notes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "SiteEquipment_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SiteTeam" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "siteId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "joinedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SiteTeam_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SiteTeam_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SiteVisitTemplate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "pdfLayout" TEXT NOT NULL DEFAULT 'VEILLE',
    "kind" TEXT NOT NULL DEFAULT 'CHECKLIST',
    "expectedFrequencyDays" INTEGER,
    "metaSchema" TEXT NOT NULL DEFAULT '[]',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "SiteVisitSection" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "templateId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "icon" TEXT,
    "evalMode" TEXT NOT NULL DEFAULT 'PER_ITEM',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "category" TEXT,
    "precisions" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "SiteVisitSection_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "SiteVisitTemplate" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SiteVisitItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sectionId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "SiteVisitItem_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "SiteVisitSection" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SiteVisit" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "templateId" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "observerId" TEXT NOT NULL,
    "visitDate" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL DEFAULT 'active',
    "finishedAt" DATETIME,
    "generalComment" TEXT,
    "metadata" TEXT NOT NULL DEFAULT '{}',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "SiteVisit_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "SiteVisitTemplate" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "SiteVisit_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "SiteVisit_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "SiteVisit_observerId_fkey" FOREIGN KEY ("observerId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SiteVisitParticipant" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "visitId" TEXT NOT NULL,
    "agentId" TEXT,
    "fullName" TEXT NOT NULL,
    "function" TEXT,
    "signature" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "SiteVisitParticipant_visitId_fkey" FOREIGN KEY ("visitId") REFERENCES "SiteVisit" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SiteVisitParticipant_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SiteVisitObservation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "visitId" TEXT NOT NULL,
    "sectionId" TEXT,
    "itemId" TEXT,
    "equipmentId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "comment" TEXT,
    "present" BOOLEAN,
    "quantityObserved" INTEGER,
    "expirationDateObserved" DATETIME,
    "discrepancyType" TEXT,
    "recordedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "recordedById" TEXT,
    CONSTRAINT "SiteVisitObservation_visitId_fkey" FOREIGN KEY ("visitId") REFERENCES "SiteVisit" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SiteVisitObservation_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "SiteVisitSection" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "SiteVisitObservation_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "SiteVisitItem" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "SiteVisitObservation_equipmentId_fkey" FOREIGN KEY ("equipmentId") REFERENCES "SiteEquipment" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SiteVisitNonConformity" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "visitId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "description" TEXT NOT NULL,
    "riskIdentified" TEXT,
    "evrpCotation" TEXT,
    "proposedMeasures" TEXT,
    "responsible" TEXT,
    "plannedDate" DATETIME,
    "redressedDate" DATETIME,
    "closedDate" DATETIME,
    "generatedActionId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "SiteVisitNonConformity_visitId_fkey" FOREIGN KEY ("visitId") REFERENCES "SiteVisit" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SiteVisitNonConformity_generatedActionId_fkey" FOREIGN KEY ("generatedActionId") REFERENCES "ImportedAction" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SiteVisitReport" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "visitId" TEXT NOT NULL,
    "format" TEXT NOT NULL DEFAULT 'PDF',
    "layout" TEXT NOT NULL DEFAULT 'VEILLE',
    "storagePath" TEXT,
    "payload" TEXT NOT NULL DEFAULT '{}',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SiteVisitReport_visitId_fkey" FOREIGN KEY ("visitId") REFERENCES "SiteVisit" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Poste" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "acronym" TEXT,
    "description" TEXT
);

-- CreateTable
CREATE TABLE "Secteur" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "code" TEXT
);

-- CreateTable
CREATE TABLE "Contact" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "role" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "notes" TEXT,
    "teamId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Mnemonique" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "meaning" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Abreviation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "meaning" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Procedure" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "domain" TEXT NOT NULL,
    "theme" TEXT,
    "title" TEXT NOT NULL,
    "gravity" INTEGER NOT NULL DEFAULT 3,
    "documents" TEXT NOT NULL DEFAULT '[]',
    "risk" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "requireGeneralComment" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "ChecklistItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "procedureId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "gravity" INTEGER,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "requireCommentIfKO" BOOLEAN NOT NULL DEFAULT false,
    "requirePhotoIfKO" BOOLEAN NOT NULL DEFAULT false,
    "helpReference" TEXT,
    "helpText" TEXT,
    "historicConformPct" INTEGER,
    "historicSampleSize" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ChecklistItem_procedureId_fkey" FOREIGN KEY ("procedureId") REFERENCES "Procedure" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "VeilleSession" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "teamId" TEXT NOT NULL,
    "observerId" TEXT NOT NULL,
    "agentId" TEXT,
    "posteId" TEXT,
    "secteurId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" DATETIME,
    "generalComment" TEXT,
    "clientGeneratedId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "VeilleSession_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "VeilleSession_observerId_fkey" FOREIGN KEY ("observerId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "VeilleSession_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "VeilleSession_posteId_fkey" FOREIGN KEY ("posteId") REFERENCES "Poste" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "VeilleSession_secteurId_fkey" FOREIGN KEY ("secteurId") REFERENCES "Secteur" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ProcedureObservation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sessionId" TEXT NOT NULL,
    "procedureId" TEXT NOT NULL,
    "generalComment" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ProcedureObservation_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "VeilleSession" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ProcedureObservation_procedureId_fkey" FOREIGN KEY ("procedureId") REFERENCES "Procedure" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ObservationItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "procedureObservationId" TEXT NOT NULL,
    "checklistItemId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'NON_OBSERVE',
    "comment" TEXT,
    "recordedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "recordedById" TEXT NOT NULL,
    CONSTRAINT "ObservationItem_procedureObservationId_fkey" FOREIGN KEY ("procedureObservationId") REFERENCES "ProcedureObservation" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ObservationItem_checklistItemId_fkey" FOREIGN KEY ("checklistItemId") REFERENCES "ChecklistItem" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ObservationItem_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ObservationHistory" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "observationId" TEXT NOT NULL,
    "previousStatus" TEXT,
    "newStatus" TEXT NOT NULL,
    "previousComment" TEXT,
    "newComment" TEXT,
    "changedById" TEXT NOT NULL,
    "changedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ObservationHistory_observationId_fkey" FOREIGN KEY ("observationId") REFERENCES "ObservationItem" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Comment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sessionId" TEXT,
    "observationId" TEXT,
    "authorId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Comment_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "VeilleSession" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Comment_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Photo" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sessionId" TEXT,
    "observationId" TEXT,
    "agentSightingId" TEXT,
    "siteSightingId" TEXT,
    "uploaderId" TEXT NOT NULL,
    "storagePath" TEXT NOT NULL,
    "clientId" TEXT,
    "legend" TEXT,
    "syncStatus" TEXT NOT NULL DEFAULT 'SYNCED',
    "width" INTEGER,
    "height" INTEGER,
    "byteSize" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Photo_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "VeilleSession" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Photo_observationId_fkey" FOREIGN KEY ("observationId") REFERENCES "ObservationItem" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Photo_agentSightingId_fkey" FOREIGN KEY ("agentSightingId") REFERENCES "AgentSighting" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Photo_siteSightingId_fkey" FOREIGN KEY ("siteSightingId") REFERENCES "SiteSighting" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Photo_uploaderId_fkey" FOREIGN KEY ("uploaderId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Report" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sessionId" TEXT NOT NULL,
    "format" TEXT NOT NULL DEFAULT 'PDF',
    "storagePath" TEXT,
    "payload" TEXT NOT NULL DEFAULT '{}',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Report_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "VeilleSession" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ImportedAction" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "externalId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "agentId" TEXT,
    "siteId" TEXT,
    "procedureId" TEXT,
    "localStatus" TEXT NOT NULL DEFAULT 'ACTIVE',
    "originalStatus" TEXT,
    "type" TEXT,
    "subType" TEXT,
    "establishment" TEXT,
    "unit" TEXT,
    "secteur" TEXT,
    "veilleGroup" TEXT,
    "space" TEXT,
    "domain" TEXT,
    "theme" TEXT,
    "keyPoint" TEXT,
    "observedElement" TEXT,
    "veilleType" TEXT,
    "realizedAt" DATETIME,
    "dueAt" DATETIME,
    "closedAt" DATETIME,
    "comment" TEXT,
    "initialOwner" TEXT,
    "sharedWith" TEXT,
    "transferredTo" TEXT,
    "actionPlan" TEXT,
    "importId" TEXT,
    "lastSeenAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dedupHash" TEXT,
    "tags" TEXT NOT NULL DEFAULT '[]',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ImportedAction_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ImportedAction_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "ImportedAction_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "ImportedAction_procedureId_fkey" FOREIGN KEY ("procedureId") REFERENCES "Procedure" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "ImportedAction_importId_fkey" FOREIGN KEY ("importId") REFERENCES "ActionImport" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ActionImport" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "teamId" TEXT NOT NULL,
    "importedById" TEXT,
    "fileName" TEXT,
    "rowsTotal" INTEGER NOT NULL DEFAULT 0,
    "rowsCreated" INTEGER NOT NULL DEFAULT 0,
    "rowsUpdated" INTEGER NOT NULL DEFAULT 0,
    "rowsObsoleted" INTEGER NOT NULL DEFAULT 0,
    "rowsErrored" INTEGER NOT NULL DEFAULT 0,
    "agentsCreated" INTEGER NOT NULL DEFAULT 0,
    "unknownAgents" INTEGER NOT NULL DEFAULT 0,
    "summary" TEXT NOT NULL DEFAULT '{}',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ActionImport_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ActionValidation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "actionId" TEXT NOT NULL,
    "agentId" TEXT,
    "siteId" TEXT,
    "validatedById" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "realizedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "comment" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ActionValidation_actionId_fkey" FOREIGN KEY ("actionId") REFERENCES "ImportedAction" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ActionValidation_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "ActionValidation_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "ActionValidation_validatedById_fkey" FOREIGN KEY ("validatedById") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ActionValidation_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "LinkCategory" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "icon" TEXT,
    "color" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true
);

-- CreateTable
CREATE TABLE "Link" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "categoryId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "description" TEXT,
    "icon" TEXT,
    "color" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Link_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "LinkCategory" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT,
    "userEmail" TEXT,
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT,
    "details" TEXT NOT NULL DEFAULT '{}',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_teamId_idx" ON "User"("teamId");

-- CreateIndex
CREATE INDEX "User_isActive_idx" ON "User"("isActive");

-- CreateIndex
CREATE INDEX "UserAgentHidden_userId_idx" ON "UserAgentHidden"("userId");

-- CreateIndex
CREATE INDEX "UserAgentHidden_agentId_idx" ON "UserAgentHidden"("agentId");

-- CreateIndex
CREATE UNIQUE INDEX "UserAgentHidden_userId_agentId_key" ON "UserAgentHidden"("userId", "agentId");

-- CreateIndex
CREATE INDEX "IcareEntry_refType_refId_idx" ON "IcareEntry"("refType", "refId");

-- CreateIndex
CREATE UNIQUE INDEX "IcareEntry_refType_refId_key" ON "IcareEntry"("refType", "refId");

-- CreateIndex
CREATE INDEX "UserTeam_teamId_idx" ON "UserTeam"("teamId");

-- CreateIndex
CREATE UNIQUE INDEX "UserTeam_userId_teamId_key" ON "UserTeam"("userId", "teamId");

-- CreateIndex
CREATE UNIQUE INDEX "Team_name_key" ON "Team"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Team_code_key" ON "Team"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Agent_matricule_key" ON "Agent"("matricule");

-- CreateIndex
CREATE INDEX "Agent_teamId_idx" ON "Agent"("teamId");

-- CreateIndex
CREATE INDEX "Agent_matricule_idx" ON "Agent"("matricule");

-- CreateIndex
CREATE INDEX "Agent_lastName_firstName_idx" ON "Agent"("lastName", "firstName");

-- CreateIndex
CREATE INDEX "Agent_isVisible_idx" ON "Agent"("isVisible");

-- CreateIndex
CREATE INDEX "AgentTeam_teamId_idx" ON "AgentTeam"("teamId");

-- CreateIndex
CREATE UNIQUE INDEX "AgentTeam_agentId_teamId_key" ON "AgentTeam"("agentId", "teamId");

-- CreateIndex
CREATE UNIQUE INDEX "AgentSighting_externalRef_key" ON "AgentSighting"("externalRef");

-- CreateIndex
CREATE INDEX "AgentSighting_agentId_idx" ON "AgentSighting"("agentId");

-- CreateIndex
CREATE INDEX "AgentSighting_teamId_idx" ON "AgentSighting"("teamId");

-- CreateIndex
CREATE INDEX "AgentSighting_sightedAt_idx" ON "AgentSighting"("sightedAt");

-- CreateIndex
CREATE INDEX "AgentSighting_kind_idx" ON "AgentSighting"("kind");

-- CreateIndex
CREATE UNIQUE INDEX "SiteSighting_externalRef_key" ON "SiteSighting"("externalRef");

-- CreateIndex
CREATE INDEX "SiteSighting_siteId_idx" ON "SiteSighting"("siteId");

-- CreateIndex
CREATE INDEX "SiteSighting_teamId_idx" ON "SiteSighting"("teamId");

-- CreateIndex
CREATE INDEX "SiteSighting_sightedAt_idx" ON "SiteSighting"("sightedAt");

-- CreateIndex
CREATE INDEX "SiteSighting_kind_idx" ON "SiteSighting"("kind");

-- CreateIndex
CREATE UNIQUE INDEX "Site_code_key" ON "Site"("code");

-- CreateIndex
CREATE INDEX "Site_teamId_idx" ON "Site"("teamId");

-- CreateIndex
CREATE INDEX "Site_isVisible_idx" ON "Site"("isVisible");

-- CreateIndex
CREATE INDEX "SiteEquipment_siteId_idx" ON "SiteEquipment"("siteId");

-- CreateIndex
CREATE INDEX "SiteEquipment_category_idx" ON "SiteEquipment"("category");

-- CreateIndex
CREATE INDEX "SiteEquipment_isActive_idx" ON "SiteEquipment"("isActive");

-- CreateIndex
CREATE INDEX "SiteTeam_teamId_idx" ON "SiteTeam"("teamId");

-- CreateIndex
CREATE UNIQUE INDEX "SiteTeam_siteId_teamId_key" ON "SiteTeam"("siteId", "teamId");

-- CreateIndex
CREATE UNIQUE INDEX "SiteVisitTemplate_slug_key" ON "SiteVisitTemplate"("slug");

-- CreateIndex
CREATE INDEX "SiteVisitSection_templateId_sortOrder_idx" ON "SiteVisitSection"("templateId", "sortOrder");

-- CreateIndex
CREATE INDEX "SiteVisitItem_sectionId_sortOrder_idx" ON "SiteVisitItem"("sectionId", "sortOrder");

-- CreateIndex
CREATE INDEX "SiteVisit_siteId_idx" ON "SiteVisit"("siteId");

-- CreateIndex
CREATE INDEX "SiteVisit_teamId_idx" ON "SiteVisit"("teamId");

-- CreateIndex
CREATE INDEX "SiteVisit_observerId_idx" ON "SiteVisit"("observerId");

-- CreateIndex
CREATE INDEX "SiteVisit_status_idx" ON "SiteVisit"("status");

-- CreateIndex
CREATE INDEX "SiteVisit_visitDate_idx" ON "SiteVisit"("visitDate");

-- CreateIndex
CREATE INDEX "SiteVisitParticipant_visitId_idx" ON "SiteVisitParticipant"("visitId");

-- CreateIndex
CREATE INDEX "SiteVisitObservation_visitId_idx" ON "SiteVisitObservation"("visitId");

-- CreateIndex
CREATE INDEX "SiteVisitObservation_status_idx" ON "SiteVisitObservation"("status");

-- CreateIndex
CREATE INDEX "SiteVisitObservation_discrepancyType_idx" ON "SiteVisitObservation"("discrepancyType");

-- CreateIndex
CREATE INDEX "SiteVisitObservation_equipmentId_idx" ON "SiteVisitObservation"("equipmentId");

-- CreateIndex
CREATE UNIQUE INDEX "SiteVisitObservation_visitId_sectionId_itemId_key" ON "SiteVisitObservation"("visitId", "sectionId", "itemId");

-- CreateIndex
CREATE UNIQUE INDEX "SiteVisitObservation_visitId_equipmentId_key" ON "SiteVisitObservation"("visitId", "equipmentId");

-- CreateIndex
CREATE UNIQUE INDEX "SiteVisitNonConformity_generatedActionId_key" ON "SiteVisitNonConformity"("generatedActionId");

-- CreateIndex
CREATE INDEX "SiteVisitNonConformity_visitId_idx" ON "SiteVisitNonConformity"("visitId");

-- CreateIndex
CREATE INDEX "SiteVisitReport_visitId_idx" ON "SiteVisitReport"("visitId");

-- CreateIndex
CREATE UNIQUE INDEX "Poste_name_key" ON "Poste"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Secteur_name_key" ON "Secteur"("name");

-- CreateIndex
CREATE INDEX "Contact_teamId_idx" ON "Contact"("teamId");

-- CreateIndex
CREATE UNIQUE INDEX "Mnemonique_code_key" ON "Mnemonique"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Abreviation_code_key" ON "Abreviation"("code");

-- CreateIndex
CREATE INDEX "Procedure_domain_idx" ON "Procedure"("domain");

-- CreateIndex
CREATE INDEX "Procedure_isActive_idx" ON "Procedure"("isActive");

-- CreateIndex
CREATE INDEX "ChecklistItem_procedureId_sortOrder_idx" ON "ChecklistItem"("procedureId", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "VeilleSession_clientGeneratedId_key" ON "VeilleSession"("clientGeneratedId");

-- CreateIndex
CREATE INDEX "VeilleSession_teamId_idx" ON "VeilleSession"("teamId");

-- CreateIndex
CREATE INDEX "VeilleSession_observerId_idx" ON "VeilleSession"("observerId");

-- CreateIndex
CREATE INDEX "VeilleSession_agentId_idx" ON "VeilleSession"("agentId");

-- CreateIndex
CREATE INDEX "VeilleSession_status_idx" ON "VeilleSession"("status");

-- CreateIndex
CREATE INDEX "VeilleSession_startedAt_idx" ON "VeilleSession"("startedAt");

-- CreateIndex
CREATE UNIQUE INDEX "ProcedureObservation_sessionId_procedureId_key" ON "ProcedureObservation"("sessionId", "procedureId");

-- CreateIndex
CREATE INDEX "ObservationItem_status_idx" ON "ObservationItem"("status");

-- CreateIndex
CREATE UNIQUE INDEX "ObservationItem_procedureObservationId_checklistItemId_key" ON "ObservationItem"("procedureObservationId", "checklistItemId");

-- CreateIndex
CREATE INDEX "ObservationHistory_observationId_idx" ON "ObservationHistory"("observationId");

-- CreateIndex
CREATE INDEX "Comment_sessionId_idx" ON "Comment"("sessionId");

-- CreateIndex
CREATE INDEX "Comment_observationId_idx" ON "Comment"("observationId");

-- CreateIndex
CREATE INDEX "Photo_sessionId_idx" ON "Photo"("sessionId");

-- CreateIndex
CREATE INDEX "Photo_observationId_idx" ON "Photo"("observationId");

-- CreateIndex
CREATE INDEX "Photo_agentSightingId_idx" ON "Photo"("agentSightingId");

-- CreateIndex
CREATE INDEX "Photo_siteSightingId_idx" ON "Photo"("siteSightingId");

-- CreateIndex
CREATE INDEX "Photo_syncStatus_idx" ON "Photo"("syncStatus");

-- CreateIndex
CREATE INDEX "Report_sessionId_idx" ON "Report"("sessionId");

-- CreateIndex
CREATE INDEX "ImportedAction_externalId_idx" ON "ImportedAction"("externalId");

-- CreateIndex
CREATE INDEX "ImportedAction_teamId_idx" ON "ImportedAction"("teamId");

-- CreateIndex
CREATE INDEX "ImportedAction_agentId_idx" ON "ImportedAction"("agentId");

-- CreateIndex
CREATE INDEX "ImportedAction_siteId_idx" ON "ImportedAction"("siteId");

-- CreateIndex
CREATE INDEX "ImportedAction_localStatus_idx" ON "ImportedAction"("localStatus");

-- CreateIndex
CREATE INDEX "ImportedAction_dueAt_idx" ON "ImportedAction"("dueAt");

-- CreateIndex
CREATE INDEX "ImportedAction_agentId_dedupHash_idx" ON "ImportedAction"("agentId", "dedupHash");

-- CreateIndex
CREATE UNIQUE INDEX "ImportedAction_externalId_agentId_key" ON "ImportedAction"("externalId", "agentId");

-- CreateIndex
CREATE INDEX "ActionImport_teamId_idx" ON "ActionImport"("teamId");

-- CreateIndex
CREATE INDEX "ActionImport_createdAt_idx" ON "ActionImport"("createdAt");

-- CreateIndex
CREATE INDEX "ActionValidation_actionId_idx" ON "ActionValidation"("actionId");

-- CreateIndex
CREATE INDEX "ActionValidation_agentId_idx" ON "ActionValidation"("agentId");

-- CreateIndex
CREATE INDEX "ActionValidation_siteId_idx" ON "ActionValidation"("siteId");

-- CreateIndex
CREATE INDEX "ActionValidation_teamId_idx" ON "ActionValidation"("teamId");

-- CreateIndex
CREATE UNIQUE INDEX "LinkCategory_name_key" ON "LinkCategory"("name");

-- CreateIndex
CREATE INDEX "Link_categoryId_sortOrder_idx" ON "Link"("categoryId", "sortOrder");

-- CreateIndex
CREATE INDEX "AuditLog_userId_idx" ON "AuditLog"("userId");

-- CreateIndex
CREATE INDEX "AuditLog_action_idx" ON "AuditLog"("action");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");
