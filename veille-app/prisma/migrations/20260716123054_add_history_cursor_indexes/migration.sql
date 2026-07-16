-- CreateIndex
CREATE INDEX "ActionValidation_teamId_realizedAt_id_idx" ON "ActionValidation"("teamId", "realizedAt", "id");

-- CreateIndex
CREATE INDEX "AgentSighting_teamId_sightedAt_id_idx" ON "AgentSighting"("teamId", "sightedAt", "id");

-- CreateIndex
CREATE INDEX "SiteSighting_teamId_sightedAt_id_idx" ON "SiteSighting"("teamId", "sightedAt", "id");

-- CreateIndex
CREATE INDEX "SiteVisit_teamId_visitDate_id_idx" ON "SiteVisit"("teamId", "visitDate", "id");

-- CreateIndex
CREATE INDEX "VehicleRound_teamId_roundDate_id_idx" ON "VehicleRound"("teamId", "roundDate", "id");

-- CreateIndex
CREATE INDEX "VeilleSession_teamId_startedAt_id_idx" ON "VeilleSession"("teamId", "startedAt", "id");
