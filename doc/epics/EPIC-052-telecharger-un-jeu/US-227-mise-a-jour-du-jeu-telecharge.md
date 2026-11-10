---
id: US-227
titre: Garder à jour un jeu téléchargé
statut: à faire
epic: EPIC-052
regles: [R14]
adr: [ADR-0081]
---

# US-227 : Garder à jour un jeu téléchargé

En tant qu'organisatrice, je veux que le jeu téléchargé se remette à jour tout seul, afin d'avoir sur le lieu la dernière version préparée par l'équipe.

## Critères d'acceptation

- [ ] Étant donné un jeu téléchargé il y a plus d'une heure, quand j'ouvre Limbus avec le réseau, ou que le réseau revient, alors il se télécharge de nouveau en arrière-plan, et la date change.
- [ ] Étant donné un jeu téléchargé il y a moins d'une heure, alors rien n'est relu.
- [ ] Étant donné un jeu jamais téléchargé sur cet appareil, alors rien n'est relu.

## Notes techniques

Déclenché à l'ouverture et à l'événement `online`, un jeu à la fois (ADR-0081).

## Tests

De bout en bout (Playwright), sur les quatre axes (ADR-0079) :

- Actions : un changement fait par une co-organisatrice apparaît hors ligne après la mise à jour.
- Erreurs de saisie : aucune saisie.
- Droits : couvert par US-228 (accès perdu).
- Hors ligne : la mise à jour part au retour du réseau.
