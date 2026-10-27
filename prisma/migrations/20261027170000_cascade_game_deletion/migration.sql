-- Supprimer un jeu, une session ou un personnage supprime ce qui en dépend (avant : erreur 500)
ALTER TABLE "Character" DROP CONSTRAINT "Character_gameId_fkey";
ALTER TABLE "Character" ADD CONSTRAINT "Character_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Faction" DROP CONSTRAINT "Faction_gameId_fkey";
ALTER TABLE "Faction" ADD CONSTRAINT "Faction_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Intrigue" DROP CONSTRAINT "Intrigue_gameId_fkey";
ALTER TABLE "Intrigue" ADD CONSTRAINT "Intrigue_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Item" DROP CONSTRAINT "Item_gameId_fkey";
ALTER TABLE "Item" ADD CONSTRAINT "Item_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Document" DROP CONSTRAINT "Document_gameId_fkey";
ALTER TABLE "Document" ADD CONSTRAINT "Document_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Location" DROP CONSTRAINT "Location_gameId_fkey";
ALTER TABLE "Location" ADD CONSTRAINT "Location_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Session" DROP CONSTRAINT "Session_gameId_fkey";
ALTER TABLE "Session" ADD CONSTRAINT "Session_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SessionAssignment" DROP CONSTRAINT "SessionAssignment_sessionId_fkey";
ALTER TABLE "SessionAssignment" ADD CONSTRAINT "SessionAssignment_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SessionAssignment" DROP CONSTRAINT "SessionAssignment_characterId_fkey";
ALTER TABLE "SessionAssignment" ADD CONSTRAINT "SessionAssignment_characterId_fkey" FOREIGN KEY ("characterId") REFERENCES "Character"("id") ON DELETE CASCADE ON UPDATE CASCADE;
