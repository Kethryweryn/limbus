---
titre: Indicateurs pour concevoir le questionnaire de casting
statut: archivée
date: 2026-11-02
spec: ../../specs/SPEC-015-qualite-du-questionnaire.md
---

# Indicateurs pour concevoir le questionnaire de casting

## Besoin

L'équipe d'un jeu écrit les questions du formulaire d'inscription qui servent au casting, et les relie aux personnages, factions et intrigues ([SPEC-001](../../specs/SPEC-001-inscriptions.md), R8, [ADR-0050](../../adr/ADR-0050-relations-et-questionnaire-relie.md)). L'assistant de casting en tire une note pour chaque paire joueur ↔ personnage (R27, [ADR-0051](../../adr/ADR-0051-assistant-de-casting.md)).

Aujourd'hui, rien ne dit à l'équipe si son questionnaire permet de choisir :

- des questions peuvent recevoir presque toutes la même réponse, et ne départagent alors personne ;
- des personnages peuvent être reliés aux mêmes réponses, et donc impossibles à distinguer pour l'assistant ;
- un personnage peut n'être relié à aucune réponse, ou à une réponse que personne ne donne.

L'équipe ne découvre ces défauts qu'au moment du casting, trop tard pour changer le formulaire. Les personnes qui conçoivent ces formulaires ne sont pas formées aux statistiques : un écart-type ou une corrélation brute ne leur dit rien.

## Proposition

Donner à l'équipe des indicateurs sur son questionnaire, traduits en phrases et en repères simples (« bon », « à revoir »), avec ce qu'il faut faire pour corriger. Par exemple :

- **Avant les inscriptions**, à partir des seuls liens entre réponses et rôles :
  - personnages qu'aucune réponse ne rejoint ;
  - personnages trop proches : « Aldric et Bertrand sont reliés presque aux mêmes réponses : le questionnaire ne pourra pas les départager » ;
  - questions dont aucune option n'est reliée à un rôle.
- **Pendant les inscriptions**, à partir des réponses reçues :
  - questions qui ne départagent pas : « 9 personnes sur 10 ont choisi la même réponse » ;
  - questions redondantes : « ceux qui répondent A à la question 3 répondent presque toujours B à la question 5 » ;
  - personnages que peu de monde peut jouer, ou que tout le monde demande ;
  - une estimation générale : le questionnaire permet-il une sélection et une répartition ?

Les indicateurs restent réservés à l'équipe, comme les réponses (R24).

## Découpage envisagé

1. Indicateurs sur les liens, avant les inscriptions.
2. Indicateurs sur les réponses reçues.
3. Estimation générale et conseils de correction.

## Suite

Devenue [SPEC-015](../../specs/SPEC-015-qualite-du-questionnaire.md) le 2026-11-03, avec les choix de l'utilisatrice et l'état de l'art statistique ([ADR-0061](../../adr/ADR-0061-indicateurs-du-questionnaire.md)).

## Points à trancher

- **État de l'art** : au moment de la spécification, faire une recherche en ligne sur les problèmes voisins, et en tirer des propositions. Pistes de recherche :
  - analyse d'items des questionnaires (pouvoir discriminant d'une question, redondance) ;
  - outils de casting de GN existants ;
  - affectation et appariement (proximité entre profils) ;
  - présentation de statistiques à un public non formé.
- Quels indicateurs retenir, et à partir de combien de réponses ils deviennent fiables (en dessous, le dire plutôt qu'afficher un chiffre trompeur).
- Où les afficher : dans l'éditeur du formulaire, dans la sélection, dans l'onglet Cast, ou sur une page à part.
- Comment traduire chaque indicateur : formulations, seuils, couleurs, exemples.
- Faut-il aussi tenir compte des contraintes bloquantes et des affinités (R25, R28), ou du seul questionnaire ?
