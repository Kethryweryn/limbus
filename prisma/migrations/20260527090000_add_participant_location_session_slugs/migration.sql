ALTER TABLE "Participant" ADD COLUMN "slug" TEXT;
ALTER TABLE "Location" ADD COLUMN "slug" TEXT;
ALTER TABLE "Session" ADD COLUMN "slug" TEXT;

UPDATE "Participant"
SET "slug" = coalesce(nullif(trim(both '-' from lower(regexp_replace("name", '[^a-zA-Z0-9]+', '-', 'g'))), ''), 'participant') || '-' || substring("id" from 1 for 8)
WHERE "slug" IS NULL;

UPDATE "Location"
SET "slug" = coalesce(nullif(trim(both '-' from lower(regexp_replace("name", '[^a-zA-Z0-9]+', '-', 'g'))), ''), 'lieu') || '-' || substring("id" from 1 for 8)
WHERE "slug" IS NULL;

UPDATE "Session"
SET "slug" = coalesce(nullif(trim(both '-' from lower(regexp_replace("name", '[^a-zA-Z0-9]+', '-', 'g'))), ''), 'session') || '-' || substring("id" from 1 for 8)
WHERE "slug" IS NULL;

ALTER TABLE "Participant" ALTER COLUMN "slug" SET NOT NULL;
ALTER TABLE "Location" ALTER COLUMN "slug" SET NOT NULL;
ALTER TABLE "Session" ALTER COLUMN "slug" SET NOT NULL;

CREATE UNIQUE INDEX "Participant_slug_key" ON "Participant"("slug");
CREATE UNIQUE INDEX "Location_slug_key" ON "Location"("slug");
CREATE UNIQUE INDEX "Session_slug_key" ON "Session"("slug");
