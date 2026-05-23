ALTER TABLE "Character" ADD COLUMN "type" TEXT NOT NULL DEFAULT 'pj';

ALTER TABLE "SessionAssignment" DROP CONSTRAINT IF EXISTS "SessionAssignment_playerId_fkey";
ALTER TABLE "PlayerGame" DROP CONSTRAINT IF EXISTS "PlayerGame_playerId_fkey";
ALTER TABLE "PlayerGame" DROP CONSTRAINT IF EXISTS "PlayerGame_gameId_fkey";

ALTER TABLE "Player" RENAME TO "Participant";
ALTER TABLE "PlayerGame" RENAME TO "ParticipantGame";

ALTER TABLE "ParticipantGame" RENAME COLUMN "playerId" TO "participantId";
ALTER INDEX IF EXISTS "PlayerGame_playerId_gameId_key" RENAME TO "ParticipantGame_participantId_gameId_key";
ALTER INDEX IF EXISTS "PlayerGame_gameId_idx" RENAME TO "ParticipantGame_gameId_idx";

ALTER TABLE "SessionAssignment" RENAME COLUMN "playerId" TO "participantId";

ALTER TABLE "ParticipantGame" ADD CONSTRAINT "ParticipantGame_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "Participant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ParticipantGame" ADD CONSTRAINT "ParticipantGame_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SessionAssignment" ADD CONSTRAINT "SessionAssignment_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "Participant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "SessionParticipant" (
  "id" TEXT NOT NULL,
  "sessionId" TEXT NOT NULL,
  "participantId" TEXT NOT NULL,
  "role" TEXT NOT NULL,

  CONSTRAINT "SessionParticipant_pkey" PRIMARY KEY ("id")
);

INSERT INTO "SessionParticipant" ("id", "sessionId", "participantId", "role")
SELECT 'sp_' || md5("sessionId" || ':' || "participantId" || ':participant'), "sessionId", "participantId", 'participant'
FROM "SessionAssignment"
WHERE "participantId" IS NOT NULL
ON CONFLICT DO NOTHING;

CREATE UNIQUE INDEX "SessionParticipant_sessionId_participantId_role_key" ON "SessionParticipant"("sessionId", "participantId", "role");
CREATE INDEX "SessionParticipant_participantId_idx" ON "SessionParticipant"("participantId");

ALTER TABLE "SessionParticipant" ADD CONSTRAINT "SessionParticipant_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SessionParticipant" ADD CONSTRAINT "SessionParticipant_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "Participant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
