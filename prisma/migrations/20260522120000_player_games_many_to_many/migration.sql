CREATE TABLE "_GamePlayers" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

INSERT INTO "_GamePlayers" ("A", "B")
SELECT "gameId", "id"
FROM "Player"
WHERE "gameId" IS NOT NULL;

CREATE UNIQUE INDEX "_GamePlayers_AB_unique" ON "_GamePlayers"("A", "B");
CREATE INDEX "_GamePlayers_B_index" ON "_GamePlayers"("B");

ALTER TABLE "_GamePlayers" ADD CONSTRAINT "_GamePlayers_A_fkey" FOREIGN KEY ("A") REFERENCES "Game"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "_GamePlayers" ADD CONSTRAINT "_GamePlayers_B_fkey" FOREIGN KEY ("B") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Player" DROP CONSTRAINT IF EXISTS "Player_gameId_fkey";
ALTER TABLE "Player" DROP COLUMN "gameId";
