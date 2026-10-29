---
id: US-070
titre: Rattacher les fiches participant au compte de leur adresse
statut: à faire
epic: EPIC-015
regles: [R11]
adr: [ADR-0041]
---

# US-070 : Rattacher les fiches participant au compte de leur adresse

En tant que personne qui joue, je veux que les fiches que les équipes tiennent sur moi se rattachent à mon compte, sans rien demander.

## Critères d'acceptation

- [ ] À la confirmation d'une adresse (inscription, changement d'email, lien de mot de passe), les fiches qui portent cette adresse, sans tenir compte de la casse, se rattachent au compte.
- [ ] Une fiche créée ou modifiée par une équipe avec l'adresse d'un compte confirmé s'y rattache aussitôt ; une fiche dont l'email change suit la nouvelle adresse (rattachée à un autre compte, ou à aucun).
- [ ] Les fiches existantes se rattachent au déploiement.
- [ ] Un compte supprimé laisse ses fiches à leurs équipes, sans rattachement.

## Notes techniques

- Colonne `Participant.userId` (nullable, `SET NULL`). Fonctions `accountIdForEmail` et `linkParticipantsToUser`.

## Tests

- Intégration : rattachement à la confirmation, à la création et à la modification d'une fiche, détachement au changement d'email.
