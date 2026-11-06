-- Annonce par session (R26, R27) : une session déjà annoncée le reste, ignoredStatus reste vide
ALTER TABLE "RegistrationPeriodSession" ADD COLUMN "castAnnouncedAt" TIMESTAMP(3);
ALTER TABLE "RegistrationSession" ADD COLUMN "ignoredStatus" TEXT;

UPDATE "RegistrationPeriodSession" AS link
SET "castAnnouncedAt" = announced.at
FROM (
  SELECT "sessionId", max("announcedAt") AS at FROM "RegistrationSession" WHERE "announcedAt" IS NOT NULL GROUP BY "sessionId"
) AS announced
WHERE announced."sessionId" = link."sessionId";
