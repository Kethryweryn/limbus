-- US-189 : les valeurs à liste fermée deviennent des énumérations (ADR-0073). Chaque colonne change de type sur place :
-- ses valeurs restent les mêmes, et une valeur hors liste fait échouer la migration au lieu d'être perdue.
-- deploiement-incompatible : changement de type de 28 colonnes, chaque table réécrite (courte avec les volumes actuels).
-- Vérifié sur une base migrée avec le client du build d'avant : il écrit et filtre toutes ces colonnes, mais ne sait
-- plus lire la liste Document.audiences ; les documents sont donc en erreur entre la migration et le redémarrage,
-- coupure acceptée par l'utilisatrice.

CREATE TYPE "CharacterType" AS ENUM ('pj', 'pnj');
CREATE TYPE "CharacterRelationType" AS ENUM ('romance', 'family', 'rivalry', 'alliance', 'hierarchy', 'other');
CREATE TYPE "IntrigueLevel" AS ENUM ('main_story', 'main_character', 'major', 'minor');
CREATE TYPE "DocumentRole" AS ENUM ('organizers', 'npcs', 'kitchen', 'pjs');
CREATE TYPE "DocumentAudience" AS ENUM ('targeted', 'everyone', 'organizers', 'npcs', 'kitchen');
CREATE TYPE "SessionStatus" AS ENUM ('scheduled', 'postponed', 'cancelled', 'completed');
CREATE TYPE "RegistrationPeriodState" AS ENUM ('draft', 'open', 'closed');
CREATE TYPE "ReplayPolicy" AS ENUM ('allowed', 'flagged', 'excluded');
CREATE TYPE "SelectionMode" AS ENUM ('random', 'chosen', 'mixed');
CREATE TYPE "RegistrationStatus" AS ENUM ('invited', 'received', 'withdrawn');
CREATE TYPE "RegistrationSource" AS ENUM ('invitation', 'form');
CREATE TYPE "RegistrationSessionStatus" AS ENUM ('preregistered', 'unavailable', 'waitlisted', 'retained', 'confirmed', 'transferred', 'cancelled');
CREATE TYPE "AvailabilityAnswer" AS ENUM ('available', 'unavailable');
CREATE TYPE "AffinityKind" AS ENUM ('wantWith', 'notWith', 'avoid', 'refusedRelations', 'refusedRelationTypes');
CREATE TYPE "SessionRole" AS ENUM ('participant', 'organizer', 'npc', 'kitchen');
CREATE TYPE "TariffRole" AS ENUM ('pj', 'pnj', 'organizer', 'kitchen');
CREATE TYPE "RefundStatus" AS ENUM ('to_refund', 'refunded', 'carried_over', 'kept', 'transferred');
CREATE TYPE "DeliveryKind" AS ENUM ('document', 'character_sheet', 'trombinoscope', 'character_sheet_bundle');
CREATE TYPE "UploadKind" AS ENUM ('session-assignment-photo', 'session-payment-rib');
CREATE TYPE "UserRole" AS ENUM ('admin', 'user');
CREATE TYPE "AccountTokenKind" AS ENUM ('confirm', 'email', 'password');
CREATE TYPE "GameShareRole" AS ENUM ('organizer');
CREATE TYPE "GameInvitationStatus" AS ENUM ('pending', 'accepted', 'revoked');
CREATE TYPE "GameInvitationKind" AS ENUM ('share', 'bequest');
CREATE TYPE "AttendanceStatus" AS ENUM ('pending', 'confirmed', 'declined', 'released');
CREATE TYPE "AiTokenKind" AS ENUM ('access', 'refresh');

ALTER TABLE "Character"
  ALTER COLUMN "type" DROP DEFAULT,
  ALTER COLUMN "type" TYPE "CharacterType" USING "type"::text::"CharacterType",
  ALTER COLUMN "type" SET DEFAULT 'pj';
ALTER TABLE "CharacterRelation"
  ALTER COLUMN "type" TYPE "CharacterRelationType" USING "type"::text::"CharacterRelationType";
ALTER TABLE "Intrigue"
  ALTER COLUMN "level" DROP DEFAULT,
  ALTER COLUMN "level" TYPE "IntrigueLevel" USING "level"::text::"IntrigueLevel",
  ALTER COLUMN "level" SET DEFAULT 'minor';
ALTER TABLE "Document"
  ALTER COLUMN "audience" DROP DEFAULT,
  ALTER COLUMN "audience" TYPE "DocumentAudience" USING "audience"::text::"DocumentAudience",
  ALTER COLUMN "audience" SET DEFAULT 'targeted';
ALTER TABLE "Document"
  ALTER COLUMN "audiences" DROP DEFAULT,
  ALTER COLUMN "audiences" TYPE "DocumentRole"[] USING "audiences"::text[]::"DocumentRole"[],
  ALTER COLUMN "audiences" SET DEFAULT ARRAY[]::"DocumentRole"[];
ALTER TABLE "Session"
  ALTER COLUMN "status" DROP DEFAULT,
  ALTER COLUMN "status" TYPE "SessionStatus" USING "status"::text::"SessionStatus",
  ALTER COLUMN "status" SET DEFAULT 'scheduled';
ALTER TABLE "RegistrationPeriod"
  ALTER COLUMN "state" DROP DEFAULT,
  ALTER COLUMN "state" TYPE "RegistrationPeriodState" USING "state"::text::"RegistrationPeriodState",
  ALTER COLUMN "state" SET DEFAULT 'draft';
ALTER TABLE "RegistrationPeriod"
  ALTER COLUMN "replayPolicy" DROP DEFAULT,
  ALTER COLUMN "replayPolicy" TYPE "ReplayPolicy" USING "replayPolicy"::text::"ReplayPolicy",
  ALTER COLUMN "replayPolicy" SET DEFAULT 'allowed';
ALTER TABLE "RegistrationPeriodSession"
  ALTER COLUMN "selectionMode" DROP DEFAULT,
  ALTER COLUMN "selectionMode" TYPE "SelectionMode" USING "selectionMode"::text::"SelectionMode",
  ALTER COLUMN "selectionMode" SET DEFAULT 'chosen';
ALTER TABLE "Registration"
  ALTER COLUMN "status" TYPE "RegistrationStatus" USING "status"::text::"RegistrationStatus";
ALTER TABLE "Registration"
  ALTER COLUMN "source" TYPE "RegistrationSource" USING "source"::text::"RegistrationSource";
ALTER TABLE "RegistrationSession"
  ALTER COLUMN "status" TYPE "RegistrationSessionStatus" USING "status"::text::"RegistrationSessionStatus";
ALTER TABLE "RegistrationSession"
  ALTER COLUMN "answer" TYPE "AvailabilityAnswer" USING "answer"::text::"AvailabilityAnswer";
ALTER TABLE "RegistrationSession"
  ALTER COLUMN "announcedStatus" TYPE "RegistrationSessionStatus" USING "announcedStatus"::text::"RegistrationSessionStatus";
ALTER TABLE "RegistrationSession"
  ALTER COLUMN "ignoredStatus" TYPE "RegistrationSessionStatus" USING "ignoredStatus"::text::"RegistrationSessionStatus";
ALTER TABLE "RegistrationAffinity"
  ALTER COLUMN "kind" TYPE "AffinityKind" USING "kind"::text::"AffinityKind";
ALTER TABLE "SessionParticipant"
  ALTER COLUMN "role" TYPE "SessionRole" USING "role"::text::"SessionRole";
ALTER TABLE "SessionTariff"
  ALTER COLUMN "defaultRole" TYPE "TariffRole" USING "defaultRole"::text::"TariffRole";
ALTER TABLE "SessionPayment"
  ALTER COLUMN "refundStatus" TYPE "RefundStatus" USING "refundStatus"::text::"RefundStatus";
-- Index uniques partiels écrits à la main (migration 20260523052000) : leur prédicat compare kind à du texte,
-- ils sont recréés sur le nouveau type
DROP INDEX IF EXISTS "SessionDocumentDelivery_document_once_key";
DROP INDEX IF EXISTS "SessionDocumentDelivery_character_sheet_once_key";
ALTER TABLE "SessionDocumentDelivery"
  ALTER COLUMN "kind" DROP DEFAULT,
  ALTER COLUMN "kind" TYPE "DeliveryKind" USING "kind"::text::"DeliveryKind",
  ALTER COLUMN "kind" SET DEFAULT 'document';
CREATE UNIQUE INDEX "SessionDocumentDelivery_document_once_key"
ON "SessionDocumentDelivery"("sessionId", "documentId", "participantId", "kind")
WHERE "documentId" IS NOT NULL AND "kind" = 'document';
CREATE UNIQUE INDEX "SessionDocumentDelivery_character_sheet_once_key"
ON "SessionDocumentDelivery"("sessionId", "characterId", "participantId", "kind")
WHERE "characterId" IS NOT NULL AND "kind" = 'character_sheet';
ALTER TABLE "UploadedFile"
  ALTER COLUMN "kind" TYPE "UploadKind" USING "kind"::text::"UploadKind";
ALTER TABLE "User"
  ALTER COLUMN "role" DROP DEFAULT,
  ALTER COLUMN "role" TYPE "UserRole" USING "role"::text::"UserRole",
  ALTER COLUMN "role" SET DEFAULT 'user';
ALTER TABLE "AccountToken"
  ALTER COLUMN "kind" TYPE "AccountTokenKind" USING "kind"::text::"AccountTokenKind";
ALTER TABLE "GameShare"
  ALTER COLUMN "role" DROP DEFAULT,
  ALTER COLUMN "role" TYPE "GameShareRole" USING "role"::text::"GameShareRole",
  ALTER COLUMN "role" SET DEFAULT 'organizer';
ALTER TABLE "GameInvitation"
  ALTER COLUMN "status" DROP DEFAULT,
  ALTER COLUMN "status" TYPE "GameInvitationStatus" USING "status"::text::"GameInvitationStatus",
  ALTER COLUMN "status" SET DEFAULT 'pending';
ALTER TABLE "GameInvitation"
  ALTER COLUMN "kind" DROP DEFAULT,
  ALTER COLUMN "kind" TYPE "GameInvitationKind" USING "kind"::text::"GameInvitationKind",
  ALTER COLUMN "kind" SET DEFAULT 'share';
ALTER TABLE "SessionAttendance"
  ALTER COLUMN "status" DROP DEFAULT,
  ALTER COLUMN "status" TYPE "AttendanceStatus" USING "status"::text::"AttendanceStatus",
  ALTER COLUMN "status" SET DEFAULT 'pending';
ALTER TABLE "AiToken"
  ALTER COLUMN "kind" TYPE "AiTokenKind" USING "kind"::text::"AiTokenKind";
