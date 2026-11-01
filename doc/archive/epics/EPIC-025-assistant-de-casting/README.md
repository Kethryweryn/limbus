---
id: EPIC-025
titre: Assistant de casting
statut: terminé
spec: ../../../specs/SPEC-001-inscriptions.md
date: 2026-11-01
---

# EPIC-025 : Assistant de casting

## Objectif

Lot 6 de [SPEC-001](../../../specs/SPEC-001-inscriptions.md) (R27 à R29). Dans le cast d'une session, l'assistant propose qui joue quel personnage, d'après les réponses au questionnaire reliées aux rôles (lot 5). Il écarte les relations refusées et respecte les attributions verrouillées. La proposition ne s'applique qu'à la demande.

## Décisions

- L'assistant est un bouton « Proposer une répartition » dans l'onglet Cast de la session. Il répartit les joueurs du cast et les personnes retenues pour la session qui n'ont pas encore confirmé, sur les personnages PJ.
- La note d'un joueur pour un personnage ne vient que du questionnaire :
  - une réponse reliée au personnage vaut 1 point ;
  - une réponse reliée à sa faction ou à son intrigue vaut un demi-point ;
  - une échelle compte à proportion : 1 ne compte pas, 5 compte en entier.
- « Veut jouer avec » sert à placer les personnes dans la même session, pas à choisir les personnages : il ne compte pas dans la note.
- Deux interdits :
  - un personnage qui a une relation d'un type que le joueur refuse ;
  - deux personnes dont l'une ne veut pas jouer avec l'autre ne reçoivent pas deux personnages en relation directe.
- Une partie faction ou intrigue en commun n'est pas un interdit.
- « Ne veut pas croiser » reste une alerte de la sélection (R25). L'assistant la signale aussi quand les deux personnes sont dans la session.
- Chaque ligne du cast a un cadenas. Une attribution verrouillée ne bouge pas.
- « Appliquer la proposition » remplit le formulaire du cast. L'organisatrice relit, ajuste, puis enregistre.
- Un personnage donné à une personne retenue qui n'a pas confirmé lui est réservé. Elle entre dans le cast et les paiements en confirmant. Le personnage redevient libre si elle se désiste ou si sa place est libérée.

## US

| US | Titre | Statut |
|---|---|---|
| [US-100](US-100-verrouiller-et-reserver.md) | Verrouiller une attribution et réserver un personnage à une personne retenue | terminée |
| [US-101](US-101-notes-et-interdits.md) | Voir la note de chaque joueur pour chaque personnage, et les interdits | terminée |
| [US-102](US-102-proposer-une-repartition.md) | Proposer une répartition et l'appliquer au cast | terminée |

## Définition de terminé

- `npm run lint`, `npm run typecheck`, `npm test` et la CI passent.
- [ADR-0051](../../../adr/ADR-0051-assistant-de-casting.md).
