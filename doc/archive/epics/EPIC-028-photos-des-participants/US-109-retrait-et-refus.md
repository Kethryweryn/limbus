---
id: US-109
titre: Retirer ses photos et refuser les suivantes
statut: terminée
epic: EPIC-028
regles: [P4, P5]
adr: [ADR-0054]
---

# US-109 : Retirer ses photos et refuser les suivantes

En tant que participante, je veux retirer mes photos de Limbus et que l'équipe ne puisse pas en remettre.

## Critères d'acceptation

- [x] Dans « Je participe », le bouton « Retirer mes photos » :
  - supprime les photos de toutes mes sessions ;
  - refait les trombinoscopes déjà générés de ces sessions ;
  - passe mes fiches à « photo refusée ».
- [x] Au même endroit, « Accepter de nouveau une photo » lève le refus.
- [x] Une fiche à « photo refusée » ne peut pas recevoir de photo dans le cast. Le cast et la fiche montrent le refus.
- [x] Ses trombinoscopes n'utilisent pas de photo d'elle.
- [x] L'équipe peut poser ou lever le refus depuis la fiche, sauf lever celui d'une fiche rattachée à un compte.
- [x] L'export de la personne contient la date du refus.

## Tests

- Intégration : retrait depuis le compte, photo refusée au cast, trombinoscope sans photo, refus posé et levé par l'équipe, levée refusée sur une fiche rattachée, isolation des routes.
