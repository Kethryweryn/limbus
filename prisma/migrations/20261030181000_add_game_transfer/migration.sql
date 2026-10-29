-- Transfert d'un jeu proposé à une co-organisatrice (US-060, ADR-0038)
ALTER TABLE "Game" ADD COLUMN "transferToUserId" TEXT;
ALTER TABLE "Game" ADD CONSTRAINT "Game_transferToUserId_fkey" FOREIGN KEY ("transferToUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
