-- Tirage au sort, mode mixte, pondérations et équilibre (EPIC-022, ADR-0048)
ALTER TABLE "Game" ADD COLUMN "balanceAttribute" TEXT,
ADD COLUMN "balanceValues" TEXT[] DEFAULT ARRAY[]::TEXT[];

ALTER TABLE "Character" ADD COLUMN "balanceValue" TEXT;

ALTER TABLE "RegistrationPeriod" ADD COLUMN "organizerPicks" INTEGER,
ADD COLUMN "weightNotDrawnBefore" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "weightBalance" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "waitlistSize" INTEGER NOT NULL DEFAULT 5;

ALTER TABLE "Registration" ADD COLUMN "retainedById" TEXT,
ADD COLUMN "balancePreference" TEXT;

ALTER TABLE "Registration" ADD CONSTRAINT "Registration_retainedById_fkey" FOREIGN KEY ("retainedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "RegistrationDraw" (
    "id" TEXT NOT NULL,
    "periodId" TEXT NOT NULL,
    "seed" TEXT NOT NULL,
    "settings" JSONB NOT NULL,
    "result" JSONB NOT NULL,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cancelledAt" TIMESTAMP(3),
    "cancelledById" TEXT,

    CONSTRAINT "RegistrationDraw_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "RegistrationDraw_periodId_idx" ON "RegistrationDraw"("periodId");

ALTER TABLE "RegistrationDraw" ADD CONSTRAINT "RegistrationDraw_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "RegistrationPeriod"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RegistrationDraw" ADD CONSTRAINT "RegistrationDraw_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "RegistrationDraw" ADD CONSTRAINT "RegistrationDraw_cancelledById_fkey" FOREIGN KEY ("cancelledById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
