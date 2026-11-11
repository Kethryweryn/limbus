-- Fusion des fiches d'une même adresse (SPEC-022 R8, ADR-0086, US-240) : une adresse n'a plus qu'une fiche dans tout
-- Limbus. Pour chaque adresse portée par plusieurs fiches (sans tenir compte de la casse, citext), la plus ancienne
-- reste ; chaque autre lui passe tout ce qu'elle tient (limbus_move_participant, la fonction de la correction
-- d'adresse), puis disparaît. La fiche gardée refuse la photo si l'une la refusait, et garde un compte si l'une en
-- avait un. Les adresses de page des fiches absorbées ne répondent plus. Une fonction, pour que le test de la fusion
-- la rejoue (tests/integration/participantMerge.test.ts).
CREATE OR REPLACE FUNCTION limbus_merge_duplicate_participants() RETURNS INTEGER AS $$
DECLARE
  duplicate RECORD;
  merged INTEGER := 0;
BEGIN
  FOR duplicate IN
    SELECT absorbed."id" AS absorbed_id, kept."id" AS kept_id
    FROM "Participant" AS absorbed
    JOIN LATERAL (
      SELECT candidate."id" FROM "Participant" AS candidate
      WHERE candidate."email" = absorbed."email"
      ORDER BY candidate."createdAt", candidate."id"
      LIMIT 1
    ) AS kept ON kept."id" <> absorbed."id"
    WHERE absorbed."email" IS NOT NULL
  LOOP
    UPDATE "Participant" AS kept
    SET "photoRefusedAt" = COALESCE(kept."photoRefusedAt", absorbed."photoRefusedAt"),
        "userId" = COALESCE(kept."userId", absorbed."userId"),
        "updatedAt" = CURRENT_TIMESTAMP
    FROM "Participant" AS absorbed
    WHERE kept."id" = duplicate.kept_id AND absorbed."id" = duplicate.absorbed_id;
    PERFORM limbus_move_participant(
      duplicate.absorbed_id,
      duplicate.kept_id,
      ARRAY(SELECT "gameId" FROM "ParticipantGame" WHERE "participantId" = duplicate.absorbed_id)
    );
    DELETE FROM "Participant" WHERE "id" = duplicate.absorbed_id;
    merged := merged + 1;
  END LOOP;
  RETURN merged;
END;
$$ LANGUAGE plpgsql;

SELECT limbus_merge_duplicate_participants();

-- Désormais, la base refuse une deuxième fiche à la même adresse (plusieurs fiches sans adresse restent possibles)
CREATE UNIQUE INDEX "Participant_email_key" ON "Participant"("email");
