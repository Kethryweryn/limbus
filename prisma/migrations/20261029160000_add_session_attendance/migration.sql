-- Confirmation de présence à une session reportée (US-024, ADR-0029)
CREATE TABLE "SessionAttendance" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "participantId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "tokenHash" TEXT,
    "responseDueAt" TIMESTAMP(3) NOT NULL,
    "invitationSentAt" TIMESTAMP(3),
    "lastRemindedAt" TIMESTAMP(3),
    "respondedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SessionAttendance_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SessionAttendance_tokenHash_key" ON "SessionAttendance"("tokenHash");

CREATE INDEX "SessionAttendance_participantId_idx" ON "SessionAttendance"("participantId");

CREATE UNIQUE INDEX "SessionAttendance_sessionId_participantId_key" ON "SessionAttendance"("sessionId", "participantId");

ALTER TABLE "SessionAttendance" ADD CONSTRAINT "SessionAttendance_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SessionAttendance" ADD CONSTRAINT "SessionAttendance_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "Participant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
