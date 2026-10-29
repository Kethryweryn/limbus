---
id: US-075
titre: La fiche d'une personne qui a un compte n'est plus modifiable par l'équipe
statut: à faire
epic: EPIC-016
regles: [R12]
adr: [ADR-0042]
---

# US-075 : La fiche d'une personne qui a un compte n'est plus modifiable par l'équipe

En tant que personne qui joue, je veux que mes coordonnées ne soient changées que par moi.

## Critères d'acceptation

- [ ] Sur une fiche rattachée à un compte, le formulaire de l'équipe montre le nom et le téléphone sans permettre de les modifier, avec la mention « Tenus par la personne depuis son compte ».
- [ ] L'équipe peut encore changer l'email, avec l'avertissement que cela détache la fiche du compte ; ses jeux, ses notes et le reste de son travail restent modifiables.
- [ ] Le serveur ignore un nom ou un téléphone envoyé pour une fiche qui reste rattachée.

## Tests

- Intégration : nom et téléphone inchangés malgré l'envoi de l'équipe ; changement d'email qui détache, puis modification possible.
