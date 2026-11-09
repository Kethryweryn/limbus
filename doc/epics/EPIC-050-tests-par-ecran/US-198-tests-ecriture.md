---
id: US-198
titre: Tester chaque écran de l'écriture d'un jeu
statut: terminée
epic: EPIC-050
regles: [R1, R3, R4, R9, R10, R11, R13, R14, R15, R16, R17, R18]
adr: []
---

# US-198 : Tester chaque écran de l'écriture d'un jeu

En tant qu'organisatrice, je veux que les listes et les fiches du contenu d'un jeu, les jeux et la page publique aient des tests automatiques sur leurs actions, leurs erreurs de saisie, leurs droits et le hors ligne, afin qu'une régression s'y voie avant la mise en production.

## Critères d'acceptation

- [x] Chaque écran du lot a les tests listés dans la [fiche](../../archive/todo/tests-par-ecran.md), ou la raison de leur absence est notée ici.
- [x] Un défaut trouvé en écrivant un test est corrigé dans le lot, avec sa note de nouveautés : [US-204](US-204-champ-obligatoire-explique.md), [US-205](US-205-option-aucun.md), [US-206](US-206-erreur-du-serveur-dans-le-formulaire.md), [US-207](US-207-supprimer-un-jeu-archive.md), [US-208](US-208-description-une-seule-fois.md).

## Notes techniques

Specs : SPEC-002, SPEC-003, SPEC-009, SPEC-010, SPEC-011. Tests Playwright dans `tests/e2e/`, selon `.claude/rules/tests.md`.

Couvert par ce lot, pour les personnages, groupes, intrigues, objets, documents et lieux : recherche par le nom et par un autre champ, filtre par jeu, pages et retour à la première après une recherche, archives, jeu actif (filtre et création), nom vide refusé avec son message, organisatrice sans accès, co-organisatrice, liste relue et création faite hors ligne, conflit hors ligne. Pour chaque fiche, ce qui lui est propre. Pour les jeux : archiver et restaurer, publier, lien de teaser refusé, suppression, droits de la co-organisatrice, départ, transfert. Pour la page publique : présentation seule et crédit.

Restent aux lots suivants, car ils se jouent depuis une session : les réglages du trombinoscope d'un personnage et l'étiquette d'un groupe ([US-199](US-199-tests-sessions.md), trombinoscopes), « prêt à envoyer » d'un document (US-199, envois) et les responsables d'un événement (US-199, déroulé). Déjà couverts avant ce lot : les relations (`characterRelations.spec.ts`), le public d'un document (`documents.spec.ts`), le legs (`bequest.spec.ts`), l'ancienne adresse d'un jeu renommé et son teaser (`publicPage.spec.ts`).

Fiabilité : le test du partage d'un jeu écrit désormais à une invitée qui lui est propre (`testUser`), et non plus à l'adresse commune `E2E_USERS.autre`.

## Tests

- `tests/e2e/writingLists.spec.ts` : 4 tests par liste (6 listes), et le conflit hors ligne.
- `tests/e2e/writingSheets.spec.ts` : objet, document, personnage, groupe, intrigue, lieu, événement.
- `tests/e2e/games.spec.ts` : 6 tests de l'écran des jeux.
- `tests/e2e/publicPage.spec.ts` : présentation seule et crédit.
- `tests/e2e/writing.spec.ts` : partage avec une invitée propre au test.
