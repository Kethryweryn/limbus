---
id: US-102
titre: Proposer une répartition et l'appliquer au cast
statut: terminée
epic: EPIC-025
regles: [R27, R28, R29]
adr: [ADR-0051]
---

# US-102 : Proposer une répartition et l'appliquer au cast

En tant qu'organisatrice, je veux une proposition de cast qui respecte mes choix, et décider moi-même de l'appliquer.

## Critères d'acceptation

- [x] « Proposer une répartition », dans l'onglet Cast, affiche pour chaque personnage PJ le joueur proposé, sa note et son détail.
- [x] La proposition cherche la meilleure note totale. Elle ne viole aucun interdit. Elle ne donne qu'un personnage PJ à chaque joueur.
- [x] Les attributions verrouillées sont gardées, et un joueur qui a déjà un personnage verrouillé n'en reçoit pas d'autre. Une ligne verrouillée sans joueur reste vide.
- [x] Les joueurs qui restent sans personnage sont listés, avec la raison (plus de personnage libre, ou tous interdits).
- [x] « Appliquer la proposition » remplit les lignes non verrouillées du formulaire du cast, sans rien enregistrer. Une personne retenue non confirmée y entre comme réservation.

## Notes techniques

- Affectation optimale (méthode hongroise) sur les notes, interdits exclus ; les conflits « ne veut pas jouer avec » sont ensuite défaits par échange ou déplacement.

## Tests

- Unitaires : proposition optimale, verrous respectés, conflit défait.
- Bout en bout : verrouiller, proposer, appliquer, enregistrer.
