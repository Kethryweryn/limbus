-- US-188 : index des clés étrangères, dates de création, relation de la demande d'autorisation d'un assistant,
-- et rattrapage de l'écart entre les anciennes migrations et le schéma (valeurs par défaut de updatedAt, noms hérités).
-- deploiement-incompatible : faux positif du contrôle, seuls des index et des contraintes sont renommés ; le build en
-- service ne se sert pas de leurs noms, et Prisma remplit lui-même updatedAt.

-- Demandes d'autorisation dont l'autorisation a disparu (révoquée pendant la minute de validité du code) : sans elles,
-- la nouvelle clé étrangère s'ajoute
DELETE FROM "AiAuthorizationRequest" r
WHERE r."authorizationId" IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM "AiAuthorization" a WHERE a."id" = r."authorizationId");
-- AlterTable
ALTER TABLE "Document" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "Faction" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "GameInvitation" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "Intrigue" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "Item" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "Location" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "Participant" ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ALTER COLUMN "updatedAt" DROP DEFAULT;
ALTER TABLE "Participant" RENAME CONSTRAINT "Player_pkey" TO "Participant_pkey";

-- AlterTable
ALTER TABLE "ParticipantGame" RENAME CONSTRAINT "PlayerGame_pkey" TO "ParticipantGame_pkey";

-- AlterTable
ALTER TABLE "Session" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "SessionAssignment" ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "SessionParticipant" ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "User" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- CreateIndex
CREATE INDEX "AiAuthorization_clientId_idx" ON "AiAuthorization"("clientId");

-- CreateIndex
CREATE INDEX "AiAuthorizationRequest_clientId_idx" ON "AiAuthorizationRequest"("clientId");

-- CreateIndex
CREATE INDEX "AiAuthorizationRequest_authorizationId_idx" ON "AiAuthorizationRequest"("authorizationId");

-- CreateIndex
CREATE INDEX "Character_gameId_idx" ON "Character"("gameId");

-- CreateIndex
CREATE INDEX "Document_gameId_idx" ON "Document"("gameId");

-- CreateIndex
CREATE INDEX "Document_characterId_idx" ON "Document"("characterId");

-- CreateIndex
CREATE INDEX "Faction_gameId_idx" ON "Faction"("gameId");

-- CreateIndex
CREATE INDEX "Game_transferToUserId_idx" ON "Game"("transferToUserId");

-- CreateIndex
CREATE INDEX "GameInvitation_acceptedById_idx" ON "GameInvitation"("acceptedById");

-- CreateIndex
CREATE INDEX "Intrigue_gameId_idx" ON "Intrigue"("gameId");

-- CreateIndex
CREATE INDEX "Item_gameId_idx" ON "Item"("gameId");

-- CreateIndex
CREATE INDEX "Item_locationCharacterId_idx" ON "Item"("locationCharacterId");

-- CreateIndex
CREATE INDEX "Location_gameId_idx" ON "Location"("gameId");

-- CreateIndex
CREATE INDEX "Registration_formVersionId_idx" ON "Registration"("formVersionId");

-- CreateIndex
CREATE INDEX "Registration_invitedById_idx" ON "Registration"("invitedById");

-- CreateIndex
CREATE INDEX "Registration_withdrawnById_idx" ON "Registration"("withdrawnById");

-- CreateIndex
CREATE INDEX "RegistrationDraw_createdById_idx" ON "RegistrationDraw"("createdById");

-- CreateIndex
CREATE INDEX "RegistrationDraw_cancelledById_idx" ON "RegistrationDraw"("cancelledById");

-- CreateIndex
CREATE INDEX "RegistrationQuestionLink_characterId_idx" ON "RegistrationQuestionLink"("characterId");

-- CreateIndex
CREATE INDEX "RegistrationQuestionLink_factionId_idx" ON "RegistrationQuestionLink"("factionId");

-- CreateIndex
CREATE INDEX "RegistrationQuestionLink_intrigueId_idx" ON "RegistrationQuestionLink"("intrigueId");

-- CreateIndex
CREATE INDEX "RegistrationRequest_formVersionId_idx" ON "RegistrationRequest"("formVersionId");

-- CreateIndex
CREATE INDEX "RegistrationSession_cancelledById_idx" ON "RegistrationSession"("cancelledById");

-- CreateIndex
CREATE INDEX "RegistrationSession_retainedById_idx" ON "RegistrationSession"("retainedById");

-- CreateIndex
CREATE INDEX "Session_gameId_idx" ON "Session"("gameId");

-- CreateIndex
CREATE INDEX "Session_locationId_idx" ON "Session"("locationId");

-- CreateIndex
CREATE INDEX "SessionAssignment_characterId_idx" ON "SessionAssignment"("characterId");

-- CreateIndex
CREATE INDEX "SessionAssignment_participantId_idx" ON "SessionAssignment"("participantId");

-- CreateIndex
CREATE INDEX "SessionPayment_tariffId_idx" ON "SessionPayment"("tariffId");

-- CreateIndex
CREATE INDEX "SessionPayment_transferredToParticipantId_idx" ON "SessionPayment"("transferredToParticipantId");

-- CreateIndex
CREATE INDEX "SessionPayment_carriedOverToSessionId_idx" ON "SessionPayment"("carriedOverToSessionId");

-- CreateIndex
CREATE INDEX "SessionTariff_baseTariffId_idx" ON "SessionTariff"("baseTariffId");

-- CreateIndex
CREATE INDEX "SessionTrombinoscope_viewerCharacterId_idx" ON "SessionTrombinoscope"("viewerCharacterId");

-- AddForeignKey
ALTER TABLE "AiAuthorizationRequest" ADD CONSTRAINT "AiAuthorizationRequest_authorizationId_fkey" FOREIGN KEY ("authorizationId") REFERENCES "AiAuthorization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- RenameIndex
ALTER INDEX "CharacterTrombinoscopeEntry_viewerCharacterId_targetCharacterId" RENAME TO "CharacterTrombinoscopeEntry_viewerCharacterId_targetCharact_key";

-- RenameIndex
ALTER INDEX "SessionTrombinoscope_sessionId_viewerCharacterId_participantId_" RENAME TO "SessionTrombinoscope_sessionId_viewerCharacterId_participan_key";

-- RenameIndex
ALTER INDEX "TimelineEventResponsible_sessionId_timelineEventId_participantI" RENAME TO "TimelineEventResponsible_sessionId_timelineEventId_particip_key";

