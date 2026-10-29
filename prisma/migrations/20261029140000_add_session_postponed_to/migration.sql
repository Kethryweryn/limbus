-- Report d'une session sur une nouvelle session (US-022, ADR-0029)
ALTER TABLE "Session" ADD COLUMN     "postponedToSessionId" TEXT;

CREATE UNIQUE INDEX "Session_postponedToSessionId_key" ON "Session"("postponedToSessionId");

ALTER TABLE "Session" ADD CONSTRAINT "Session_postponedToSessionId_fkey" FOREIGN KEY ("postponedToSessionId") REFERENCES "Session"("id") ON DELETE SET NULL ON UPDATE CASCADE;
