ALTER TABLE "Character"
ADD COLUMN "pitch" TEXT,
ADD COLUMN "background" TEXT,
ADD COLUMN "backgroundDocumentUrl" TEXT,
ADD COLUMN "costumeIndications" TEXT;

UPDATE "Character"
SET "pitch" = "description"
WHERE "description" IS NOT NULL;

ALTER TABLE "Character"
DROP COLUMN "description";
