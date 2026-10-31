-- Sélection à la main des inscriptions (EPIC-021, ADR-0047)
ALTER TABLE "Session" ADD COLUMN "poolSeats" INTEGER;

ALTER TABLE "RegistrationPeriod" ADD COLUMN "replayPolicy" TEXT NOT NULL DEFAULT 'allowed';

ALTER TABLE "Registration" ADD COLUMN "announcedStatus" TEXT,
ADD COLUMN "announcedSessionId" TEXT,
ADD COLUMN "announcedAt" TIMESTAMP(3);

CREATE TABLE "RegistrationWaitlistEntry" (
    "id" TEXT NOT NULL,
    "registrationId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RegistrationWaitlistEntry_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "RegistrationWaitlistEntry_registrationId_sessionId_key" ON "RegistrationWaitlistEntry"("registrationId", "sessionId");
CREATE INDEX "RegistrationWaitlistEntry_sessionId_idx" ON "RegistrationWaitlistEntry"("sessionId");

ALTER TABLE "RegistrationWaitlistEntry" ADD CONSTRAINT "RegistrationWaitlistEntry_registrationId_fkey" FOREIGN KEY ("registrationId") REFERENCES "Registration"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RegistrationWaitlistEntry" ADD CONSTRAINT "RegistrationWaitlistEntry_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session"("id") ON DELETE CASCADE ON UPDATE CASCADE;
