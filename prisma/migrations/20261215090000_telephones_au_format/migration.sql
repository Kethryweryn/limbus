-- Téléphones déjà en base remis au format international (SPEC-023 R12, ADR-0092) : seulement les formes sûres, sans
-- bibliothèque ; toute autre valeur reste telle quelle et sera vérifiée à sa prochaine modification.
-- 1. Un « (0) » après un indicatif est retiré, puis les espaces, points, tirets et parenthèses.
-- 2. 10 chiffres commençant par 0 (pas 00) : numéro français, +33 suivi des 9 derniers chiffres.
-- 3. 0033 suivi de 9 chiffres : +33 suivi de ces 9 chiffres.
-- 4. + suivi de 8 à 15 chiffres : gardé, sans ses séparateurs.
CREATE FUNCTION pg_temp.telephone_au_format(valeur text) RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE
    WHEN compact ~ '^0[1-9][0-9]{8}$' THEN '+33' || substr(compact, 2)
    WHEN compact ~ '^0033[0-9]{9}$' THEN '+33' || substr(compact, 5)
    WHEN compact ~ '^\+[0-9]{8,15}$' THEN compact
    ELSE valeur
  END
  FROM (
    SELECT regexp_replace(regexp_replace(valeur, '^((\+|00)[0-9]{1,3})[[:space:]]*\(0\)', '\1'), '[[:space:].()-]', '', 'g') AS compact
  ) AS saisie
$$;

UPDATE "User" SET "phone" = pg_temp.telephone_au_format("phone") WHERE "phone" IS NOT NULL;
UPDATE "User" SET "emergencyContactPhone" = pg_temp.telephone_au_format("emergencyContactPhone") WHERE "emergencyContactPhone" IS NOT NULL;
UPDATE "ParticipantGame" SET "phone" = pg_temp.telephone_au_format("phone") WHERE "phone" IS NOT NULL;
UPDATE "Registration" SET "phone" = pg_temp.telephone_au_format("phone") WHERE "phone" IS NOT NULL;
UPDATE "Registration" SET "emergencyContactPhone" = pg_temp.telephone_au_format("emergencyContactPhone") WHERE "emergencyContactPhone" IS NOT NULL;
