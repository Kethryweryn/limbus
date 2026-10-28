-- AlterTable
ALTER TABLE "Registration" ADD COLUMN     "withdrawnById" TEXT;

-- AddForeignKey
ALTER TABLE "Registration" ADD CONSTRAINT "Registration_withdrawnById_fkey" FOREIGN KEY ("withdrawnById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
