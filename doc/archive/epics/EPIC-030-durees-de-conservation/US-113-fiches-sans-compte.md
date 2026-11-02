---
id: US-113
titre: Effacer les fiches participant sans compte trois ans après leur dernière activité
statut: terminée
epic: EPIC-030
regles: [L6]
adr: [ADR-0056]
---

# US-113 : Effacer les fiches participant sans compte trois ans après leur dernière activité

En tant que joueuse sans compte, je veux que ma fiche ne soit pas gardée indéfiniment par les équipes.

## Critères d'acceptation

- [x] Une fiche sans compte est effacée par `eraseParticipant`, photos et fichiers compris, quand rien ne s'y est passé depuis trois ans. Comptent comme activité :
  - son ajout à un jeu ;
  - sa dernière modification ;
  - une inscription (créée ou modifiée) ;
  - une session où elle a un rôle ou un personnage : sa date, ou à défaut sa création.
- [x] Une fiche rattachée à un compte suit la règle des comptes.
- [x] L'effacement passe après une connexion réussie, par lots, sans ralentir la connexion.

## Tests

- Intégration : fiche ancienne effacée ; fiche avec une session récente, une inscription récente, ou un compte, gardée.
