---
id: US-124
titre: Politique de confidentialité et conditions
statut: à faire
epic: EPIC-033
regles: []
adr: [ADR-0055]
---

# US-124 : Politique de confidentialité et conditions

En tant que personne inscrite sur Limbus, je veux savoir qu'une organisatrice peut brancher une IA sur ses jeux, et ce que cette IA reçoit.

## Critères d'acceptation

- [ ] La politique de confidentialité dit :
  - qu'une organisatrice peut connecter un assistant d'IA ;
  - que l'assistant reçoit le contenu de ses jeux, les noms des participants et les notes d'organisation, mais jamais leurs coordonnées, leurs allergies ni leur texte libre ;
  - que le fournisseur de l'assistant devient un destinataire choisi par l'équipe ;
  - les durées : une autorisation est effacée à sa fin, et le journal est gardé un an.
- [ ] Les conditions d'utilisation disent que l'équipe qui branche une IA en porte la base légale et en informe ses joueurs.
- [ ] Une nouvelle `TERMS_VERSION` fait accepter de nouveau chaque compte.

## Tests

- Unitaires et e2e existants des pages légales, mis à jour.
