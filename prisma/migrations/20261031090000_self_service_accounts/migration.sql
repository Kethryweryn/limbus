-- Comptes en libre-service (EPIC-013, ADR-0039)
-- Adresse confirmée : les comptes existants le sont (défaut à la date de la migration)
ALTER TABLE "User" ADD COLUMN "emailConfirmedAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "User" ADD COLUMN "disabledAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN "storageQuotaMb" INTEGER NOT NULL DEFAULT 500;

ALTER TABLE "UploadedFile" ADD COLUMN "size" INTEGER;

CREATE TABLE "AccountToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "email" TEXT,
    "passwordHash" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AccountToken_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "AccountToken_tokenHash_key" ON "AccountToken"("tokenHash");
CREATE INDEX "AccountToken_userId_kind_idx" ON "AccountToken"("userId", "kind");
ALTER TABLE "AccountToken" ADD CONSTRAINT "AccountToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Un seul rôle global (US-067, ADR-0038) : le build en service accepte déjà « user »
UPDATE "User" SET "role" = 'user' WHERE "role" = 'organizer';
