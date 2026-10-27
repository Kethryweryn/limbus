-- Périodes d'inscription (SPEC-001, ADR-0019) : recrutement des PJ de sessions précises ou de tout le jeu
-- CreateTable
CREATE TABLE "RegistrationPeriod" (
    "id" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "scope" TEXT NOT NULL DEFAULT 'sessions',
    "publicId" TEXT NOT NULL,
    "entryMode" TEXT NOT NULL DEFAULT 'invitation',
    "selectionMode" TEXT NOT NULL DEFAULT 'chosen',
    "state" TEXT NOT NULL DEFAULT 'draft',
    "closesAt" TIMESTAMP(3),
    "responseDelayDays" INTEGER NOT NULL DEFAULT 7,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RegistrationPeriod_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RegistrationPeriodSession" (
    "id" TEXT NOT NULL,
    "periodId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "seats" INTEGER NOT NULL,

    CONSTRAINT "RegistrationPeriodSession_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RegistrationPeriod_publicId_key" ON "RegistrationPeriod"("publicId");

-- CreateIndex
CREATE INDEX "RegistrationPeriod_gameId_idx" ON "RegistrationPeriod"("gameId");

-- CreateIndex
CREATE UNIQUE INDEX "RegistrationPeriodSession_sessionId_key" ON "RegistrationPeriodSession"("sessionId");

-- CreateIndex
CREATE INDEX "RegistrationPeriodSession_periodId_idx" ON "RegistrationPeriodSession"("periodId");

-- AddForeignKey
ALTER TABLE "RegistrationPeriod" ADD CONSTRAINT "RegistrationPeriod_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RegistrationPeriodSession" ADD CONSTRAINT "RegistrationPeriodSession_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "RegistrationPeriod"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RegistrationPeriodSession" ADD CONSTRAINT "RegistrationPeriodSession_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session"("id") ON DELETE CASCADE ON UPDATE CASCADE;
