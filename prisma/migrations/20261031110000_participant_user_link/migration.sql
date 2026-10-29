-- Fiches participant rattachées au compte de leur adresse confirmée (US-070, ADR-0041)
ALTER TABLE "Participant" ADD COLUMN "userId" TEXT;
CREATE INDEX "Participant_userId_idx" ON "Participant"("userId");
ALTER TABLE "Participant" ADD CONSTRAINT "Participant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Les fiches existantes se rattachent au déploiement
UPDATE "Participant" AS participant SET "userId" = account."id"
FROM "User" AS account
WHERE participant."email" IS NOT NULL
  AND lower(trim(participant."email")) = lower(account."email")
  AND account."emailConfirmedAt" IS NOT NULL;
