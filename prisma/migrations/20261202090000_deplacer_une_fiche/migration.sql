-- Déplacer ce qu'une équipe tient d'une fiche vers une autre (SPEC-022 R7, R8, ADR-0086, US-239) : correction d'adresse
-- par une équipe, puis fusion des fiches d'une même adresse (US-240). Une seule fonction, que l'application et la
-- migration de fusion appellent : toutes les tables qui désignent une fiche y sont, et
-- tests/integration/participantMove.test.ts vérifie qu'aucune ne manque.
--
-- Seules les lignes des jeux donnés passent de `from_id` à `to_id`. Quand la fiche d'arrivée a déjà une ligne pour la
-- même clé unique, les deux sont réunies : notes mises bout à bout, et, pour une inscription, une présence ou un
-- paiement, la ligne la plus récemment modifiée est gardée (à égalité, celle de la fiche d'arrivée).
CREATE OR REPLACE FUNCTION limbus_move_participant(from_id TEXT, to_id TEXT, game_ids TEXT[]) RETURNS VOID AS $$
BEGIN
  IF from_id = to_id THEN
    RETURN;
  END IF;

  -- Jeux de la fiche : notes réunies, nom et téléphone de la fiche de départ (ceux que l'équipe vient de saisir)
  UPDATE "ParticipantGame" AS kept
  SET "notes" = CASE
        WHEN moved."notes" IS NULL OR moved."notes" = '' OR moved."notes" = kept."notes" THEN kept."notes"
        WHEN kept."notes" IS NULL OR kept."notes" = '' THEN moved."notes"
        ELSE kept."notes" || E'\n\n' || moved."notes"
      END,
      "name" = COALESCE(moved."name", kept."name"),
      "phone" = COALESCE(moved."phone", kept."phone"),
      "updatedAt" = CURRENT_TIMESTAMP
  FROM "ParticipantGame" AS moved
  WHERE moved."participantId" = from_id AND kept."participantId" = to_id
    AND kept."gameId" = moved."gameId" AND moved."gameId" = ANY(game_ids);
  DELETE FROM "ParticipantGame" AS moved
  WHERE moved."participantId" = from_id AND moved."gameId" = ANY(game_ids)
    AND EXISTS (SELECT 1 FROM "ParticipantGame" AS kept WHERE kept."participantId" = to_id AND kept."gameId" = moved."gameId");
  UPDATE "ParticipantGame" SET "participantId" = to_id, "updatedAt" = CURRENT_TIMESTAMP
  WHERE "participantId" = from_id AND "gameId" = ANY(game_ids);

  -- Inscriptions : une par vivier et par fiche ; la plus récente reste
  DELETE FROM "Registration" AS dropped
  USING "Registration" AS other
  WHERE dropped."gameId" = ANY(game_ids) AND other."periodId" = dropped."periodId"
    AND ((dropped."participantId" = from_id AND other."participantId" = to_id AND dropped."updatedAt" <= other."updatedAt")
      OR (dropped."participantId" = to_id AND other."participantId" = from_id AND dropped."updatedAt" < other."updatedAt"));
  UPDATE "Registration" SET "participantId" = to_id WHERE "participantId" = from_id AND "gameId" = ANY(game_ids);
  -- Affinités d'autres personnes qui la désignent, dans ces jeux
  UPDATE "RegistrationAffinity" AS affinity SET "targetParticipantId" = to_id
  FROM "Registration" AS registration
  WHERE affinity."registrationId" = registration."id" AND affinity."targetParticipantId" = from_id AND registration."gameId" = ANY(game_ids);

  -- Équipe d'une session : une ligne par rôle
  DELETE FROM "SessionParticipant" AS moved
  USING "Session" AS session
  WHERE moved."sessionId" = session."id" AND session."gameId" = ANY(game_ids) AND moved."participantId" = from_id
    AND EXISTS (SELECT 1 FROM "SessionParticipant" AS kept WHERE kept."sessionId" = moved."sessionId" AND kept."participantId" = to_id AND kept."role" = moved."role");
  UPDATE "SessionParticipant" AS moved SET "participantId" = to_id
  FROM "Session" AS session
  WHERE moved."sessionId" = session."id" AND session."gameId" = ANY(game_ids) AND moved."participantId" = from_id;

  -- Présence : une par session ; la plus récente reste
  DELETE FROM "SessionAttendance" AS dropped
  USING "SessionAttendance" AS other, "Session" AS session
  WHERE dropped."sessionId" = session."id" AND session."gameId" = ANY(game_ids) AND other."sessionId" = dropped."sessionId"
    AND ((dropped."participantId" = from_id AND other."participantId" = to_id AND dropped."updatedAt" <= other."updatedAt")
      OR (dropped."participantId" = to_id AND other."participantId" = from_id AND dropped."updatedAt" < other."updatedAt"));
  UPDATE "SessionAttendance" AS moved SET "participantId" = to_id
  FROM "Session" AS session
  WHERE moved."sessionId" = session."id" AND session."gameId" = ANY(game_ids) AND moved."participantId" = from_id;

  -- Paiement : un par session ; le plus récent reste
  DELETE FROM "SessionPayment" AS dropped
  USING "SessionPayment" AS other
  WHERE dropped."gameId" = ANY(game_ids) AND other."sessionId" = dropped."sessionId"
    AND ((dropped."participantId" = from_id AND other."participantId" = to_id AND dropped."updatedAt" <= other."updatedAt")
      OR (dropped."participantId" = to_id AND other."participantId" = from_id AND dropped."updatedAt" < other."updatedAt"));
  UPDATE "SessionPayment" SET "participantId" = to_id WHERE "participantId" = from_id AND "gameId" = ANY(game_ids);
  UPDATE "SessionPayment" SET "transferredToParticipantId" = to_id WHERE "transferredToParticipantId" = from_id AND "gameId" = ANY(game_ids);

  -- Trombinoscopes et responsabilités du déroulé : en double, celle de la fiche de départ part
  DELETE FROM "SessionTrombinoscope" AS moved
  WHERE moved."gameId" = ANY(game_ids) AND moved."participantId" = from_id
    AND EXISTS (SELECT 1 FROM "SessionTrombinoscope" AS kept WHERE kept."sessionId" = moved."sessionId" AND kept."viewerCharacterId" IS NOT DISTINCT FROM moved."viewerCharacterId" AND kept."participantId" = to_id);
  UPDATE "SessionTrombinoscope" SET "participantId" = to_id WHERE "participantId" = from_id AND "gameId" = ANY(game_ids);
  DELETE FROM "TimelineEventResponsible" AS moved
  WHERE moved."gameId" = ANY(game_ids) AND moved."participantId" = from_id
    AND EXISTS (SELECT 1 FROM "TimelineEventResponsible" AS kept WHERE kept."sessionId" = moved."sessionId" AND kept."timelineEventId" = moved."timelineEventId" AND kept."participantId" = to_id);
  UPDATE "TimelineEventResponsible" SET "participantId" = to_id WHERE "participantId" = from_id AND "gameId" = ANY(game_ids);

  -- Casting et envois : sans clé unique sur la fiche
  UPDATE "SessionAssignment" SET "participantId" = to_id WHERE "participantId" = from_id AND "gameId" = ANY(game_ids);
  UPDATE "SessionDocumentDelivery" SET "participantId" = to_id WHERE "participantId" = from_id AND "gameId" = ANY(game_ids);
END;
$$ LANGUAGE plpgsql;
