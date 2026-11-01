-- CreateTable
CREATE TABLE "CspViolation" (
    "id" TEXT NOT NULL,
    "directive" TEXT NOT NULL,
    "blockedUri" TEXT NOT NULL,
    "documentPath" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 1,
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CspViolation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CspViolation_directive_blockedUri_documentPath_key" ON "CspViolation"("directive", "blockedUri", "documentPath");

