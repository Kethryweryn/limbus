-- Vivier unique par jeu et statut par session (SPEC-018, ADR-0069), première migration : ajoute le nouveau modèle et y
-- recopie les données. L'ancien modèle reste en place pour le build en service ; la seconde migration le retire.
-- Tout ou rien : une erreur au milieu de la recopie ne laisse pas la base à moitié convertie.
BEGIN;

-- Nouvelles colonnes
ALTER TABLE "RegistrationPeriod" ALTER COLUMN "name" SET DEFAULT 'Vivier';
ALTER TABLE "RegistrationPeriod" ALTER COLUMN "scope" SET DEFAULT 'game';
ALTER TABLE "RegistrationPeriod" ALTER COLUMN "entryMode" SET DEFAULT 'form';

ALTER TABLE "RegistrationPeriodSession" ALTER COLUMN "seats" SET DEFAULT 0;
ALTER TABLE "RegistrationPeriodSession" ADD COLUMN "open" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "RegistrationPeriodSession" ADD COLUMN "selectionMode" TEXT NOT NULL DEFAULT 'chosen';
ALTER TABLE "RegistrationPeriodSession" ADD COLUMN "organizerPicks" INTEGER;
ALTER TABLE "RegistrationPeriodSession" ADD COLUMN "weightNotDrawnBefore" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "RegistrationPeriodSession" ADD COLUMN "weightBalance" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "RegistrationPeriodSession" ADD COLUMN "waitlistSize" INTEGER NOT NULL DEFAULT 5;

ALTER TABLE "RegistrationDraw" ADD COLUMN "sessionId" TEXT;
CREATE INDEX "RegistrationDraw_sessionId_idx" ON "RegistrationDraw"("sessionId");
ALTER TABLE "RegistrationDraw" ADD CONSTRAINT "RegistrationDraw_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Registration" ADD COLUMN "invitedSessionId" TEXT;
CREATE INDEX "Registration_invitedSessionId_idx" ON "Registration"("invitedSessionId");
ALTER TABLE "Registration" ADD CONSTRAINT "Registration_invitedSessionId_fkey" FOREIGN KEY ("invitedSessionId") REFERENCES "Session"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "RegistrationSession" (
    "id" TEXT NOT NULL,
    "registrationId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "answer" TEXT,
    "answeredAt" TIMESTAMP(3),
    "waitlistPosition" INTEGER,
    "requestedAt" TIMESTAMP(3),
    "lastRemindedAt" TIMESTAMP(3),
    "responseDueAt" TIMESTAMP(3),
    "confirmedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "cancelledById" TEXT,
    "retainedById" TEXT,
    "announcedStatus" TEXT,
    "announcedAt" TIMESTAMP(3),
    "answersChangedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RegistrationSession_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "RegistrationSession_registrationId_sessionId_key" ON "RegistrationSession"("registrationId", "sessionId");
CREATE INDEX "RegistrationSession_sessionId_status_idx" ON "RegistrationSession"("sessionId", "status");
ALTER TABLE "RegistrationSession" ADD CONSTRAINT "RegistrationSession_registrationId_fkey" FOREIGN KEY ("registrationId") REFERENCES "Registration"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RegistrationSession" ADD CONSTRAINT "RegistrationSession_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RegistrationSession" ADD CONSTRAINT "RegistrationSession_cancelledById_fkey" FOREIGN KEY ("cancelledById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "RegistrationSession" ADD CONSTRAINT "RegistrationSession_retainedById_fkey" FOREIGN KEY ("retainedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Vivier gardé par jeu : la période permanente ouverte, sinon la plus ancienne
CREATE TEMP TABLE "KeptPeriod" ON COMMIT DROP AS
SELECT DISTINCT ON ("gameId") "gameId", "id"
FROM "RegistrationPeriod"
ORDER BY "gameId", ("scope" = 'game' AND "state" = 'open') DESC, "createdAt" ASC, "id" ASC;

-- Ouvert si une période du jeu l'était, fermé si l'une était close, sinon brouillon
CREATE TEMP TABLE "PoolState" ON COMMIT DROP AS
SELECT "gameId",
       CASE
         WHEN bool_or("state" = 'open' AND ("closesAt" IS NULL OR "closesAt" > CURRENT_TIMESTAMP)) THEN 'open'
         WHEN bool_or("state" <> 'draft') THEN 'closed'
         ELSE 'draft'
       END AS "state"
FROM "RegistrationPeriod"
GROUP BY "gameId";

-- Session unique de chaque ancienne période, avant le passage des sessions au vivier gardé
CREATE TEMP TABLE "SingleSession" ON COMMIT DROP AS
SELECT "periodId", MIN("sessionId") AS "sessionId"
FROM "RegistrationPeriodSession"
GROUP BY "periodId"
HAVING COUNT(*) = 1;

-- Une session est ouverte si elle est datée, à venir et prévue, et que sa période n'était pas un brouillon
UPDATE "RegistrationPeriodSession" AS link
SET "open" = s."date" IS NOT NULL AND s."date" > CURRENT_TIMESTAMP AND s."status" = 'scheduled' AND p."state" <> 'draft',
    "selectionMode" = p."selectionMode",
    "organizerPicks" = p."organizerPicks",
    "weightNotDrawnBefore" = p."weightNotDrawnBefore",
    "weightBalance" = p."weightBalance",
    "waitlistSize" = p."waitlistSize",
    "periodId" = kept."id"
FROM "RegistrationPeriod" AS p, "Session" AS s, "KeptPeriod" AS kept
WHERE link."periodId" = p."id" AND link."sessionId" = s."id" AND kept."gameId" = p."gameId";

-- Les sessions non closes que proposait la période permanente, quand elles n'ont pas de ligne
INSERT INTO "RegistrationPeriodSession" ("id", "periodId", "sessionId", "open")
SELECT 'rps_' || md5(s."id"), kept."id", s."id",
       s."date" IS NOT NULL AND s."date" > CURRENT_TIMESTAMP AND s."status" = 'scheduled' AND p."state" <> 'draft'
FROM "RegistrationPeriod" AS p
JOIN "KeptPeriod" AS kept ON kept."gameId" = p."gameId"
JOIN "Session" AS s ON s."gameId" = p."gameId" AND s."status" NOT IN ('cancelled', 'completed')
WHERE p."scope" = 'game'
ON CONFLICT ("sessionId") DO NOTHING;

-- Une ligne par personne et par jeu : celle qui a répondu et a été modifiée le plus récemment
CREATE TEMP TABLE "KeptRegistration" ON COMMIT DROP AS
SELECT r."id" AS "oldId",
       FIRST_VALUE(r."id") OVER (
         PARTITION BY p."gameId", r."participantId"
         ORDER BY (r."respondedAt" IS NOT NULL) DESC, r."updatedAt" DESC, r."id" ASC
       ) AS "keptId"
FROM "Registration" AS r
JOIN "RegistrationPeriod" AS p ON p."id" = r."periodId";

-- Sortie du vivier seulement si toutes ses lignes l'étaient
CREATE TEMP TABLE "PersonState" ON COMMIT DROP AS
SELECT k."keptId", bool_and(r."status" = 'withdrawn') AS "allWithdrawn"
FROM "KeptRegistration" AS k
JOIN "Registration" AS r ON r."id" = k."oldId"
GROUP BY k."keptId";

-- Statuts par session, du plus avancé au moins avancé : le premier trouvé pour une session l'emporte
INSERT INTO "RegistrationSession" ("id", "registrationId", "sessionId", "status", "answer", "answeredAt", "lastRemindedAt", "responseDueAt", "confirmedAt", "retainedById", "announcedStatus", "announcedAt", "updatedAt")
SELECT 'rs_' || md5(k."keptId" || r."sessionId"), k."keptId", r."sessionId", 'confirmed',
       'available', r."respondedAt", r."lastRemindedAt", r."responseDueAt", r."confirmedAt", r."retainedById",
       r."announcedStatus", r."announcedAt", CURRENT_TIMESTAMP
FROM "Registration" AS r
JOIN "KeptRegistration" AS k ON k."oldId" = r."id"
WHERE r."status" = 'confirmed' AND r."sessionId" IS NOT NULL
ON CONFLICT ("registrationId", "sessionId") DO NOTHING;

INSERT INTO "RegistrationSession" ("id", "registrationId", "sessionId", "status", "answer", "answeredAt", "lastRemindedAt", "responseDueAt", "retainedById", "announcedStatus", "announcedAt", "updatedAt")
SELECT 'rs_' || md5(k."keptId" || r."sessionId"), k."keptId", r."sessionId", 'retained',
       'available', r."respondedAt", r."lastRemindedAt", r."responseDueAt", r."retainedById",
       CASE WHEN r."announcedSessionId" = r."sessionId" THEN r."announcedStatus" END,
       CASE WHEN r."announcedSessionId" = r."sessionId" THEN r."announcedAt" END, CURRENT_TIMESTAMP
FROM "Registration" AS r
JOIN "KeptRegistration" AS k ON k."oldId" = r."id"
WHERE r."status" = 'retained' AND r."sessionId" IS NOT NULL
ON CONFLICT ("registrationId", "sessionId") DO NOTHING;

INSERT INTO "RegistrationSession" ("id", "registrationId", "sessionId", "status", "answer", "answeredAt", "waitlistPosition", "announcedStatus", "announcedAt", "updatedAt")
SELECT 'rs_' || md5(k."keptId" || w."sessionId"), k."keptId", w."sessionId", 'waitlisted',
       'available', r."respondedAt", w."position",
       CASE WHEN r."status" = 'waitlisted' THEN r."announcedStatus" END,
       CASE WHEN r."status" = 'waitlisted' THEN r."announcedAt" END, CURRENT_TIMESTAMP
FROM "RegistrationWaitlistEntry" AS w
JOIN "Registration" AS r ON r."id" = w."registrationId"
JOIN "KeptRegistration" AS k ON k."oldId" = r."id"
ON CONFLICT ("registrationId", "sessionId") DO NOTHING;

-- Disponibilités données : pré-inscrite
INSERT INTO "RegistrationSession" ("id", "registrationId", "sessionId", "status", "answer", "answeredAt", "updatedAt")
SELECT 'rs_' || md5(k."keptId" || a."sessionId"), k."keptId", a."sessionId", 'preregistered', 'available', r."respondedAt", CURRENT_TIMESTAMP
FROM "RegistrationAvailability" AS a
JOIN "Registration" AS r ON r."id" = a."registrationId"
JOIN "KeptRegistration" AS k ON k."oldId" = r."id"
WHERE r."status" <> 'withdrawn'
ON CONFLICT ("registrationId", "sessionId") DO NOTHING;

-- Reçue ou non retenue dans une période d'une seule session : pré-inscrite pour cette session
INSERT INTO "RegistrationSession" ("id", "registrationId", "sessionId", "status", "answer", "answeredAt", "updatedAt")
SELECT 'rs_' || md5(k."keptId" || single."sessionId"), k."keptId", single."sessionId", 'preregistered', 'available', r."respondedAt", CURRENT_TIMESTAMP
FROM "Registration" AS r
JOIN "KeptRegistration" AS k ON k."oldId" = r."id"
JOIN "SingleSession" AS single ON single."periodId" = r."periodId"
WHERE r."status" IN ('received', 'rejected')
ON CONFLICT ("registrationId", "sessionId") DO NOTHING;

-- Désistée d'une session : annulation
INSERT INTO "RegistrationSession" ("id", "registrationId", "sessionId", "status", "answer", "answeredAt", "cancelledAt", "cancelledById", "announcedStatus", "announcedAt", "updatedAt")
SELECT 'rs_' || md5(k."keptId" || r."sessionId"), k."keptId", r."sessionId", 'cancelled',
       'available', r."respondedAt", r."withdrawnAt", r."withdrawnById", r."announcedStatus", r."announcedAt", CURRENT_TIMESTAMP
FROM "Registration" AS r
JOIN "KeptRegistration" AS k ON k."oldId" = r."id"
WHERE r."status" = 'withdrawn' AND r."sessionId" IS NOT NULL
ON CONFLICT ("registrationId", "sessionId") DO NOTHING;

-- Toute session qui a un statut a sa ligne dans le vivier, même close
INSERT INTO "RegistrationPeriodSession" ("id", "periodId", "sessionId")
SELECT DISTINCT 'rps_' || md5(line."sessionId"), kept."id", line."sessionId"
FROM "RegistrationSession" AS line
JOIN "Session" AS s ON s."id" = line."sessionId"
JOIN "KeptPeriod" AS kept ON kept."gameId" = s."gameId"
ON CONFLICT ("sessionId") DO NOTHING;

-- Une réservation de personnage suit la ligne gardée
UPDATE "SessionAssignment" AS assignment
SET "reservedRegistrationId" = k."keptId"
FROM "KeptRegistration" AS k
WHERE assignment."reservedRegistrationId" = k."oldId" AND k."oldId" <> k."keptId";

-- Les doublons disparaissent, avec leurs réponses et leurs affinités
DELETE FROM "Registration" AS r
USING "KeptRegistration" AS k
WHERE r."id" = k."oldId" AND k."oldId" <> k."keptId";

-- Une invitation restée sans réponse garde sa session ; une personne n'est sortie que si toutes ses lignes l'étaient
UPDATE "Registration" AS r
SET "invitedSessionId" = CASE WHEN r."status" = 'invited' THEN r."sessionId" END,
    "status" = CASE
      WHEN r."status" = 'invited' THEN 'invited'
      WHEN state."allWithdrawn" THEN 'withdrawn'
      ELSE 'received'
    END,
    "withdrawnAt" = CASE WHEN state."allWithdrawn" THEN r."withdrawnAt" END,
    "withdrawnById" = CASE WHEN state."allWithdrawn" THEN r."withdrawnById" END,
    "periodId" = kept."id"
FROM "PersonState" AS state, "RegistrationPeriod" AS p, "KeptPeriod" AS kept
WHERE state."keptId" = r."id" AND p."id" = r."periodId" AND kept."gameId" = p."gameId";

-- Demandes et tirages passent au vivier gardé ; un ancien tirage reste au journal, sans session
UPDATE "RegistrationRequest" AS request
SET "periodId" = kept."id"
FROM "RegistrationPeriod" AS p, "KeptPeriod" AS kept
WHERE request."periodId" = p."id" AND kept."gameId" = p."gameId";

UPDATE "RegistrationDraw" AS draw
SET "periodId" = kept."id"
FROM "RegistrationPeriod" AS p, "KeptPeriod" AS kept
WHERE draw."periodId" = p."id" AND kept."gameId" = p."gameId";

-- Les périodes absorbées disparaissent, et leur lien de diffusion avec elles
DELETE FROM "RegistrationPeriod" AS p
USING "KeptPeriod" AS kept
WHERE p."gameId" = kept."gameId" AND p."id" <> kept."id";

UPDATE "RegistrationPeriod" AS p
SET "state" = state."state", "scope" = 'game', "entryMode" = 'form', "selectionMode" = 'chosen', "closesAt" = NULL
FROM "PoolState" AS state
WHERE state."gameId" = p."gameId";

CREATE UNIQUE INDEX "RegistrationPeriod_gameId_key" ON "RegistrationPeriod"("gameId");

COMMIT;
