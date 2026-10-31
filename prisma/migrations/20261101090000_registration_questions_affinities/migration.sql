-- Questions propres au jeu et affinités (EPIC-019, ADR-0045)
ALTER TABLE "Registration" ADD COLUMN "questionAnswers" JSONB;

CREATE TABLE "RegistrationAffinity" (
    "id" TEXT NOT NULL,
    "registrationId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "position" INTEGER NOT NULL,

    CONSTRAINT "RegistrationAffinity_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "RegistrationAffinity_registrationId_idx" ON "RegistrationAffinity"("registrationId");

ALTER TABLE "RegistrationAffinity" ADD CONSTRAINT "RegistrationAffinity_registrationId_fkey" FOREIGN KEY ("registrationId") REFERENCES "Registration"("id") ON DELETE CASCADE ON UPDATE CASCADE;
