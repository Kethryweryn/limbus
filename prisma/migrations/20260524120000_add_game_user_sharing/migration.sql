ALTER TABLE "User"
ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE "User"
ALTER COLUMN "role" SET DEFAULT 'organizer';

ALTER TABLE "Game"
ADD COLUMN IF NOT EXISTS "ownerId" TEXT;

UPDATE "Game"
SET "ownerId" = (
  SELECT "id"
  FROM "User"
  ORDER BY CASE WHEN "role" = 'admin' THEN 0 ELSE 1 END, "email" ASC
  LIMIT 1
)
WHERE "ownerId" IS NULL
  AND EXISTS (SELECT 1 FROM "User");

CREATE TABLE IF NOT EXISTS "GameShare" (
  "id" TEXT NOT NULL,
  "gameId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "role" TEXT NOT NULL DEFAULT 'organizer',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "GameShare_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "GameShare_gameId_userId_key" ON "GameShare"("gameId", "userId");
CREATE INDEX IF NOT EXISTS "GameShare_userId_idx" ON "GameShare"("userId");
CREATE INDEX IF NOT EXISTS "Game_ownerId_idx" ON "Game"("ownerId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'Game_ownerId_fkey'
  ) THEN
    ALTER TABLE "Game"
    ADD CONSTRAINT "Game_ownerId_fkey"
    FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'GameShare_gameId_fkey'
  ) THEN
    ALTER TABLE "GameShare"
    ADD CONSTRAINT "GameShare_gameId_fkey"
    FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'GameShare_userId_fkey'
  ) THEN
    ALTER TABLE "GameShare"
    ADD CONSTRAINT "GameShare_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
