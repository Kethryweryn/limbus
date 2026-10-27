-- Formulaire d'inscription d'un jeu et ses versions immuables (SPEC-001 R8, R9 ; ADR-0019)
-- CreateTable
CREATE TABLE "RegistrationForm" (
    "id" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RegistrationForm_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RegistrationFormVersion" (
    "id" TEXT NOT NULL,
    "formId" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "definition" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RegistrationFormVersion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RegistrationForm_gameId_key" ON "RegistrationForm"("gameId");

-- CreateIndex
CREATE UNIQUE INDEX "RegistrationFormVersion_formId_number_key" ON "RegistrationFormVersion"("formId", "number");

-- AddForeignKey
ALTER TABLE "RegistrationForm" ADD CONSTRAINT "RegistrationForm_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RegistrationFormVersion" ADD CONSTRAINT "RegistrationFormVersion_formId_fkey" FOREIGN KEY ("formId") REFERENCES "RegistrationForm"("id") ON DELETE CASCADE ON UPDATE CASCADE;
