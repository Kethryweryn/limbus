CREATE TABLE "_DocumentCharacters" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_DocumentCharacters_AB_pkey" PRIMARY KEY ("A","B")
);

CREATE INDEX "_DocumentCharacters_B_index" ON "_DocumentCharacters"("B");

ALTER TABLE "_DocumentCharacters" ADD CONSTRAINT "_DocumentCharacters_A_fkey" FOREIGN KEY ("A") REFERENCES "Character"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "_DocumentCharacters" ADD CONSTRAINT "_DocumentCharacters_B_fkey" FOREIGN KEY ("B") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;
