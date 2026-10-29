-- Un seul PJ par participant et par session, réglable par jeu (US-017)
ALTER TABLE "Game" ADD COLUMN     "singlePjPerParticipant" BOOLEAN NOT NULL DEFAULT true;
