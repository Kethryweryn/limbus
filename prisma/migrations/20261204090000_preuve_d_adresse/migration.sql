-- Adresse donnée en réponse, déjà celle d'une autre fiche, à prouver par un lien (US-243, ADR-0087)
CREATE TABLE "ParticipantEmailProof" (
    "id" TEXT NOT NULL,
    "participantId" TEXT NOT NULL,
    "email" CITEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ParticipantEmailProof_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ParticipantEmailProof_tokenHash_key" ON "ParticipantEmailProof"("tokenHash");
CREATE INDEX "ParticipantEmailProof_participantId_idx" ON "ParticipantEmailProof"("participantId");
CREATE INDEX "ParticipantEmailProof_expiresAt_idx" ON "ParticipantEmailProof"("expiresAt");

ALTER TABLE "ParticipantEmailProof" ADD CONSTRAINT "ParticipantEmailProof_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "Participant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
