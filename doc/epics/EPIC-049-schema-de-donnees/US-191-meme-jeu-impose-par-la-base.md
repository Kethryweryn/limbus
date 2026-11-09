---
id: US-191
titre: Faire refuser par la base un lien entre éléments du contenu de deux jeux
statut: terminée
epic: EPIC-049
regles: []
adr: [ADR-0074]
---

# US-191 : Faire refuser par la base un lien entre éléments du contenu de deux jeux

En tant que mainteneuse de Limbus, je veux que la base refuse un lien entre éléments du contenu de deux jeux différents (personnages, groupes, intrigues, objets, documents, chronologie), afin que l'isolation des jeux ne dépende plus du seul code.

Les liens des sessions, du vivier, des paiements et des fichiers suivent dans l'[US-195](US-195-meme-jeu-sessions-et-vivier.md) : le lot était trop lourd pour une seule PR.

## Critères d'acceptation

- [x] Chaque élément du contenu (`Character`, `Faction`, `Intrigue`, `Item`, `Document`, `TimelineEvent`) a une unicité `(id, gameId)`.
- [x] Les onze tables de liaison implicites deviennent des modèles explicites qui portent le jeu, leurs lignes recopiées ; chaque côté référence `(id, gameId)`.
- [x] `CharacterRelation`, `RegistrationQuestionLink`, `CharacterTrombinoscopeEntry` (qui reçoit le jeu), `Item.locationCharacterId` et `Document.characterId` référencent `(id, gameId)`.
- [x] Un lien entre deux jeux, écrit directement en base, est refusé ; un élément relié ne change pas de jeu.
- [x] Les routes et les outils des assistants gardent leurs vérifications, leurs messages et la forme de leurs réponses.

## Notes techniques

- Les modèles de liaison (`CharacterFaction`, `DocumentCharacter`…) ont pour clé primaire (élément A, jeu, élément B), qui sert aussi d'index à la première clé étrangère. Ils s'écrivent par `linkCreate` et `linkSet`, qui ignorent un identifiant donné deux fois, et se lisent par `unlinked`, qui rend à toute profondeur la liste des éléments sous leur nom d'avant (`server/utils/contentLinks.ts`) : l'API garde sa forme.
- Les références d'un élément vers d'autres éléments passent par une seule vérification, `assertSameGameIds` (`contentWrites.ts`), qui donne le message de refus avant que la base ne refuse.
- Chaque clé composée a `onUpdate: NoAction` : changer le jeu d'un élément relié est refusé, au lieu de déplacer sans bruit ce qui le référence.
- `Item.locationCharacterId` et `Document.characterId` passent en `onDelete: NoAction` : la suppression d'un personnage les vide d'abord, dans la même transaction (`deleteCharacter`).
- Côté personnage, l'ancien champ « Personnage » des documents s'appelle désormais `legacyDocuments`, pour laisser `documents` aux documents ciblés. L'outil de lecture des assistants rend ces derniers, au lieu de l'ancien champ vide depuis ADR-0072.
- Les fiches des personnages, groupes et intrigues sont lues par `sheetReads.ts`, comme les documents et les objets.
- Migration écrite à la main et marquée incompatible : les anciennes tables restent telles quelles jusqu'à l'[US-193](US-193-restes-de-transitions-et-pdf.md). D'ici là, `migrate diff` propose de les supprimer : une migration générée entre-temps retire ces lignes.
- Production relevée le 2026-11-09 : aucun lien ne relie deux jeux. Pendant les secondes du déploiement, un lien que le build d'avant ajoute ou retire n'est pas recopié, et il ne peut ni créer une case de trombinoscope ni supprimer un personnage qui porte un objet (accepté).

ADR :
- [ADR-0074](../../adr/ADR-0074-meme-jeu-impose-par-la-base.md)

## Tests

- Intégration : `tests/integration/sameGame.test.ts` (chaque sorte de lien refusée entre deux jeux, avec un témoin dans un seul jeu ; changement de jeu refusé ; suppression d'un personnage qui porte un objet ; suppression d'un jeu ; garde-fous : toute clé étrangère entre deux tables qui portent le jeu le compare, et toute table qui relie deux éléments d'un jeu porte le jeu, sauf celles de l'US-195). Suite complète.
- Bout en bout : suite complète (écrans d'écriture, documents, chronologie, trombinoscopes, questionnaire).
- Migration jouée sur une base au schéma d'avant remplie de liens : chaque lien recopié avec son jeu, anciennes tables intactes ; différence avec le schéma limitée aux anciennes tables.
