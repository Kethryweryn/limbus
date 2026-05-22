CREATE TABLE "PlayerGame" (
    "id" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlayerGame_pkey" PRIMARY KEY ("id")
);

INSERT INTO "PlayerGame" ("id", "playerId", "gameId", "createdAt")
SELECT concat('seed_', "id", '_', "gameId"), "id", "gameId", CURRENT_TIMESTAMP
FROM "Player"
WHERE "gameId" IS NOT NULL;

CREATE UNIQUE INDEX "PlayerGame_playerId_gameId_key" ON "PlayerGame"("playerId", "gameId");
CREATE INDEX "PlayerGame_gameId_idx" ON "PlayerGame"("gameId");

ALTER TABLE "PlayerGame" ADD CONSTRAINT "PlayerGame_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PlayerGame" ADD CONSTRAINT "PlayerGame_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Player" DROP CONSTRAINT IF EXISTS "Player_gameId_fkey";
ALTER TABLE "Player" DROP COLUMN "gameId";
