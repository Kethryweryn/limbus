-- US-195 (ADR-0074, ADR-0077) : la base refuse qu'une session, une inscription, un paiement ou un fichier soit relié à un
-- élément d'un autre jeu. Les sessions, lieux, viviers, formulaires et inscriptions reçoivent une unicité (id, gameId) ;
-- onze tables reçoivent le jeu, rempli depuis leur session, leur vivier ou leur formulaire ; chaque lien compare le jeu.
--
-- deploiement-incompatible : les nouvelles colonnes « jeu » sont obligatoires, et le build encore en service ne les remplit
-- pas : ses écritures dans ces tables échouent pendant les secondes du déploiement (accepté par l'utilisatrice). Les clés
-- recréées ne changent rien pour lui.
-- Une référence qui se vide à la suppression de sa cible n'efface que son identifiant : ON DELETE SET NULL (colonne), que
-- Prisma n'écrit pas et ne compare pas (ADR-0077). Une migration générée qui recrée une de ces clés doit le réécrire.
-- Production relevée le 2026-11-09 : aucun lien ne relie deux jeux.

-- Le RIB d'essai du jeu Valombre n'avait pas de jeu : il reçoit celui de sa session
UPDATE "UploadedFile" u SET "gameId" = s."gameId" FROM "Session" s WHERE s."id" = u."sessionId" AND u."gameId" IS NULL;

-- Le jeu de chaque ligne
ALTER TABLE "SessionAssignment" ADD COLUMN "gameId" TEXT;
UPDATE "SessionAssignment" t SET "gameId" = s."gameId" FROM "Session" s WHERE s."id" = t."sessionId";
ALTER TABLE "SessionAssignment" ALTER COLUMN "gameId" SET NOT NULL;
ALTER TABLE "TimelineEventResponsible" ADD COLUMN "gameId" TEXT;
UPDATE "TimelineEventResponsible" t SET "gameId" = s."gameId" FROM "Session" s WHERE s."id" = t."sessionId";
ALTER TABLE "TimelineEventResponsible" ALTER COLUMN "gameId" SET NOT NULL;
ALTER TABLE "SessionDocumentDelivery" ADD COLUMN "gameId" TEXT;
UPDATE "SessionDocumentDelivery" t SET "gameId" = s."gameId" FROM "Session" s WHERE s."id" = t."sessionId";
ALTER TABLE "SessionDocumentDelivery" ALTER COLUMN "gameId" SET NOT NULL;
ALTER TABLE "SessionTrombinoscope" ADD COLUMN "gameId" TEXT;
UPDATE "SessionTrombinoscope" t SET "gameId" = s."gameId" FROM "Session" s WHERE s."id" = t."sessionId";
ALTER TABLE "SessionTrombinoscope" ALTER COLUMN "gameId" SET NOT NULL;
ALTER TABLE "RegistrationPeriodSession" ADD COLUMN "gameId" TEXT;
UPDATE "RegistrationPeriodSession" t SET "gameId" = s."gameId" FROM "Session" s WHERE s."id" = t."sessionId";
ALTER TABLE "RegistrationPeriodSession" ALTER COLUMN "gameId" SET NOT NULL;
ALTER TABLE "RegistrationSession" ADD COLUMN "gameId" TEXT;
UPDATE "RegistrationSession" t SET "gameId" = s."gameId" FROM "Session" s WHERE s."id" = t."sessionId";
ALTER TABLE "RegistrationSession" ALTER COLUMN "gameId" SET NOT NULL;
ALTER TABLE "SessionPayment" ADD COLUMN "gameId" TEXT;
UPDATE "SessionPayment" t SET "gameId" = s."gameId" FROM "Session" s WHERE s."id" = t."sessionId";
ALTER TABLE "SessionPayment" ALTER COLUMN "gameId" SET NOT NULL;
ALTER TABLE "RegistrationDraw" ADD COLUMN "gameId" TEXT;
UPDATE "RegistrationDraw" t SET "gameId" = s."gameId" FROM "RegistrationPeriod" s WHERE s."id" = t."periodId";
ALTER TABLE "RegistrationDraw" ALTER COLUMN "gameId" SET NOT NULL;
ALTER TABLE "Registration" ADD COLUMN "gameId" TEXT;
UPDATE "Registration" t SET "gameId" = s."gameId" FROM "RegistrationPeriod" s WHERE s."id" = t."periodId";
ALTER TABLE "Registration" ALTER COLUMN "gameId" SET NOT NULL;
ALTER TABLE "RegistrationRequest" ADD COLUMN "gameId" TEXT;
UPDATE "RegistrationRequest" t SET "gameId" = s."gameId" FROM "RegistrationPeriod" s WHERE s."id" = t."periodId";
ALTER TABLE "RegistrationRequest" ALTER COLUMN "gameId" SET NOT NULL;
ALTER TABLE "RegistrationFormVersion" ADD COLUMN "gameId" TEXT;
UPDATE "RegistrationFormVersion" t SET "gameId" = s."gameId" FROM "RegistrationForm" s WHERE s."id" = t."formId";
ALTER TABLE "RegistrationFormVersion" ALTER COLUMN "gameId" SET NOT NULL;

-- Unicité (id, gameId) : cible des clés composées
CREATE UNIQUE INDEX "Location_id_gameId_key" ON "Location"("id", "gameId");
CREATE UNIQUE INDEX "Registration_id_gameId_key" ON "Registration"("id", "gameId");
CREATE UNIQUE INDEX "RegistrationForm_id_gameId_key" ON "RegistrationForm"("id", "gameId");
CREATE UNIQUE INDEX "RegistrationFormVersion_id_gameId_key" ON "RegistrationFormVersion"("id", "gameId");
CREATE UNIQUE INDEX "RegistrationPeriod_id_gameId_key" ON "RegistrationPeriod"("id", "gameId");
CREATE UNIQUE INDEX "Session_id_gameId_key" ON "Session"("id", "gameId");

-- Clés étrangères composées avec le jeu
ALTER TABLE "Document" DROP CONSTRAINT "Document_characterId_gameId_fkey";
ALTER TABLE "Item" DROP CONSTRAINT "Item_locationCharacterId_gameId_fkey";
ALTER TABLE "Registration" DROP CONSTRAINT "Registration_formVersionId_fkey";
ALTER TABLE "Registration" DROP CONSTRAINT "Registration_invitedSessionId_fkey";
ALTER TABLE "Registration" DROP CONSTRAINT "Registration_periodId_fkey";
ALTER TABLE "RegistrationDraw" DROP CONSTRAINT "RegistrationDraw_periodId_fkey";
ALTER TABLE "RegistrationDraw" DROP CONSTRAINT "RegistrationDraw_sessionId_fkey";
ALTER TABLE "RegistrationFormVersion" DROP CONSTRAINT "RegistrationFormVersion_formId_fkey";
ALTER TABLE "RegistrationPeriodSession" DROP CONSTRAINT "RegistrationPeriodSession_periodId_fkey";
ALTER TABLE "RegistrationPeriodSession" DROP CONSTRAINT "RegistrationPeriodSession_sessionId_fkey";
ALTER TABLE "RegistrationRequest" DROP CONSTRAINT "RegistrationRequest_formVersionId_fkey";
ALTER TABLE "RegistrationRequest" DROP CONSTRAINT "RegistrationRequest_periodId_fkey";
ALTER TABLE "RegistrationSession" DROP CONSTRAINT "RegistrationSession_registrationId_fkey";
ALTER TABLE "RegistrationSession" DROP CONSTRAINT "RegistrationSession_sessionId_fkey";
ALTER TABLE "Session" DROP CONSTRAINT "Session_locationId_fkey";
ALTER TABLE "Session" DROP CONSTRAINT "Session_postponedToSessionId_fkey";
ALTER TABLE "SessionAssignment" DROP CONSTRAINT "SessionAssignment_characterId_fkey";
ALTER TABLE "SessionAssignment" DROP CONSTRAINT "SessionAssignment_reservedRegistrationId_fkey";
ALTER TABLE "SessionAssignment" DROP CONSTRAINT "SessionAssignment_sessionId_fkey";
ALTER TABLE "SessionDocumentDelivery" DROP CONSTRAINT "SessionDocumentDelivery_characterId_fkey";
ALTER TABLE "SessionDocumentDelivery" DROP CONSTRAINT "SessionDocumentDelivery_documentId_fkey";
ALTER TABLE "SessionDocumentDelivery" DROP CONSTRAINT "SessionDocumentDelivery_sessionId_fkey";
ALTER TABLE "SessionPayment" DROP CONSTRAINT "SessionPayment_carriedOverToSessionId_fkey";
ALTER TABLE "SessionPayment" DROP CONSTRAINT "SessionPayment_sessionId_fkey";
ALTER TABLE "SessionTrombinoscope" DROP CONSTRAINT "SessionTrombinoscope_sessionId_fkey";
ALTER TABLE "SessionTrombinoscope" DROP CONSTRAINT "SessionTrombinoscope_viewerCharacterId_fkey";
ALTER TABLE "TimelineEventResponsible" DROP CONSTRAINT "TimelineEventResponsible_sessionId_fkey";
ALTER TABLE "TimelineEventResponsible" DROP CONSTRAINT "TimelineEventResponsible_timelineEventId_fkey";
ALTER TABLE "UploadedFile" DROP CONSTRAINT "UploadedFile_sessionId_fkey";
DROP INDEX "Registration_formVersionId_idx";
DROP INDEX "Registration_invitedSessionId_idx";
DROP INDEX "RegistrationDraw_periodId_idx";
DROP INDEX "RegistrationDraw_sessionId_idx";
DROP INDEX "RegistrationPeriodSession_periodId_idx";
DROP INDEX "RegistrationRequest_formVersionId_idx";
DROP INDEX "RegistrationRequest_periodId_idx";
DROP INDEX "Session_locationId_idx";
DROP INDEX "SessionAssignment_characterId_idx";
DROP INDEX "SessionAssignment_reservedRegistrationId_idx";
DROP INDEX "SessionDocumentDelivery_characterId_idx";
DROP INDEX "SessionDocumentDelivery_documentId_idx";
DROP INDEX "SessionPayment_carriedOverToSessionId_idx";
DROP INDEX "SessionTrombinoscope_viewerCharacterId_idx";
DROP INDEX "TimelineEventResponsible_timelineEventId_idx";
DROP INDEX "UploadedFile_sessionId_idx";
CREATE INDEX "Registration_invitedSessionId_gameId_idx" ON "Registration"("invitedSessionId", "gameId");
CREATE INDEX "Registration_formVersionId_gameId_idx" ON "Registration"("formVersionId", "gameId");
CREATE INDEX "Registration_periodId_gameId_idx" ON "Registration"("periodId", "gameId");
CREATE INDEX "RegistrationDraw_periodId_gameId_idx" ON "RegistrationDraw"("periodId", "gameId");
CREATE INDEX "RegistrationDraw_sessionId_gameId_idx" ON "RegistrationDraw"("sessionId", "gameId");
CREATE INDEX "RegistrationFormVersion_formId_gameId_idx" ON "RegistrationFormVersion"("formId", "gameId");
CREATE INDEX "RegistrationPeriodSession_periodId_gameId_idx" ON "RegistrationPeriodSession"("periodId", "gameId");
CREATE UNIQUE INDEX "RegistrationPeriodSession_sessionId_gameId_key" ON "RegistrationPeriodSession"("sessionId", "gameId");
CREATE INDEX "RegistrationRequest_periodId_gameId_idx" ON "RegistrationRequest"("periodId", "gameId");
CREATE INDEX "RegistrationRequest_formVersionId_gameId_idx" ON "RegistrationRequest"("formVersionId", "gameId");
CREATE INDEX "RegistrationSession_registrationId_gameId_idx" ON "RegistrationSession"("registrationId", "gameId");
CREATE INDEX "RegistrationSession_sessionId_gameId_idx" ON "RegistrationSession"("sessionId", "gameId");
CREATE INDEX "Session_locationId_gameId_idx" ON "Session"("locationId", "gameId");
CREATE UNIQUE INDEX "Session_postponedToSessionId_gameId_key" ON "Session"("postponedToSessionId", "gameId");
CREATE INDEX "SessionAssignment_reservedRegistrationId_gameId_idx" ON "SessionAssignment"("reservedRegistrationId", "gameId");
CREATE INDEX "SessionAssignment_characterId_gameId_idx" ON "SessionAssignment"("characterId", "gameId");
CREATE INDEX "SessionAssignment_sessionId_gameId_idx" ON "SessionAssignment"("sessionId", "gameId");
CREATE INDEX "SessionDocumentDelivery_documentId_gameId_idx" ON "SessionDocumentDelivery"("documentId", "gameId");
CREATE INDEX "SessionDocumentDelivery_characterId_gameId_idx" ON "SessionDocumentDelivery"("characterId", "gameId");
CREATE INDEX "SessionDocumentDelivery_sessionId_gameId_idx" ON "SessionDocumentDelivery"("sessionId", "gameId");
CREATE INDEX "SessionPayment_carriedOverToSessionId_gameId_idx" ON "SessionPayment"("carriedOverToSessionId", "gameId");
CREATE INDEX "SessionPayment_sessionId_gameId_idx" ON "SessionPayment"("sessionId", "gameId");
CREATE INDEX "SessionTrombinoscope_viewerCharacterId_gameId_idx" ON "SessionTrombinoscope"("viewerCharacterId", "gameId");
CREATE INDEX "SessionTrombinoscope_sessionId_gameId_idx" ON "SessionTrombinoscope"("sessionId", "gameId");
CREATE INDEX "TimelineEventResponsible_timelineEventId_gameId_idx" ON "TimelineEventResponsible"("timelineEventId", "gameId");
CREATE INDEX "TimelineEventResponsible_sessionId_gameId_idx" ON "TimelineEventResponsible"("sessionId", "gameId");
CREATE INDEX "UploadedFile_sessionId_gameId_idx" ON "UploadedFile"("sessionId", "gameId");
ALTER TABLE "Item" ADD CONSTRAINT "Item_locationCharacterId_gameId_fkey" FOREIGN KEY ("locationCharacterId", "gameId") REFERENCES "Character"("id", "gameId") ON DELETE SET NULL ("locationCharacterId") ON UPDATE NO ACTION;
ALTER TABLE "Document" ADD CONSTRAINT "Document_characterId_gameId_fkey" FOREIGN KEY ("characterId", "gameId") REFERENCES "Character"("id", "gameId") ON DELETE SET NULL ("characterId") ON UPDATE NO ACTION;
ALTER TABLE "Session" ADD CONSTRAINT "Session_locationId_gameId_fkey" FOREIGN KEY ("locationId", "gameId") REFERENCES "Location"("id", "gameId") ON DELETE SET NULL ("locationId") ON UPDATE NO ACTION;
ALTER TABLE "Session" ADD CONSTRAINT "Session_postponedToSessionId_gameId_fkey" FOREIGN KEY ("postponedToSessionId", "gameId") REFERENCES "Session"("id", "gameId") ON DELETE SET NULL ("postponedToSessionId") ON UPDATE NO ACTION;
ALTER TABLE "RegistrationPeriodSession" ADD CONSTRAINT "RegistrationPeriodSession_periodId_gameId_fkey" FOREIGN KEY ("periodId", "gameId") REFERENCES "RegistrationPeriod"("id", "gameId") ON DELETE CASCADE ON UPDATE NO ACTION;
ALTER TABLE "RegistrationPeriodSession" ADD CONSTRAINT "RegistrationPeriodSession_sessionId_gameId_fkey" FOREIGN KEY ("sessionId", "gameId") REFERENCES "Session"("id", "gameId") ON DELETE CASCADE ON UPDATE NO ACTION;
ALTER TABLE "RegistrationFormVersion" ADD CONSTRAINT "RegistrationFormVersion_formId_gameId_fkey" FOREIGN KEY ("formId", "gameId") REFERENCES "RegistrationForm"("id", "gameId") ON DELETE CASCADE ON UPDATE NO ACTION;
ALTER TABLE "Registration" ADD CONSTRAINT "Registration_periodId_gameId_fkey" FOREIGN KEY ("periodId", "gameId") REFERENCES "RegistrationPeriod"("id", "gameId") ON DELETE CASCADE ON UPDATE NO ACTION;
ALTER TABLE "Registration" ADD CONSTRAINT "Registration_invitedSessionId_gameId_fkey" FOREIGN KEY ("invitedSessionId", "gameId") REFERENCES "Session"("id", "gameId") ON DELETE SET NULL ("invitedSessionId") ON UPDATE NO ACTION;
ALTER TABLE "Registration" ADD CONSTRAINT "Registration_formVersionId_gameId_fkey" FOREIGN KEY ("formVersionId", "gameId") REFERENCES "RegistrationFormVersion"("id", "gameId") ON DELETE SET NULL ("formVersionId") ON UPDATE NO ACTION;
ALTER TABLE "RegistrationSession" ADD CONSTRAINT "RegistrationSession_registrationId_gameId_fkey" FOREIGN KEY ("registrationId", "gameId") REFERENCES "Registration"("id", "gameId") ON DELETE CASCADE ON UPDATE NO ACTION;
ALTER TABLE "RegistrationSession" ADD CONSTRAINT "RegistrationSession_sessionId_gameId_fkey" FOREIGN KEY ("sessionId", "gameId") REFERENCES "Session"("id", "gameId") ON DELETE CASCADE ON UPDATE NO ACTION;
ALTER TABLE "RegistrationRequest" ADD CONSTRAINT "RegistrationRequest_periodId_gameId_fkey" FOREIGN KEY ("periodId", "gameId") REFERENCES "RegistrationPeriod"("id", "gameId") ON DELETE CASCADE ON UPDATE NO ACTION;
ALTER TABLE "RegistrationRequest" ADD CONSTRAINT "RegistrationRequest_formVersionId_gameId_fkey" FOREIGN KEY ("formVersionId", "gameId") REFERENCES "RegistrationFormVersion"("id", "gameId") ON DELETE SET NULL ("formVersionId") ON UPDATE NO ACTION;
ALTER TABLE "RegistrationDraw" ADD CONSTRAINT "RegistrationDraw_periodId_gameId_fkey" FOREIGN KEY ("periodId", "gameId") REFERENCES "RegistrationPeriod"("id", "gameId") ON DELETE CASCADE ON UPDATE NO ACTION;
ALTER TABLE "RegistrationDraw" ADD CONSTRAINT "RegistrationDraw_sessionId_gameId_fkey" FOREIGN KEY ("sessionId", "gameId") REFERENCES "Session"("id", "gameId") ON DELETE SET NULL ("sessionId") ON UPDATE NO ACTION;
ALTER TABLE "SessionAssignment" ADD CONSTRAINT "SessionAssignment_reservedRegistrationId_gameId_fkey" FOREIGN KEY ("reservedRegistrationId", "gameId") REFERENCES "Registration"("id", "gameId") ON DELETE SET NULL ("reservedRegistrationId") ON UPDATE NO ACTION;
ALTER TABLE "SessionAssignment" ADD CONSTRAINT "SessionAssignment_sessionId_gameId_fkey" FOREIGN KEY ("sessionId", "gameId") REFERENCES "Session"("id", "gameId") ON DELETE CASCADE ON UPDATE NO ACTION;
ALTER TABLE "SessionAssignment" ADD CONSTRAINT "SessionAssignment_characterId_gameId_fkey" FOREIGN KEY ("characterId", "gameId") REFERENCES "Character"("id", "gameId") ON DELETE CASCADE ON UPDATE NO ACTION;
ALTER TABLE "SessionPayment" ADD CONSTRAINT "SessionPayment_sessionId_gameId_fkey" FOREIGN KEY ("sessionId", "gameId") REFERENCES "Session"("id", "gameId") ON DELETE CASCADE ON UPDATE NO ACTION;
ALTER TABLE "SessionPayment" ADD CONSTRAINT "SessionPayment_carriedOverToSessionId_gameId_fkey" FOREIGN KEY ("carriedOverToSessionId", "gameId") REFERENCES "Session"("id", "gameId") ON DELETE SET NULL ("carriedOverToSessionId") ON UPDATE NO ACTION;
ALTER TABLE "SessionTrombinoscope" ADD CONSTRAINT "SessionTrombinoscope_sessionId_gameId_fkey" FOREIGN KEY ("sessionId", "gameId") REFERENCES "Session"("id", "gameId") ON DELETE CASCADE ON UPDATE NO ACTION;
ALTER TABLE "SessionTrombinoscope" ADD CONSTRAINT "SessionTrombinoscope_viewerCharacterId_gameId_fkey" FOREIGN KEY ("viewerCharacterId", "gameId") REFERENCES "Character"("id", "gameId") ON DELETE CASCADE ON UPDATE NO ACTION;
ALTER TABLE "SessionDocumentDelivery" ADD CONSTRAINT "SessionDocumentDelivery_sessionId_gameId_fkey" FOREIGN KEY ("sessionId", "gameId") REFERENCES "Session"("id", "gameId") ON DELETE CASCADE ON UPDATE NO ACTION;
ALTER TABLE "SessionDocumentDelivery" ADD CONSTRAINT "SessionDocumentDelivery_documentId_gameId_fkey" FOREIGN KEY ("documentId", "gameId") REFERENCES "Document"("id", "gameId") ON DELETE CASCADE ON UPDATE NO ACTION;
ALTER TABLE "SessionDocumentDelivery" ADD CONSTRAINT "SessionDocumentDelivery_characterId_gameId_fkey" FOREIGN KEY ("characterId", "gameId") REFERENCES "Character"("id", "gameId") ON DELETE CASCADE ON UPDATE NO ACTION;
ALTER TABLE "TimelineEventResponsible" ADD CONSTRAINT "TimelineEventResponsible_sessionId_gameId_fkey" FOREIGN KEY ("sessionId", "gameId") REFERENCES "Session"("id", "gameId") ON DELETE CASCADE ON UPDATE NO ACTION;
ALTER TABLE "TimelineEventResponsible" ADD CONSTRAINT "TimelineEventResponsible_timelineEventId_gameId_fkey" FOREIGN KEY ("timelineEventId", "gameId") REFERENCES "TimelineEvent"("id", "gameId") ON DELETE CASCADE ON UPDATE NO ACTION;
ALTER TABLE "UploadedFile" ADD CONSTRAINT "UploadedFile_sessionId_gameId_fkey" FOREIGN KEY ("sessionId", "gameId") REFERENCES "Session"("id", "gameId") ON DELETE CASCADE ON UPDATE NO ACTION;
