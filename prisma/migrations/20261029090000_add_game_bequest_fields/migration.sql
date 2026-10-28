-- Legs d'un jeu (SPEC-002, ADR-0025) : crédit figé, jeu d'origine, copie en attente
ALTER TABLE "Game" ADD COLUMN     "creditSourceTitle" TEXT,
ADD COLUMN     "creditAuthorName" TEXT,
ADD COLUMN     "copiedFromGameId" TEXT,
ADD COLUMN     "bequestPending" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "Game_copiedFromGameId_idx" ON "Game"("copiedFromGameId");

-- AddForeignKey
ALTER TABLE "Game" ADD CONSTRAINT "Game_copiedFromGameId_fkey" FOREIGN KEY ("copiedFromGameId") REFERENCES "Game"("id") ON DELETE SET NULL ON UPDATE CASCADE;
