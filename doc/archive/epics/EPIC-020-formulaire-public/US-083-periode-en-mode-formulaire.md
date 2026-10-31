---
id: US-083
titre: Ouvrir une période en mode formulaire, ou l'inscription permanente
statut: terminée
epic: EPIC-020
regles: [R1, R3, R6, R30, R31, R32, R33]
adr: [ADR-0046]
---

# US-083 : Ouvrir une période en mode formulaire, ou l'inscription permanente

En tant qu'organisatrice, je veux ouvrir les inscriptions à tout le monde, pour quelques sessions ou pour tout le jeu, afin de recruter au-delà des personnes que je connais.

## Critères d'acceptation

- [x] Une nouvelle période se crée en mode invitation ou formulaire ; le mode ne change plus ensuite.
- [x] Elle couvre des sessions précises, ou tout le jeu : c'est l'inscription permanente, toujours en mode formulaire, sans sessions ni date de clôture. Un jeu n'a qu'une inscription permanente ouverte à la fois.
- [x] Une session rattachée à une période dédiée n'est plus couverte par l'inscription permanente.
- [x] Une case « Me prévenir de chaque inscription reçue » envoie un email à la propriétaire et aux co-organisatrices pour chaque inscription reçue.
- [x] Une période en mode formulaire montre son lien de diffusion, à copier, et ses inscriptions reçues avec leurs disponibilités.

## Notes techniques

- `RegistrationPeriod.notifyTeam` ; `scope = game` pour l'inscription permanente.

## Tests

- Intégration : création en mode formulaire, inscription permanente sans sessions, une seule ouverte par jeu, isolation des routes.
