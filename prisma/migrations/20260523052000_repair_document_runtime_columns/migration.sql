ALTER TABLE "Document" ADD COLUMN IF NOT EXISTS "audience" TEXT NOT NULL DEFAULT 'targeted';

CREATE UNIQUE INDEX IF NOT EXISTS "SessionDocumentDelivery_document_once_key"
ON "SessionDocumentDelivery"("sessionId", "documentId", "participantId", "kind")
WHERE "documentId" IS NOT NULL AND "kind" = 'document';

CREATE UNIQUE INDEX IF NOT EXISTS "SessionDocumentDelivery_character_sheet_once_key"
ON "SessionDocumentDelivery"("sessionId", "characterId", "participantId", "kind")
WHERE "characterId" IS NOT NULL AND "kind" = 'character_sheet';
