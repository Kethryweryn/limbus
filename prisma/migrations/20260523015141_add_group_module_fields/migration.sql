ALTER TABLE "Faction"
ADD COLUMN "pitch" TEXT,
ADD COLUMN "background" TEXT,
ADD COLUMN "backgroundDocumentUrl" TEXT,
ADD COLUMN "costumeIndications" TEXT,
ADD COLUMN "slug" TEXT;

UPDATE "Faction"
SET
  "pitch" = "description",
  "slug" = lower(
    regexp_replace(
      regexp_replace(coalesce(nullif("name", ''), 'groupe'), '[^a-zA-Z0-9]+', '-', 'g'),
      '(^-|-$)',
      '',
      'g'
    )
  ) || '-' || left("id", 6);

ALTER TABLE "Faction"
DROP COLUMN "description",
ALTER COLUMN "slug" SET NOT NULL;

CREATE UNIQUE INDEX "Faction_slug_key" ON "Faction"("slug");
