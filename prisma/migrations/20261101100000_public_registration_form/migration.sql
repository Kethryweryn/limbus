-- Formulaire public, inscription permanente et page publique (EPIC-020, ADR-0046)
ALTER TABLE "Game" ADD COLUMN "publicShowSessions" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "publicShowRegistration" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "RegistrationPeriod" ADD COLUMN "notifyTeam" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE "RegistrationRequest" (
    "id" TEXT NOT NULL,
    "periodId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "answers" JSONB NOT NULL,
    "formVersionId" TEXT,
    "tokenHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RegistrationRequest_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "RegistrationRequest_tokenHash_key" ON "RegistrationRequest"("tokenHash");
CREATE INDEX "RegistrationRequest_periodId_idx" ON "RegistrationRequest"("periodId");
CREATE INDEX "RegistrationRequest_createdAt_idx" ON "RegistrationRequest"("createdAt");

ALTER TABLE "RegistrationRequest" ADD CONSTRAINT "RegistrationRequest_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "RegistrationPeriod"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RegistrationRequest" ADD CONSTRAINT "RegistrationRequest_formVersionId_fkey" FOREIGN KEY ("formVersionId") REFERENCES "RegistrationFormVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "RegistrationAvailability" (
    "id" TEXT NOT NULL,
    "registrationId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,

    CONSTRAINT "RegistrationAvailability_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "RegistrationAvailability_registrationId_sessionId_key" ON "RegistrationAvailability"("registrationId", "sessionId");
CREATE INDEX "RegistrationAvailability_sessionId_idx" ON "RegistrationAvailability"("sessionId");

ALTER TABLE "RegistrationAvailability" ADD CONSTRAINT "RegistrationAvailability_registrationId_fkey" FOREIGN KEY ("registrationId") REFERENCES "Registration"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RegistrationAvailability" ADD CONSTRAINT "RegistrationAvailability_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session"("id") ON DELETE CASCADE ON UPDATE CASCADE;
