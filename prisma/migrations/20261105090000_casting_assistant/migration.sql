-- AlterTable
ALTER TABLE "SessionAssignment" ADD COLUMN     "locked" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "reservedRegistrationId" TEXT;

-- CreateIndex
CREATE INDEX "SessionAssignment_reservedRegistrationId_idx" ON "SessionAssignment"("reservedRegistrationId");

-- AddForeignKey
ALTER TABLE "SessionAssignment" ADD CONSTRAINT "SessionAssignment_reservedRegistrationId_fkey" FOREIGN KEY ("reservedRegistrationId") REFERENCES "Registration"("id") ON DELETE SET NULL ON UPDATE CASCADE;

