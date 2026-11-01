---
id: US-108
titre: Supprimer les photos d'une session après le délai du jeu
statut: terminée
epic: EPIC-028
regles: [P3]
adr: [ADR-0054]
---

# US-108 : Supprimer les photos d'une session après le délai du jeu

En tant que participante, je veux que ma photo ne soit pas gardée au-delà du délai annoncé.

## Critères d'acceptation

- [x] Une fois passée la date de la session plus la durée du jeu, à la prochaine connexion d'une organisatrice ou au prochain envoi :
  - les photos du cast de la session sont supprimées ;
  - ses trombinoscopes générés sont supprimés ;
  - les fichiers qui ne servent plus sont effacés.
- [x] Une session sans date, ou dont l'échéance n'est pas passée, n'est pas touchée.
- [x] La photo par défaut d'un personnage n'est pas touchée.

## Tests

- Intégration : session échue purgée, session récente et session sans date intactes, fichier effacé.
