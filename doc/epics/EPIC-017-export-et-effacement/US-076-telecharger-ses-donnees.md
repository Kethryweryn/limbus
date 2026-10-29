---
id: US-076
titre: Télécharger toutes ses données depuis son compte
statut: à faire
epic: EPIC-017
regles: [R13]
adr: [ADR-0043]
---

# US-076 : Télécharger toutes ses données depuis son compte

En tant que personne qui a un compte, je veux télécharger tout ce que Limbus garde sur moi (droit d'accès).

## Critères d'acceptation

- [ ] « Mon compte » propose « Télécharger mes données » : un fichier JSON.
- [ ] Il contient le compte (nom, email, rôle, dates, coordonnées et allergies, plafond et espace utilisé), les jeux possédés et partagés (titres), et, pour chaque fiche rattachée, tout ce que l'export d'une fiche contient, dans tous les jeux, notes des équipes comprises.
- [ ] Rien d'autre que ses propres données : ni mot de passe, ni jeton, ni données d'autres personnes.

## Notes techniques

- `GET /api/account/export`, réutilise `exportParticipantData` sans limite de jeux pour les fiches rattachées.

## Tests

- Intégration : contenu de l'export (compte, coordonnées, fiches de deux équipes), sans mot de passe ni jeton.
