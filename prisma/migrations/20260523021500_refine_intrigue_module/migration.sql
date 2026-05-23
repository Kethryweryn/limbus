ALTER TABLE "Intrigue"
ADD COLUMN "name" TEXT,
ADD COLUMN "pitch" TEXT,
ADD COLUMN "description" TEXT,
ADD COLUMN "level" TEXT NOT NULL DEFAULT 'minor',
ADD COLUMN "slug" TEXT;

UPDATE "Intrigue"
SET
  "name" = "title",
  "pitch" = "summary",
  "slug" = lower(
    regexp_replace(
      regexp_replace(coalesce(nullif("title", ''), 'intrigue'), '[^a-zA-Z0-9]+', '-', 'g'),
      '(^-|-$)',
      '',
      'g'
    )
  ) || '-' || left("id", 6);

ALTER TABLE "Intrigue"
DROP COLUMN "title",
DROP COLUMN "summary",
ALTER COLUMN "name" SET NOT NULL,
ALTER COLUMN "slug" SET NOT NULL;

CREATE UNIQUE INDEX "Intrigue_slug_key" ON "Intrigue"("slug");

CREATE TABLE "_FactionIntrigues" (
  "A" TEXT NOT NULL,
  "B" TEXT NOT NULL,

  CONSTRAINT "_FactionIntrigues_AB_pkey" PRIMARY KEY ("A","B")
);

CREATE INDEX "_FactionIntrigues_B_index" ON "_FactionIntrigues"("B");

ALTER TABLE "_FactionIntrigues" ADD CONSTRAINT "_FactionIntrigues_A_fkey" FOREIGN KEY ("A") REFERENCES "Faction"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "_FactionIntrigues" ADD CONSTRAINT "_FactionIntrigues_B_fkey" FOREIGN KEY ("B") REFERENCES "Intrigue"("id") ON DELETE CASCADE ON UPDATE CASCADE;
