-- US-194 (ADR-0076) : les dates sont stockées avec leur fuseau. Prisma les écrit et les lit en UTC ; la base de
-- production est réglée sur Europe/Paris : sans USING, PostgreSQL lirait l'existant comme de l'heure de Paris et le
-- décalerait. Chaque valeur est donc lue comme de l'UTC.
--
-- deploiement-incompatible : changement de type de toutes les dates. Vérifié avec le client Prisma du build en service
-- sur une base migrée : il lit les mêmes instants qu'avant, et ceux qu'il écrit sont relus à l'identique.
-- Production relevée le 2026-11-09 : 115 colonnes, 15 Mo ; les dates écrites par Prisma sont en UTC, celles posées par
-- la base pendant une migration en heure de Paris (66 fiches et 96 lignes de casting à 00:44:52 pour une migration
-- terminée à 23:44:54 UTC).

-- Dates posées par la base pendant une migration (DEFAULT CURRENT_TIMESTAMP d'une colonne ajoutée) : écrites dans le
-- fuseau de la session de migration, Europe/Paris en production, elles avaient une à deux heures d'avance. Une valeur
-- comprise dans la durée d'une migration, lue en heure de Paris, est ramenée en UTC avant la conversion. Sur une base
-- en UTC, aucune valeur ne tombe dans ces fenêtres : rien ne change.
UPDATE "Item" SET "createdAt" = ("createdAt" AT TIME ZONE 'Europe/Paris') AT TIME ZONE 'UTC'
WHERE EXISTS (SELECT 1 FROM "_prisma_migrations" m WHERE m.finished_at IS NOT NULL
  AND "Item"."createdAt" BETWEEN (m.started_at AT TIME ZONE 'Europe/Paris') - interval '5 seconds' AND (m.finished_at AT TIME ZONE 'Europe/Paris') + interval '5 seconds');
UPDATE "Item" SET "updatedAt" = ("updatedAt" AT TIME ZONE 'Europe/Paris') AT TIME ZONE 'UTC'
WHERE EXISTS (SELECT 1 FROM "_prisma_migrations" m WHERE m.finished_at IS NOT NULL
  AND "Item"."updatedAt" BETWEEN (m.started_at AT TIME ZONE 'Europe/Paris') - interval '5 seconds' AND (m.finished_at AT TIME ZONE 'Europe/Paris') + interval '5 seconds');
UPDATE "Faction" SET "createdAt" = ("createdAt" AT TIME ZONE 'Europe/Paris') AT TIME ZONE 'UTC'
WHERE EXISTS (SELECT 1 FROM "_prisma_migrations" m WHERE m.finished_at IS NOT NULL
  AND "Faction"."createdAt" BETWEEN (m.started_at AT TIME ZONE 'Europe/Paris') - interval '5 seconds' AND (m.finished_at AT TIME ZONE 'Europe/Paris') + interval '5 seconds');
UPDATE "Faction" SET "updatedAt" = ("updatedAt" AT TIME ZONE 'Europe/Paris') AT TIME ZONE 'UTC'
WHERE EXISTS (SELECT 1 FROM "_prisma_migrations" m WHERE m.finished_at IS NOT NULL
  AND "Faction"."updatedAt" BETWEEN (m.started_at AT TIME ZONE 'Europe/Paris') - interval '5 seconds' AND (m.finished_at AT TIME ZONE 'Europe/Paris') + interval '5 seconds');
UPDATE "Intrigue" SET "createdAt" = ("createdAt" AT TIME ZONE 'Europe/Paris') AT TIME ZONE 'UTC'
WHERE EXISTS (SELECT 1 FROM "_prisma_migrations" m WHERE m.finished_at IS NOT NULL
  AND "Intrigue"."createdAt" BETWEEN (m.started_at AT TIME ZONE 'Europe/Paris') - interval '5 seconds' AND (m.finished_at AT TIME ZONE 'Europe/Paris') + interval '5 seconds');
UPDATE "Intrigue" SET "updatedAt" = ("updatedAt" AT TIME ZONE 'Europe/Paris') AT TIME ZONE 'UTC'
WHERE EXISTS (SELECT 1 FROM "_prisma_migrations" m WHERE m.finished_at IS NOT NULL
  AND "Intrigue"."updatedAt" BETWEEN (m.started_at AT TIME ZONE 'Europe/Paris') - interval '5 seconds' AND (m.finished_at AT TIME ZONE 'Europe/Paris') + interval '5 seconds');
UPDATE "Session" SET "createdAt" = ("createdAt" AT TIME ZONE 'Europe/Paris') AT TIME ZONE 'UTC'
WHERE EXISTS (SELECT 1 FROM "_prisma_migrations" m WHERE m.finished_at IS NOT NULL
  AND "Session"."createdAt" BETWEEN (m.started_at AT TIME ZONE 'Europe/Paris') - interval '5 seconds' AND (m.finished_at AT TIME ZONE 'Europe/Paris') + interval '5 seconds');
UPDATE "Session" SET "updatedAt" = ("updatedAt" AT TIME ZONE 'Europe/Paris') AT TIME ZONE 'UTC'
WHERE EXISTS (SELECT 1 FROM "_prisma_migrations" m WHERE m.finished_at IS NOT NULL
  AND "Session"."updatedAt" BETWEEN (m.started_at AT TIME ZONE 'Europe/Paris') - interval '5 seconds' AND (m.finished_at AT TIME ZONE 'Europe/Paris') + interval '5 seconds');
UPDATE "Location" SET "createdAt" = ("createdAt" AT TIME ZONE 'Europe/Paris') AT TIME ZONE 'UTC'
WHERE EXISTS (SELECT 1 FROM "_prisma_migrations" m WHERE m.finished_at IS NOT NULL
  AND "Location"."createdAt" BETWEEN (m.started_at AT TIME ZONE 'Europe/Paris') - interval '5 seconds' AND (m.finished_at AT TIME ZONE 'Europe/Paris') + interval '5 seconds');
UPDATE "Location" SET "updatedAt" = ("updatedAt" AT TIME ZONE 'Europe/Paris') AT TIME ZONE 'UTC'
WHERE EXISTS (SELECT 1 FROM "_prisma_migrations" m WHERE m.finished_at IS NOT NULL
  AND "Location"."updatedAt" BETWEEN (m.started_at AT TIME ZONE 'Europe/Paris') - interval '5 seconds' AND (m.finished_at AT TIME ZONE 'Europe/Paris') + interval '5 seconds');
UPDATE "Document" SET "createdAt" = ("createdAt" AT TIME ZONE 'Europe/Paris') AT TIME ZONE 'UTC'
WHERE EXISTS (SELECT 1 FROM "_prisma_migrations" m WHERE m.finished_at IS NOT NULL
  AND "Document"."createdAt" BETWEEN (m.started_at AT TIME ZONE 'Europe/Paris') - interval '5 seconds' AND (m.finished_at AT TIME ZONE 'Europe/Paris') + interval '5 seconds');
UPDATE "Document" SET "updatedAt" = ("updatedAt" AT TIME ZONE 'Europe/Paris') AT TIME ZONE 'UTC'
WHERE EXISTS (SELECT 1 FROM "_prisma_migrations" m WHERE m.finished_at IS NOT NULL
  AND "Document"."updatedAt" BETWEEN (m.started_at AT TIME ZONE 'Europe/Paris') - interval '5 seconds' AND (m.finished_at AT TIME ZONE 'Europe/Paris') + interval '5 seconds');
UPDATE "User" SET "createdAt" = ("createdAt" AT TIME ZONE 'Europe/Paris') AT TIME ZONE 'UTC'
WHERE EXISTS (SELECT 1 FROM "_prisma_migrations" m WHERE m.finished_at IS NOT NULL
  AND "User"."createdAt" BETWEEN (m.started_at AT TIME ZONE 'Europe/Paris') - interval '5 seconds' AND (m.finished_at AT TIME ZONE 'Europe/Paris') + interval '5 seconds');
UPDATE "User" SET "updatedAt" = ("updatedAt" AT TIME ZONE 'Europe/Paris') AT TIME ZONE 'UTC'
WHERE EXISTS (SELECT 1 FROM "_prisma_migrations" m WHERE m.finished_at IS NOT NULL
  AND "User"."updatedAt" BETWEEN (m.started_at AT TIME ZONE 'Europe/Paris') - interval '5 seconds' AND (m.finished_at AT TIME ZONE 'Europe/Paris') + interval '5 seconds');
UPDATE "User" SET "emailConfirmedAt" = ("emailConfirmedAt" AT TIME ZONE 'Europe/Paris') AT TIME ZONE 'UTC'
WHERE EXISTS (SELECT 1 FROM "_prisma_migrations" m WHERE m.finished_at IS NOT NULL
  AND "User"."emailConfirmedAt" BETWEEN (m.started_at AT TIME ZONE 'Europe/Paris') - interval '5 seconds' AND (m.finished_at AT TIME ZONE 'Europe/Paris') + interval '5 seconds');
UPDATE "User" SET "lastSeenAt" = ("lastSeenAt" AT TIME ZONE 'Europe/Paris') AT TIME ZONE 'UTC'
WHERE EXISTS (SELECT 1 FROM "_prisma_migrations" m WHERE m.finished_at IS NOT NULL
  AND "User"."lastSeenAt" BETWEEN (m.started_at AT TIME ZONE 'Europe/Paris') - interval '5 seconds' AND (m.finished_at AT TIME ZONE 'Europe/Paris') + interval '5 seconds');
UPDATE "Participant" SET "createdAt" = ("createdAt" AT TIME ZONE 'Europe/Paris') AT TIME ZONE 'UTC'
WHERE EXISTS (SELECT 1 FROM "_prisma_migrations" m WHERE m.finished_at IS NOT NULL
  AND "Participant"."createdAt" BETWEEN (m.started_at AT TIME ZONE 'Europe/Paris') - interval '5 seconds' AND (m.finished_at AT TIME ZONE 'Europe/Paris') + interval '5 seconds');
UPDATE "Participant" SET "updatedAt" = ("updatedAt" AT TIME ZONE 'Europe/Paris') AT TIME ZONE 'UTC'
WHERE EXISTS (SELECT 1 FROM "_prisma_migrations" m WHERE m.finished_at IS NOT NULL
  AND "Participant"."updatedAt" BETWEEN (m.started_at AT TIME ZONE 'Europe/Paris') - interval '5 seconds' AND (m.finished_at AT TIME ZONE 'Europe/Paris') + interval '5 seconds');
UPDATE "SessionAssignment" SET "createdAt" = ("createdAt" AT TIME ZONE 'Europe/Paris') AT TIME ZONE 'UTC'
WHERE EXISTS (SELECT 1 FROM "_prisma_migrations" m WHERE m.finished_at IS NOT NULL
  AND "SessionAssignment"."createdAt" BETWEEN (m.started_at AT TIME ZONE 'Europe/Paris') - interval '5 seconds' AND (m.finished_at AT TIME ZONE 'Europe/Paris') + interval '5 seconds');
UPDATE "SessionParticipant" SET "createdAt" = ("createdAt" AT TIME ZONE 'Europe/Paris') AT TIME ZONE 'UTC'
WHERE EXISTS (SELECT 1 FROM "_prisma_migrations" m WHERE m.finished_at IS NOT NULL
  AND "SessionParticipant"."createdAt" BETWEEN (m.started_at AT TIME ZONE 'Europe/Paris') - interval '5 seconds' AND (m.finished_at AT TIME ZONE 'Europe/Paris') + interval '5 seconds');

-- Conversion : chaque valeur lue comme de l'UTC
ALTER TABLE "AccountToken" ALTER COLUMN "expiresAt" SET DATA TYPE TIMESTAMPTZ(3) USING "expiresAt" AT TIME ZONE 'UTC',
ALTER COLUMN "usedAt" SET DATA TYPE TIMESTAMPTZ(3) USING "usedAt" AT TIME ZONE 'UTC',
ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMPTZ(3) USING "createdAt" AT TIME ZONE 'UTC';

ALTER TABLE "AiAuthorization" ALTER COLUMN "lastUsedAt" SET DATA TYPE TIMESTAMPTZ(3) USING "lastUsedAt" AT TIME ZONE 'UTC',
ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMPTZ(3) USING "createdAt" AT TIME ZONE 'UTC';

ALTER TABLE "AiAuthorizationRequest" ALTER COLUMN "expiresAt" SET DATA TYPE TIMESTAMPTZ(3) USING "expiresAt" AT TIME ZONE 'UTC',
ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMPTZ(3) USING "createdAt" AT TIME ZONE 'UTC';

ALTER TABLE "AiClient" ALTER COLUMN "fetchedAt" SET DATA TYPE TIMESTAMPTZ(3) USING "fetchedAt" AT TIME ZONE 'UTC',
ALTER COLUMN "usedAt" SET DATA TYPE TIMESTAMPTZ(3) USING "usedAt" AT TIME ZONE 'UTC',
ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMPTZ(3) USING "createdAt" AT TIME ZONE 'UTC';

ALTER TABLE "AiLogEntry" ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMPTZ(3) USING "createdAt" AT TIME ZONE 'UTC';

ALTER TABLE "AiToken" ALTER COLUMN "expiresAt" SET DATA TYPE TIMESTAMPTZ(3) USING "expiresAt" AT TIME ZONE 'UTC',
ALTER COLUMN "usedAt" SET DATA TYPE TIMESTAMPTZ(3) USING "usedAt" AT TIME ZONE 'UTC',
ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMPTZ(3) USING "createdAt" AT TIME ZONE 'UTC';

ALTER TABLE "Character" ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMPTZ(3) USING "createdAt" AT TIME ZONE 'UTC',
ALTER COLUMN "updatedAt" SET DATA TYPE TIMESTAMPTZ(3) USING "updatedAt" AT TIME ZONE 'UTC';

ALTER TABLE "CharacterRelation" ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMPTZ(3) USING "createdAt" AT TIME ZONE 'UTC',
ALTER COLUMN "updatedAt" SET DATA TYPE TIMESTAMPTZ(3) USING "updatedAt" AT TIME ZONE 'UTC';

ALTER TABLE "CharacterTrombinoscopeEntry" ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMPTZ(3) USING "createdAt" AT TIME ZONE 'UTC',
ALTER COLUMN "updatedAt" SET DATA TYPE TIMESTAMPTZ(3) USING "updatedAt" AT TIME ZONE 'UTC';

ALTER TABLE "CspViolation" ALTER COLUMN "firstSeenAt" SET DATA TYPE TIMESTAMPTZ(3) USING "firstSeenAt" AT TIME ZONE 'UTC',
ALTER COLUMN "lastSeenAt" SET DATA TYPE TIMESTAMPTZ(3) USING "lastSeenAt" AT TIME ZONE 'UTC';

ALTER TABLE "Document" ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMPTZ(3) USING "createdAt" AT TIME ZONE 'UTC',
ALTER COLUMN "updatedAt" SET DATA TYPE TIMESTAMPTZ(3) USING "updatedAt" AT TIME ZONE 'UTC';

ALTER TABLE "Faction" ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMPTZ(3) USING "createdAt" AT TIME ZONE 'UTC',
ALTER COLUMN "updatedAt" SET DATA TYPE TIMESTAMPTZ(3) USING "updatedAt" AT TIME ZONE 'UTC';

ALTER TABLE "Game" ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMPTZ(3) USING "createdAt" AT TIME ZONE 'UTC',
ALTER COLUMN "updatedAt" SET DATA TYPE TIMESTAMPTZ(3) USING "updatedAt" AT TIME ZONE 'UTC';

ALTER TABLE "GameInvitation" ALTER COLUMN "expiresAt" SET DATA TYPE TIMESTAMPTZ(3) USING "expiresAt" AT TIME ZONE 'UTC',
ALTER COLUMN "acceptedAt" SET DATA TYPE TIMESTAMPTZ(3) USING "acceptedAt" AT TIME ZONE 'UTC',
ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMPTZ(3) USING "createdAt" AT TIME ZONE 'UTC',
ALTER COLUMN "updatedAt" SET DATA TYPE TIMESTAMPTZ(3) USING "updatedAt" AT TIME ZONE 'UTC';

ALTER TABLE "GameShare" ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMPTZ(3) USING "createdAt" AT TIME ZONE 'UTC';

ALTER TABLE "GameSlugRedirect" ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMPTZ(3) USING "createdAt" AT TIME ZONE 'UTC';

ALTER TABLE "Intrigue" ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMPTZ(3) USING "createdAt" AT TIME ZONE 'UTC',
ALTER COLUMN "updatedAt" SET DATA TYPE TIMESTAMPTZ(3) USING "updatedAt" AT TIME ZONE 'UTC';

ALTER TABLE "Item" ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMPTZ(3) USING "createdAt" AT TIME ZONE 'UTC',
ALTER COLUMN "updatedAt" SET DATA TYPE TIMESTAMPTZ(3) USING "updatedAt" AT TIME ZONE 'UTC';

ALTER TABLE "Location" ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMPTZ(3) USING "createdAt" AT TIME ZONE 'UTC',
ALTER COLUMN "updatedAt" SET DATA TYPE TIMESTAMPTZ(3) USING "updatedAt" AT TIME ZONE 'UTC';

ALTER TABLE "Participant" ALTER COLUMN "updatedAt" SET DATA TYPE TIMESTAMPTZ(3) USING "updatedAt" AT TIME ZONE 'UTC',
ALTER COLUMN "photoRefusedAt" SET DATA TYPE TIMESTAMPTZ(3) USING "photoRefusedAt" AT TIME ZONE 'UTC',
ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMPTZ(3) USING "createdAt" AT TIME ZONE 'UTC';

ALTER TABLE "ParticipantGame" ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMPTZ(3) USING "createdAt" AT TIME ZONE 'UTC';

ALTER TABLE "Registration" ALTER COLUMN "healthConsentAt" SET DATA TYPE TIMESTAMPTZ(3) USING "healthConsentAt" AT TIME ZONE 'UTC',
ALTER COLUMN "charterAcceptedAt" SET DATA TYPE TIMESTAMPTZ(3) USING "charterAcceptedAt" AT TIME ZONE 'UTC',
ALTER COLUMN "invitationSentAt" SET DATA TYPE TIMESTAMPTZ(3) USING "invitationSentAt" AT TIME ZONE 'UTC',
ALTER COLUMN "responseDueAt" SET DATA TYPE TIMESTAMPTZ(3) USING "responseDueAt" AT TIME ZONE 'UTC',
ALTER COLUMN "respondedAt" SET DATA TYPE TIMESTAMPTZ(3) USING "respondedAt" AT TIME ZONE 'UTC',
ALTER COLUMN "withdrawnAt" SET DATA TYPE TIMESTAMPTZ(3) USING "withdrawnAt" AT TIME ZONE 'UTC',
ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMPTZ(3) USING "createdAt" AT TIME ZONE 'UTC',
ALTER COLUMN "updatedAt" SET DATA TYPE TIMESTAMPTZ(3) USING "updatedAt" AT TIME ZONE 'UTC',
ALTER COLUMN "lastRemindedAt" SET DATA TYPE TIMESTAMPTZ(3) USING "lastRemindedAt" AT TIME ZONE 'UTC';

ALTER TABLE "RegistrationDraw" ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMPTZ(3) USING "createdAt" AT TIME ZONE 'UTC',
ALTER COLUMN "cancelledAt" SET DATA TYPE TIMESTAMPTZ(3) USING "cancelledAt" AT TIME ZONE 'UTC';

ALTER TABLE "RegistrationForm" ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMPTZ(3) USING "createdAt" AT TIME ZONE 'UTC',
ALTER COLUMN "updatedAt" SET DATA TYPE TIMESTAMPTZ(3) USING "updatedAt" AT TIME ZONE 'UTC';

ALTER TABLE "RegistrationFormVersion" ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMPTZ(3) USING "createdAt" AT TIME ZONE 'UTC';

ALTER TABLE "RegistrationLink" ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMPTZ(3) USING "createdAt" AT TIME ZONE 'UTC';

ALTER TABLE "RegistrationOptionExpectation" ALTER COLUMN "updatedAt" SET DATA TYPE TIMESTAMPTZ(3) USING "updatedAt" AT TIME ZONE 'UTC';

ALTER TABLE "RegistrationPeriod" ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMPTZ(3) USING "createdAt" AT TIME ZONE 'UTC',
ALTER COLUMN "updatedAt" SET DATA TYPE TIMESTAMPTZ(3) USING "updatedAt" AT TIME ZONE 'UTC';

ALTER TABLE "RegistrationPeriodSession" ALTER COLUMN "lastRequestedAt" SET DATA TYPE TIMESTAMPTZ(3) USING "lastRequestedAt" AT TIME ZONE 'UTC',
ALTER COLUMN "castAnnouncedAt" SET DATA TYPE TIMESTAMPTZ(3) USING "castAnnouncedAt" AT TIME ZONE 'UTC';

ALTER TABLE "RegistrationRequest" ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMPTZ(3) USING "createdAt" AT TIME ZONE 'UTC';

ALTER TABLE "RegistrationSession" ALTER COLUMN "answeredAt" SET DATA TYPE TIMESTAMPTZ(3) USING "answeredAt" AT TIME ZONE 'UTC',
ALTER COLUMN "lastRemindedAt" SET DATA TYPE TIMESTAMPTZ(3) USING "lastRemindedAt" AT TIME ZONE 'UTC',
ALTER COLUMN "responseDueAt" SET DATA TYPE TIMESTAMPTZ(3) USING "responseDueAt" AT TIME ZONE 'UTC',
ALTER COLUMN "confirmedAt" SET DATA TYPE TIMESTAMPTZ(3) USING "confirmedAt" AT TIME ZONE 'UTC',
ALTER COLUMN "cancelledAt" SET DATA TYPE TIMESTAMPTZ(3) USING "cancelledAt" AT TIME ZONE 'UTC',
ALTER COLUMN "announcedAt" SET DATA TYPE TIMESTAMPTZ(3) USING "announcedAt" AT TIME ZONE 'UTC',
ALTER COLUMN "answersChangedAt" SET DATA TYPE TIMESTAMPTZ(3) USING "answersChangedAt" AT TIME ZONE 'UTC',
ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMPTZ(3) USING "createdAt" AT TIME ZONE 'UTC',
ALTER COLUMN "updatedAt" SET DATA TYPE TIMESTAMPTZ(3) USING "updatedAt" AT TIME ZONE 'UTC';

ALTER TABLE "Session" ALTER COLUMN "date" SET DATA TYPE TIMESTAMPTZ(3) USING "date" AT TIME ZONE 'UTC',
ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMPTZ(3) USING "createdAt" AT TIME ZONE 'UTC',
ALTER COLUMN "updatedAt" SET DATA TYPE TIMESTAMPTZ(3) USING "updatedAt" AT TIME ZONE 'UTC',
ALTER COLUMN "withdrawalDeadline" SET DATA TYPE TIMESTAMPTZ(3) USING "withdrawalDeadline" AT TIME ZONE 'UTC',
ALTER COLUMN "paymentSettingsUpdatedAt" SET DATA TYPE TIMESTAMPTZ(3) USING "paymentSettingsUpdatedAt" AT TIME ZONE 'UTC',
ALTER COLUMN "cancelledAt" SET DATA TYPE TIMESTAMPTZ(3) USING "cancelledAt" AT TIME ZONE 'UTC';

ALTER TABLE "SessionAssignment" ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMPTZ(3) USING "createdAt" AT TIME ZONE 'UTC';

ALTER TABLE "SessionAttendance" ALTER COLUMN "responseDueAt" SET DATA TYPE TIMESTAMPTZ(3) USING "responseDueAt" AT TIME ZONE 'UTC',
ALTER COLUMN "invitationSentAt" SET DATA TYPE TIMESTAMPTZ(3) USING "invitationSentAt" AT TIME ZONE 'UTC',
ALTER COLUMN "lastRemindedAt" SET DATA TYPE TIMESTAMPTZ(3) USING "lastRemindedAt" AT TIME ZONE 'UTC',
ALTER COLUMN "respondedAt" SET DATA TYPE TIMESTAMPTZ(3) USING "respondedAt" AT TIME ZONE 'UTC',
ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMPTZ(3) USING "createdAt" AT TIME ZONE 'UTC',
ALTER COLUMN "updatedAt" SET DATA TYPE TIMESTAMPTZ(3) USING "updatedAt" AT TIME ZONE 'UTC';

ALTER TABLE "SessionDocumentDelivery" ALTER COLUMN "sentAt" SET DATA TYPE TIMESTAMPTZ(3) USING "sentAt" AT TIME ZONE 'UTC';

ALTER TABLE "SessionParticipant" ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMPTZ(3) USING "createdAt" AT TIME ZONE 'UTC';

ALTER TABLE "SessionPayment" ALTER COLUMN "paidAt" SET DATA TYPE TIMESTAMPTZ(3) USING "paidAt" AT TIME ZONE 'UTC',
ALTER COLUMN "paymentEmailSentAt" SET DATA TYPE TIMESTAMPTZ(3) USING "paymentEmailSentAt" AT TIME ZONE 'UTC',
ALTER COLUMN "paymentReminderSentAt" SET DATA TYPE TIMESTAMPTZ(3) USING "paymentReminderSentAt" AT TIME ZONE 'UTC',
ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMPTZ(3) USING "createdAt" AT TIME ZONE 'UTC',
ALTER COLUMN "updatedAt" SET DATA TYPE TIMESTAMPTZ(3) USING "updatedAt" AT TIME ZONE 'UTC',
ALTER COLUMN "refundedAt" SET DATA TYPE TIMESTAMPTZ(3) USING "refundedAt" AT TIME ZONE 'UTC';

ALTER TABLE "SessionPaymentInstalment" ALTER COLUMN "receivedAt" SET DATA TYPE TIMESTAMPTZ(3) USING "receivedAt" AT TIME ZONE 'UTC',
ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMPTZ(3) USING "createdAt" AT TIME ZONE 'UTC';

ALTER TABLE "SessionTariff" ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMPTZ(3) USING "createdAt" AT TIME ZONE 'UTC',
ALTER COLUMN "updatedAt" SET DATA TYPE TIMESTAMPTZ(3) USING "updatedAt" AT TIME ZONE 'UTC';

ALTER TABLE "SessionTrombinoscope" ALTER COLUMN "generatedAt" SET DATA TYPE TIMESTAMPTZ(3) USING "generatedAt" AT TIME ZONE 'UTC';

ALTER TABLE "SmtpSettings" ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMPTZ(3) USING "createdAt" AT TIME ZONE 'UTC',
ALTER COLUMN "updatedAt" SET DATA TYPE TIMESTAMPTZ(3) USING "updatedAt" AT TIME ZONE 'UTC';

ALTER TABLE "TimelineEvent" ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMPTZ(3) USING "createdAt" AT TIME ZONE 'UTC',
ALTER COLUMN "updatedAt" SET DATA TYPE TIMESTAMPTZ(3) USING "updatedAt" AT TIME ZONE 'UTC';

ALTER TABLE "UploadedFile" ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMPTZ(3) USING "createdAt" AT TIME ZONE 'UTC';

ALTER TABLE "User" ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMPTZ(3) USING "createdAt" AT TIME ZONE 'UTC',
ALTER COLUMN "updatedAt" SET DATA TYPE TIMESTAMPTZ(3) USING "updatedAt" AT TIME ZONE 'UTC',
ALTER COLUMN "emailConfirmedAt" SET DATA TYPE TIMESTAMPTZ(3) USING "emailConfirmedAt" AT TIME ZONE 'UTC',
ALTER COLUMN "disabledAt" SET DATA TYPE TIMESTAMPTZ(3) USING "disabledAt" AT TIME ZONE 'UTC',
ALTER COLUMN "healthConsentAt" SET DATA TYPE TIMESTAMPTZ(3) USING "healthConsentAt" AT TIME ZONE 'UTC',
ALTER COLUMN "profileUpdatedAt" SET DATA TYPE TIMESTAMPTZ(3) USING "profileUpdatedAt" AT TIME ZONE 'UTC',
ALTER COLUMN "inactivityReportedAt" SET DATA TYPE TIMESTAMPTZ(3) USING "inactivityReportedAt" AT TIME ZONE 'UTC',
ALTER COLUMN "inactivityWarnedAt" SET DATA TYPE TIMESTAMPTZ(3) USING "inactivityWarnedAt" AT TIME ZONE 'UTC',
ALTER COLUMN "lastSeenAt" SET DATA TYPE TIMESTAMPTZ(3) USING "lastSeenAt" AT TIME ZONE 'UTC',
ALTER COLUMN "termsAcceptedAt" SET DATA TYPE TIMESTAMPTZ(3) USING "termsAcceptedAt" AT TIME ZONE 'UTC';
