CREATE TABLE "Location" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT,
    "notes" TEXT,
    "gameId" TEXT NOT NULL,
    "published" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Location_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Player" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "photoUrl" TEXT,
    "notes" TEXT,
    "gameId" TEXT NOT NULL,
    "published" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Player_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "Session" ADD COLUMN "locationId" TEXT;

ALTER TABLE "SessionAssignment"
ADD COLUMN "playerId" TEXT,
ADD COLUMN "notes" TEXT;

CREATE UNIQUE INDEX "SessionAssignment_sessionId_characterId_key" ON "SessionAssignment"("sessionId", "characterId");

ALTER TABLE "Location" ADD CONSTRAINT "Location_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Player" ADD CONSTRAINT "Player_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Session" ADD CONSTRAINT "Session_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "SessionAssignment" ADD CONSTRAINT "SessionAssignment_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE SET NULL ON UPDATE CASCADE;
