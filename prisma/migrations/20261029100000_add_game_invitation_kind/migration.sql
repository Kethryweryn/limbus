-- Legs à une personne sans compte (US-011, ADR-0025) : type d'invitation
ALTER TABLE "GameInvitation" ADD COLUMN     "kind" TEXT NOT NULL DEFAULT 'share';
