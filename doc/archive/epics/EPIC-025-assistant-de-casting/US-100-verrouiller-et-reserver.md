---
id: US-100
titre: Verrouiller une attribution et réserver un personnage à une personne retenue
statut: terminée
epic: EPIC-025
regles: [R22, R29]
adr: [ADR-0051]
---

# US-100 : Verrouiller une attribution et réserver un personnage à une personne retenue

En tant qu'organisatrice, je veux fixer les attributions dont je suis sûre. Je veux aussi garder un personnage pour une personne retenue qui n'a pas encore confirmé, sans la faire entrer trop tôt dans le cast et les paiements.

## Critères d'acceptation

- [x] Chaque ligne du cast a un cadenas. Il est enregistré avec le cast et gardé quand on modifie les détails de la session ou qu'on la reporte.
- [x] Pour un personnage PJ, le choix du joueur propose aussi les personnes retenues pour la session qui n'ont pas encore confirmé, marquées « en attente de confirmation ».
- [x] Un personnage réservé ne fait pas entrer la personne dans le cast : elle n'apparaît ni dans les paiements, ni dans les envois de documents, ni dans les trombinoscopes.
- [x] Quand la personne confirme, elle reçoit le personnage réservé.
- [x] Quand elle se désiste ou que sa place est libérée, le personnage redevient libre. Une réservation dont l'inscription n'est plus retenue n'est plus affichée.
- [x] Le réglage « un seul PJ par participant » compte aussi les personnages réservés.

## Notes techniques

- `SessionAssignment.locked` et `SessionAssignment.reservedRegistrationId` (FK vers `Registration`, `SET NULL`).
- Le PUT de la session garde le cadenas et la réservation d'une ligne qui ne les envoie pas.

## Tests

- Intégration : cadenas enregistré puis gardé par l'enregistrement des détails ; réservation refusée pour une inscription d'un autre jeu ; confirmation qui donne le personnage ; désistement qui le libère ; un seul PJ avec une réservation.
