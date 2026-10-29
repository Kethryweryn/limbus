---
id: US-035
titre: Retirer une personne d'un jeu la retire de ses sessions
statut: à faire
epic: EPIC-007
regles: [R4]
adr: []
---

# US-035 : Retirer une personne d'un jeu la retire de ses sessions

En tant qu'organisatrice, je veux que retirer une personne d'un jeu la retire aussi des sessions de ce jeu, afin qu'elle n'y reste pas en équipe, au casting ou dans le suivi de présence.

## Critères d'acceptation

- [ ] Retirer le lien d'une fiche à un jeu retire la personne de l'équipe, du casting (le personnage reste sans joueur ni photo), des responsabilités du déroulé et des confirmations de présence de toutes les sessions de ce jeu.
- [ ] Ses inscriptions aux périodes de ce jeu passent au statut « retirée », avec l'organisatrice comme autrice ; celles déjà retirées ne changent pas.
- [ ] Ses paiements restent, affichés à part dans le tableau des paiements ([US-039](US-039-paiement-d-une-personne-qui-part.md)).
- [ ] Les photos qui ne servent plus sont supprimées ; les trombinoscopes déjà générés des sessions concernées sont refaits sans elle, sans faire échouer le retrait.
- [ ] La version des sessions concernées change ([ADR-0028](../../adr/ADR-0028-version-d-une-session.md)).
- [ ] Seuls les liens aux jeux de l'organisatrice sont retirés, comme aujourd'hui.

## Notes techniques

- `removeParticipantFromGames` dans `server/utils/participants.ts`, appelé par `PUT /api/participants/:id`.

## Tests

- Intégration (`participants.test.ts`) : équipe, casting, présence et inscriptions après le retrait ; l'autre jeu n'est pas touché.
