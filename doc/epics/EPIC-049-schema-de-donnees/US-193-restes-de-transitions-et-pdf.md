---
id: US-193
titre: Retirer les colonnes inutiles et garder le PDF du trombinoscope en binaire
statut: terminée
epic: EPIC-049
regles: []
adr: []
---

# US-193 : Retirer les colonnes inutiles et garder le PDF du trombinoscope en binaire

En tant que mainteneuse de Limbus, je veux retirer les colonnes qui ne servent plus et garder le PDF du trombinoscope en binaire, afin d'alléger la base et de n'avoir qu'une façon de stocker un PDF.

## Critères d'acceptation

- [x] `Participant.notes` et `GameInvitation.token` sont retirées.
- [x] `Document.audience` et `Document.characterId` (avec `Character.legacyDocuments`) sont retirées, une fois le build qui les écrit remplacé.
- [x] Les onze anciennes tables de liaison (`_CharacterFactions`…), recopiées par l'[US-191](US-191-meme-jeu-impose-par-la-base.md), sont retirées.
- [x] Le PDF du trombinoscope est écrit dans une colonne `Bytes`, remplie depuis l'existant ; l'ancienne colonne base64 est retirée au déploiement suivant.
- [x] Les PDF générés restent en base ([ADR-0044](../../adr/ADR-0044-copies-des-envois.md)).

## Notes techniques

En deux déploiements (ADR-0024) : le client Prisma du build en service lit toutes les colonnes qu'il connaît, et une colonne retirée sous lui ferait échouer ses lectures.

1. **Premier déploiement** : le code n'emploie plus `Participant.notes`, `GameInvitation.token`, `Document.audience`, `Document.characterId` ni `SessionTrombinoscope.contentPdfBase64`, retirés du schéma Prisma mais gardés en base. Le PDF du trombinoscope est écrit dans `contentPdf` (`Bytes`), rempli depuis l'existant. Les onze anciennes tables de liaison, que le build en service ne connaît plus, sont retirées. La compatibilité d'avant ADR-0072 part avec l'ancien public : une écriture qui l'envoie vient d'une page périmée et est refusée (« rechargez-la »), et les documents gardés sur l'appareil avant ADR-0072 sont effacés à la mise à niveau de la base hors ligne (version 13), pour être relus avec leurs rôles. Le tableau des envois ne charge plus le PDF des trombinoscopes. Production relevée le 2026-11-09 : colonnes vides, sauf le PDF d'un trombinoscope.
2. **Second déploiement** : recopie dans `contentPdf` d'un PDF écrit par le build d'avant pendant le premier déploiement, puis retrait des colonnes en base, et du type `DocumentAudience` avec la constante `DOCUMENT_AUDIENCES`. D'ici là, `migrate diff` propose ces retraits.

## Tests

Premier déploiement : intégration et Playwright complets, dont `documentAudiences.test.ts` (écriture d'avant refusée) et `offline.spec.ts` (mise à niveau de la base de l'appareil) ; migration jouée sur une base au schéma d'avant (PDF recopié à l'identique, anciennes tables retirées). Second déploiement : migration jouée sur une base neuve, différence avec le schéma vide ; `tests/integration/schema.test.ts` et `sameGame.test.ts` sans l'ancien public ni l'ancien personnage ; intégration et Playwright complets.
