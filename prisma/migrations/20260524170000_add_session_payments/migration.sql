ALTER TABLE "Session" ADD COLUMN "paymentRibUrl" TEXT;
ALTER TABLE "Session" ADD COLUMN "paymentLinkUrl" TEXT;

CREATE TABLE "SessionPayment" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "participantId" TEXT NOT NULL,
    "paidAt" TIMESTAMP(3),
    "paymentEmailSentAt" TIMESTAMP(3),
    "paymentReminderSentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SessionPayment_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SessionPayment_sessionId_participantId_key" ON "SessionPayment"("sessionId", "participantId");
CREATE INDEX "SessionPayment_participantId_idx" ON "SessionPayment"("participantId");

ALTER TABLE "SessionPayment" ADD CONSTRAINT "SessionPayment_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SessionPayment" ADD CONSTRAINT "SessionPayment_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "Participant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
