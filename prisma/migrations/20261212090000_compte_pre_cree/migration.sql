-- Compte pré-créé pour chaque fiche (SPEC-022 R1, US-244, ADR-0088) : un compte sans mot de passe n'est pas activé
ALTER TABLE "User" ALTER COLUMN "password" DROP NOT NULL;

-- Chaque adresse de fiche sans compte en reçoit un, non activé : sans mot de passe, nom, adresse confirmée ni conditions
INSERT INTO "User" ("id", "email", "name", "password", "emailConfirmedAt", "createdAt", "updatedAt")
SELECT 'pre' || replace(gen_random_uuid()::text, '-', ''), p."email", '', NULL, NULL, now(), now()
FROM "Participant" p
WHERE p."email" IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM "User" u WHERE u."email" = p."email");

-- Chaque fiche appartient au compte de son adresse, activé ou non (la colonne citext compare sans la casse)
UPDATE "Participant" p
SET "userId" = u."id"
FROM "User" u
WHERE p."email" = u."email"
  AND p."userId" IS DISTINCT FROM u."id";
