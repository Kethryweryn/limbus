---
id: ADR-0050
titre: Relations orientées entre personnages, liens du questionnaire hors des versions du formulaire, relations refusées en lignes d'affinité
statut: accepté
date: 2026-11-01
liens: [../specs/SPEC-001-inscriptions.md, ADR-0045-questions-et-affinites-du-formulaire.md, ADR-0031-version-d-un-envoi.md]
---

# ADR-0050 : Relations orientées entre personnages, liens du questionnaire hors des versions du formulaire, relations refusées en lignes d'affinité

## Contexte

[SPEC-001](../specs/SPEC-001-inscriptions.md), lot 5 (R8, R26), qui prépare l'assistant de casting (R27, R28). Choix de l'utilisatrice : une relation a un côté par personnage, et chaque côté a sa visibilité dans la fiche envoyée. On relie les options des questions à choix et les questions sur une échelle. « Les relations que je ne veux pas jouer » devient des cases plus du texte, avec une case « Aucune » qui s'exclut avec les autres.

## Décision

- **`CharacterRelation`** : `gameId`, `type` (`romance`, `family`, `rivalry`, `alliance`, `hierarchy`, `other`), `description`, puis pour chaque côté (`from`, `to`) le personnage, un libellé facultatif et `visible`. Les deux personnages appartiennent au jeu et sont distincts. La suppression d'un personnage supprime ses relations (cascade). Les modifications passent par `assertUnmodifiedSince` sur `updatedAt`, comme les autres ressources.
- **Fiche personnage** : `characterSheetPdfContent` ajoute une section « Relations » avec les relations visibles du côté du personnage (« Bran — famille, demi-frère : … »). Ces relations entrent dans l'empreinte de la fiche (ADR-0031) : une fiche envoyée dont les relations visibles ont changé est signalée comme dépassée.
- **`RegistrationQuestionLink`** : `gameId`, `questionId`, `option` (texte de l'option ; vide pour une question sur une échelle), puis un seul de `characterId`, `factionId` ou `intrigueId`. Les liens sont des données de casting, pas des réponses. Ils vivent hors de la définition versionnée du formulaire (R9) : en modifier ne crée pas de version. Ils s'appliquent à la question par son identifiant stable et à l'option par son texte. L'éditeur les renvoie avec le texte en cours de l'option, donc un renommage les garde. `PUT /api/games/:id/registration-question-links` remplace tous les liens du jeu. Un lien vers une question ou une option disparue est ignoré à la lecture.
- **Relations refusées** : les cases cochées sont des lignes `RegistrationAffinity` de sorte `refusedRelationTypes`, dont le texte est le type (ou `none`). Elles suivent ainsi le remplacement des affinités, l'export et l'effacement sans nouvelle colonne. La réponse `affinities.refusedRelationTypes` n'existe que si la question est demandée. L'obligation est satisfaite par une case ou une ligne de texte.
- **Copie d'un jeu** : les relations et les liens du questionnaire sont copiés avec les nouveaux identifiants.

## Conséquences

- Le lot 6 lit les liens et les relations tels qu'ils sont au moment du calcul, pas tels qu'ils étaient quand la personne a répondu.
- Une option renommée hors de l'éditeur perd ses liens : il n'y a pas d'autre chemin aujourd'hui.

## Options écartées

- **Relation symétrique** : écartée par l'utilisatrice, « qui commande qui » doit se lire.
- **Liens dans la définition versionnée** : chaque retouche des liens créerait une version du formulaire, sans changer ce que voit la personne.
- **Une colonne pour les cases** : il aurait fallu l'ajouter à l'export, à l'effacement et à chaque formulaire, alors que les lignes d'affinité le font déjà.
