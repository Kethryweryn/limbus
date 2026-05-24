CREATE TABLE IF NOT EXISTS "GameInvitation" (
  "id" TEXT NOT NULL,
  "gameId" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "token" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "invitedById" TEXT NOT NULL,
  "acceptedById" TEXT,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "acceptedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "GameInvitation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "GameInvitation_token_key" ON "GameInvitation"("token");
CREATE INDEX IF NOT EXISTS "GameInvitation_gameId_idx" ON "GameInvitation"("gameId");
CREATE INDEX IF NOT EXISTS "GameInvitation_email_idx" ON "GameInvitation"("email");
CREATE INDEX IF NOT EXISTS "GameInvitation_invitedById_idx" ON "GameInvitation"("invitedById");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'GameInvitation_gameId_fkey'
  ) THEN
    ALTER TABLE "GameInvitation"
    ADD CONSTRAINT "GameInvitation_gameId_fkey"
    FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'GameInvitation_invitedById_fkey'
  ) THEN
    ALTER TABLE "GameInvitation"
    ADD CONSTRAINT "GameInvitation_invitedById_fkey"
    FOREIGN KEY ("invitedById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'GameInvitation_acceptedById_fkey'
  ) THEN
    ALTER TABLE "GameInvitation"
    ADD CONSTRAINT "GameInvitation_acceptedById_fkey"
    FOREIGN KEY ("acceptedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
