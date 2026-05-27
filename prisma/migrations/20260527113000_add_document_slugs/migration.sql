ALTER TABLE "Document" ADD COLUMN "slug" TEXT;

UPDATE "Document"
SET "slug" = CONCAT(
  COALESCE(
    NULLIF(
      REGEXP_REPLACE(
        REGEXP_REPLACE(LOWER("title"), '[^a-z0-9]+', '-', 'g'),
        '(^-|-$)',
        '',
        'g'
      ),
      ''
    ),
    'document'
  ),
  '-',
  SUBSTRING("id", 1, 8)
)
WHERE "slug" IS NULL;

ALTER TABLE "Document" ALTER COLUMN "slug" SET NOT NULL;

CREATE UNIQUE INDEX "Document_slug_key" ON "Document"("slug");
