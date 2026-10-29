-- Anciens slugs d'un jeu : l'ancienne adresse de la page publique redirige (US-045, ADR-0035)
CREATE TABLE "GameSlugRedirect" (
    "slug" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GameSlugRedirect_pkey" PRIMARY KEY ("slug")
);

CREATE INDEX "GameSlugRedirect_gameId_idx" ON "GameSlugRedirect"("gameId");

ALTER TABLE "GameSlugRedirect" ADD CONSTRAINT "GameSlugRedirect_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE CASCADE ON UPDATE CASCADE;
