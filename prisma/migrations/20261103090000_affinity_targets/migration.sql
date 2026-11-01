-- Affinités rattachées à une fiche participant (EPIC-023, ADR-0049)
ALTER TABLE "RegistrationAffinity" ADD COLUMN "targetParticipantId" TEXT,
ADD COLUMN "targetUnknown" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "RegistrationAffinity" ADD CONSTRAINT "RegistrationAffinity_targetParticipantId_fkey" FOREIGN KEY ("targetParticipantId") REFERENCES "Participant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "RegistrationAffinity_targetParticipantId_idx" ON "RegistrationAffinity"("targetParticipantId");
