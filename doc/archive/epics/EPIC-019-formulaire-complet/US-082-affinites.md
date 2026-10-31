---
id: US-082
titre: Demander les affinités
statut: terminée
epic: EPIC-019
regles: [R8, R24]
adr: [ADR-0045]
---

# US-082 : Demander les affinités

En tant qu'organisatrice, je veux savoir avec qui chaque personne veut jouer ou non, afin d'en tenir compte au casting.

## Critères d'acceptation

- [x] L'éditeur règle chacune des quatre affinités : avec qui je veux jouer, avec qui je ne veux pas jouer, les relations que je ne veux pas jouer, les personnes que je ne veux pas croiser ; demandée ou non, obligatoire ou non. Aucune n'est demandée par défaut.
- [x] La personne écrit une personne ou une relation par ligne ; chaque ligne est gardée à part.
- [x] Le détail d'une inscription montre ses affinités aux organisatrices, jamais aux autres inscrits ; l'export d'une personne les contient.

## Notes techniques

- Définition : `affinities` ; table `RegistrationAffinity` (inscription, sorte, texte, ordre).

## Tests

- Intégration : affinités enregistrées ligne par ligne, remplacées à la modification, ignorées si non demandées, obligatoires refusées vides, dans l'export.
