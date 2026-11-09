-- US-193, premier déploiement : le PDF du trombinoscope passe en binaire, et les anciennes tables de liaison partent.
--
-- deploiement-incompatible : faux positif, les tables retirées ne sont plus connues du build en service (US-191). Les
-- colonnes que le code n'emploie plus (Document.audience et characterId, Participant.notes, GameInvitation.token,
-- SessionTrombinoscope.contentPdfBase64) restent en base : le client Prisma du build en service les lit encore. Elles
-- seront retirées au déploiement suivant (ADR-0024).
-- Production relevée le 2026-11-09 : ces colonnes sont vides, sauf le PDF d'un trombinoscope, recopié ici.

-- PDF en binaire, décodé depuis l'existant. Un trombinoscope généré par le build en service pendant le déploiement n'a
-- que son ancienne colonne : le second déploiement le recopie de même, avant de la retirer
ALTER TABLE "SessionTrombinoscope" ADD COLUMN "contentPdf" BYTEA;
UPDATE "SessionTrombinoscope" SET "contentPdf" = decode("contentPdfBase64", 'base64') WHERE "contentPdfBase64" IS NOT NULL;

-- Anciennes tables de liaison implicites, recopiées par l'US-191
DROP TABLE "_CharacterFactions";
DROP TABLE "_CharacterIntrigues";
DROP TABLE "_CharacterItems";
DROP TABLE "_DocumentCharacters";
DROP TABLE "_DocumentFactions";
DROP TABLE "_FactionIntrigues";
DROP TABLE "_IntrigueItems";
DROP TABLE "_TimelineEventCharacters";
DROP TABLE "_TimelineEventFactions";
DROP TABLE "_TimelineEventIntrigues";
DROP TABLE "_TimelineEventItems";
