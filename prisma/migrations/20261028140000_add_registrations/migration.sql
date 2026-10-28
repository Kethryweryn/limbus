-- CreateTable
CREATE TABLE "Registration" (
    "id" TEXT NOT NULL,
    "periodId" TEXT NOT NULL,
    "sessionId" TEXT,
    "participantId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "invitedById" TEXT,
    "formVersionId" TEXT,
    "email" TEXT NOT NULL,
    "firstName" TEXT,
    "lastName" TEXT,
    "facebookName" TEXT,
    "phone" TEXT,
    "emergencyContactName" TEXT,
    "emergencyContactPhone" TEXT,
    "dietary" TEXT,
    "healthConsentAt" TIMESTAMP(3),
    "charterAcceptedAt" TIMESTAMP(3),
    "tokenHash" TEXT,
    "invitationSentAt" TIMESTAMP(3),
    "responseDueAt" TIMESTAMP(3),
    "respondedAt" TIMESTAMP(3),
    "confirmedAt" TIMESTAMP(3),
    "withdrawnAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Registration_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Registration_tokenHash_key" ON "Registration"("tokenHash");

-- CreateIndex
CREATE INDEX "Registration_sessionId_idx" ON "Registration"("sessionId");

-- CreateIndex
CREATE INDEX "Registration_participantId_idx" ON "Registration"("participantId");

-- CreateIndex
CREATE UNIQUE INDEX "Registration_periodId_participantId_key" ON "Registration"("periodId", "participantId");

-- AddForeignKey
ALTER TABLE "Registration" ADD CONSTRAINT "Registration_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "RegistrationPeriod"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Registration" ADD CONSTRAINT "Registration_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Registration" ADD CONSTRAINT "Registration_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "Participant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Registration" ADD CONSTRAINT "Registration_invitedById_fkey" FOREIGN KEY ("invitedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Registration" ADD CONSTRAINT "Registration_formVersionId_fkey" FOREIGN KEY ("formVersionId") REFERENCES "RegistrationFormVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;
