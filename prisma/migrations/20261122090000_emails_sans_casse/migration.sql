-- US-192 (ADR-0075) : la base compare les adresses email sans tenir compte de la casse. citext est une extension « de
-- confiance » (PostgreSQL 13 et plus) : la propriétaire de la base la crée sans droits d'administration du serveur.
--
-- deploiement-incompatible : changement de type (text vers citext). Le build en service écrit et lit toujours du texte,
-- que PostgreSQL convertit ; ses recherches en mode insensible à la casse restent justes.
-- Production relevée le 2026-11-09 : aucune adresse en majuscules, aucun compte en double par la casse.
CREATE EXTENSION IF NOT EXISTS citext;

ALTER TABLE "AccountToken" ALTER COLUMN "email" SET DATA TYPE CITEXT;
ALTER TABLE "GameInvitation" ALTER COLUMN "email" SET DATA TYPE CITEXT;
ALTER TABLE "Participant" ALTER COLUMN "email" SET DATA TYPE CITEXT;
ALTER TABLE "Registration" ALTER COLUMN "email" SET DATA TYPE CITEXT;
ALTER TABLE "RegistrationRequest" ALTER COLUMN "email" SET DATA TYPE CITEXT;
ALTER TABLE "User" ALTER COLUMN "email" SET DATA TYPE CITEXT;
