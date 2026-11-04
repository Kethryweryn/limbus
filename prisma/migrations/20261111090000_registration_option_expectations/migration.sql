-- Proportions attendues des options du questionnaire (US-141, ADR-0062)
CREATE TABLE "RegistrationOptionExpectation" (
    "id" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "option" TEXT NOT NULL,
    "share" DOUBLE PRECISION NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RegistrationOptionExpectation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "RegistrationOptionExpectation_gameId_questionId_option_key" ON "RegistrationOptionExpectation"("gameId", "questionId", "option");

ALTER TABLE "RegistrationOptionExpectation" ADD CONSTRAINT "RegistrationOptionExpectation_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE CASCADE ON UPDATE CASCADE;
