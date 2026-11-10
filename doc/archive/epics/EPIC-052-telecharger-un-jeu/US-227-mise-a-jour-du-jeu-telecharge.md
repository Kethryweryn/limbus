---
id: US-227
titre: Garder à jour un jeu téléchargé
statut: terminée
epic: EPIC-052
regles: [R14]
adr: [ADR-0081]
---

# US-227 : Garder à jour un jeu téléchargé

En tant qu'organisatrice, je veux que le jeu téléchargé se remette à jour tout seul, afin d'avoir sur le lieu la dernière version préparée par l'équipe.

## Critères d'acceptation

- [x] Étant donné un jeu téléchargé il y a plus d'une heure, quand j'ouvre Limbus avec le réseau, ou que le réseau revient, alors il se télécharge de nouveau en arrière-plan, et la date change.
- [x] Étant donné un jeu téléchargé il y a moins d'une heure, alors rien n'est relu.
- [x] Étant donné un jeu jamais téléchargé sur cet appareil, alors rien n'est relu.

## Notes techniques

Déclenché à l'ouverture et à l'événement `online`, un jeu à la fois (ADR-0081).

## Notes de réalisation

`refreshDownloads` (`utils/offlineDownload.ts`), lancée par `app.vue` à l'ouverture et au retour du réseau, après l'envoi des modifications en attente ; un seul passage à la fois. Le jeu se relit par son identifiant (`/api/games/:id`), pour suivre un titre changé.

## Tests

De bout en bout (`tests/e2e/offlineDownload.spec.ts`), sur les quatre axes (ADR-0079) :

- Actions : « un jeu téléchargé il y a plus d’une heure se remet à jour au retour du réseau ; un accès retiré l’efface » : le jeu ancien est relu, le jeu récent ne l'est pas.
- Erreurs de saisie : aucune saisie.
- Droits : même test, accès retiré pendant la mise à jour (US-228).
- Hors ligne : la mise à jour part au retour du réseau (même test).
