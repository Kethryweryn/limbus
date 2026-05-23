ALTER TABLE "Item" DROP CONSTRAINT IF EXISTS "Item_locationParticipantId_fkey";
ALTER TABLE "Item" DROP COLUMN IF EXISTS "locationParticipantId";
ALTER TABLE "Item" ADD COLUMN "locationCharacterId" TEXT;

DROP TABLE IF EXISTS "_ParticipantItems";

CREATE TABLE "_CharacterItems" (
  "A" TEXT NOT NULL,
  "B" TEXT NOT NULL,

  CONSTRAINT "_CharacterItems_AB_pkey" PRIMARY KEY ("A","B")
);

CREATE INDEX "_CharacterItems_B_index" ON "_CharacterItems"("B");

ALTER TABLE "_CharacterItems" ADD CONSTRAINT "_CharacterItems_A_fkey" FOREIGN KEY ("A") REFERENCES "Character"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "_CharacterItems" ADD CONSTRAINT "_CharacterItems_B_fkey" FOREIGN KEY ("B") REFERENCES "Item"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Item" ADD CONSTRAINT "Item_locationCharacterId_fkey" FOREIGN KEY ("locationCharacterId") REFERENCES "Character"("id") ON DELETE SET NULL ON UPDATE CASCADE;
