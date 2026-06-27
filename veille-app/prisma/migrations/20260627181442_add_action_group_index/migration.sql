-- CreateIndex
CREATE INDEX "ImportedAction_teamId_dedupHash_localStatus_idx" ON "ImportedAction"("teamId", "dedupHash", "localStatus");
