/*
  Warnings:

  - You are about to drop the column `createdAt` on the `Document` table. All the data in the column will be lost.
  - You are about to drop the column `filePath` on the `Document` table. All the data in the column will be lost.
  - You are about to drop the column `type` on the `Document` table. All the data in the column will be lost.
  - You are about to drop the column `updatedAt` on the `Document` table. All the data in the column will be lost.
  - You are about to drop the column `createdAt` on the `Faction` table. All the data in the column will be lost.
  - You are about to drop the column `updatedAt` on the `Faction` table. All the data in the column will be lost.
  - You are about to drop the column `createdAt` on the `Intrigue` table. All the data in the column will be lost.
  - You are about to drop the column `description` on the `Intrigue` table. All the data in the column will be lost.
  - You are about to drop the column `updatedAt` on the `Intrigue` table. All the data in the column will be lost.
  - You are about to drop the column `createdAt` on the `Item` table. All the data in the column will be lost.
  - You are about to drop the column `updatedAt` on the `Item` table. All the data in the column will be lost.
  - You are about to drop the column `createdAt` on the `Session` table. All the data in the column will be lost.
  - You are about to drop the column `location` on the `Session` table. All the data in the column will be lost.
  - You are about to drop the column `title` on the `Session` table. All the data in the column will be lost.
  - You are about to drop the column `updatedAt` on the `Session` table. All the data in the column will be lost.
  - You are about to drop the column `createdAt` on the `SessionAssignment` table. All the data in the column will be lost.
  - You are about to drop the column `playerEmail` on the `SessionAssignment` table. All the data in the column will be lost.
  - You are about to drop the column `playerName` on the `SessionAssignment` table. All the data in the column will be lost.
  - You are about to drop the column `updatedAt` on the `SessionAssignment` table. All the data in the column will be lost.
  - You are about to drop the column `createdAt` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `updatedAt` on the `User` table. All the data in the column will be lost.
  - You are about to drop the `_IntrigueToItem` table. If the table is not empty, all the data it contains will be lost.
  - Made the column `description` on table `Game` required. This step will fail if there are existing NULL values in that column.
  - Added the required column `name` to the `Session` table without a default value. This is not possible if the table is not empty.
  - Made the column `name` on table `User` required. This step will fail if there are existing NULL values in that column.

*/
-- DropForeignKey
ALTER TABLE "_IntrigueToItem" DROP CONSTRAINT "_IntrigueToItem_A_fkey";

-- DropForeignKey
ALTER TABLE "_IntrigueToItem" DROP CONSTRAINT "_IntrigueToItem_B_fkey";

-- AlterTable
ALTER TABLE "Character" ADD COLUMN     "published" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "Document" DROP COLUMN "createdAt",
DROP COLUMN "filePath",
DROP COLUMN "type",
DROP COLUMN "updatedAt",
ADD COLUMN     "published" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "Faction" DROP COLUMN "createdAt",
DROP COLUMN "updatedAt",
ADD COLUMN     "published" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "Game" ADD COLUMN     "published" BOOLEAN NOT NULL DEFAULT true,
ALTER COLUMN "description" SET NOT NULL;

-- AlterTable
ALTER TABLE "Intrigue" DROP COLUMN "createdAt",
DROP COLUMN "description",
DROP COLUMN "updatedAt",
ADD COLUMN     "published" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "summary" TEXT;

-- AlterTable
ALTER TABLE "Item" DROP COLUMN "createdAt",
DROP COLUMN "updatedAt",
ADD COLUMN     "published" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "Session" DROP COLUMN "createdAt",
DROP COLUMN "location",
DROP COLUMN "title",
DROP COLUMN "updatedAt",
ADD COLUMN     "name" TEXT NOT NULL,
ADD COLUMN     "published" BOOLEAN NOT NULL DEFAULT true,
ALTER COLUMN "date" DROP NOT NULL;

-- AlterTable
ALTER TABLE "SessionAssignment" DROP COLUMN "createdAt",
DROP COLUMN "playerEmail",
DROP COLUMN "playerName",
DROP COLUMN "updatedAt";

-- AlterTable
ALTER TABLE "User" DROP COLUMN "createdAt",
DROP COLUMN "updatedAt",
ALTER COLUMN "name" SET NOT NULL;

-- DropTable
DROP TABLE "_IntrigueToItem";

-- CreateTable
CREATE TABLE "_IntrigueItems" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_IntrigueItems_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE INDEX "_IntrigueItems_B_index" ON "_IntrigueItems"("B");

-- AddForeignKey
ALTER TABLE "_IntrigueItems" ADD CONSTRAINT "_IntrigueItems_A_fkey" FOREIGN KEY ("A") REFERENCES "Intrigue"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_IntrigueItems" ADD CONSTRAINT "_IntrigueItems_B_fkey" FOREIGN KEY ("B") REFERENCES "Item"("id") ON DELETE CASCADE ON UPDATE CASCADE;
