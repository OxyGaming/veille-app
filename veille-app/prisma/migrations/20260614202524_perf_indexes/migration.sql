-- CreateIndex
CREATE INDEX "ActionValidation_createdAt_idx" ON "ActionValidation"("createdAt");

-- CreateIndex
CREATE INDEX "ImportedAction_localStatus_dueAt_idx" ON "ImportedAction"("localStatus", "dueAt");

-- CreateIndex
CREATE INDEX "SiteVisit_status_finishedAt_idx" ON "SiteVisit"("status", "finishedAt");
