ALTER TABLE "Item" ALTER COLUMN "quantity" SET DEFAULT 1;
ALTER TABLE "Item" ADD COLUMN "locationText" TEXT;
ALTER TABLE "Item" ADD COLUMN "locationParticipantId" TEXT;

CREATE TABLE "_ParticipantItems" (
  "A" TEXT NOT NULL,
  "B" TEXT NOT NULL,

  CONSTRAINT "_ParticipantItems_AB_pkey" PRIMARY KEY ("A","B")
);

CREATE INDEX "_ParticipantItems_B_index" ON "_ParticipantItems"("B");

ALTER TABLE "Item" ADD CONSTRAINT "Item_locationParticipantId_fkey" FOREIGN KEY ("locationParticipantId") REFERENCES "Participant"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "_ParticipantItems" ADD CONSTRAINT "_ParticipantItems_A_fkey" FOREIGN KEY ("A") REFERENCES "Item"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "_ParticipantItems" ADD CONSTRAINT "_ParticipantItems_B_fkey" FOREIGN KEY ("B") REFERENCES "Participant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
