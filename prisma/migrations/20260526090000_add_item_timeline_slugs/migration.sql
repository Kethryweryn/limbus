ALTER TABLE "Item" ADD COLUMN "slug" TEXT;
ALTER TABLE "TimelineEvent" ADD COLUMN "slug" TEXT;

UPDATE "Item"
SET "slug" = coalesce(nullif(trim(both '-' from lower(regexp_replace("name", '[^a-zA-Z0-9]+', '-', 'g'))), ''), 'objet') || '-' || substring("id" from 1 for 8)
WHERE "slug" IS NULL;

UPDATE "TimelineEvent"
SET "slug" = coalesce(nullif(trim(both '-' from lower(regexp_replace("name", '[^a-zA-Z0-9]+', '-', 'g'))), ''), 'evenement') || '-' || substring("id" from 1 for 8)
WHERE "slug" IS NULL;

ALTER TABLE "Item" ALTER COLUMN "slug" SET NOT NULL;
ALTER TABLE "TimelineEvent" ALTER COLUMN "slug" SET NOT NULL;

CREATE UNIQUE INDEX "Item_slug_key" ON "Item"("slug");
CREATE UNIQUE INDEX "TimelineEvent_slug_key" ON "TimelineEvent"("slug");
