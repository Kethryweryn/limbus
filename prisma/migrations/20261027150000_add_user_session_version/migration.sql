-- Incrémenté pour invalider toutes les sessions ouvertes d’un utilisateur
ALTER TABLE "User" ADD COLUMN "sessionVersion" INTEGER NOT NULL DEFAULT 0;
