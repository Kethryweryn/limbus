---
id: US-015
titre: Retirer « prête à envoyer » des intrigues
statut: terminée
epic: EPIC-003
regles: [R9]
adr: []
---

# US-015 : Retirer « prête à envoyer » des intrigues

En tant qu'organisatrice, je veux que l'API d'une intrigue ne propose que des champs qui ont un effet, afin de ne pas croire qu'une intrigue s'envoie.

## Critères d'acceptation

- [x] Le schéma d'une intrigue n'a plus `readyToSend`. Une intrigue n'est envoyée à personne : seuls les documents et les fiches le sont ([SPEC-006](../../specs/SPEC-006-emails-et-paiements.md)).
- [x] Une requête qui envoie encore `readyToSend` n'échoue pas : le champ est ignoré, comme aujourd'hui.

## Notes techniques

- `intrigueSchema` dans `server/utils/schemas.ts`. Le champ n'existe ni en base, ni dans l'interface.

## Tests

- Unitaires : `intrigueSchema` ne renvoie pas `readyToSend`, même quand la requête le porte.
