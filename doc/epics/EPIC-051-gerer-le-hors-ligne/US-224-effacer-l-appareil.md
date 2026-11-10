---
id: US-224
titre: Effacer les données hors ligne de mon appareil sans me déconnecter
statut: terminée
epic: EPIC-051
regles: [R3, R4]
adr: [ADR-0081]
---

# US-224 : Effacer les données hors ligne de mon appareil sans me déconnecter

En tant que personne connectée, je veux effacer ce que mon appareil garde sans me déconnecter, afin de libérer de la place ou de ne rien laisser après un GN.

## Critères d'acceptation

- [x] Étant donné des données gardées, quand je choisis « Effacer » et confirme, alors pages, PDF, photos, jeux téléchargés et file sont vidés, je reste connectée, et la place affichée retombe.
- [x] Étant donné un effacement fait, quand je coupe le réseau et rouvre Limbus, alors il s'ouvre pour mon compte, et une page dit qu'elle n'a pas été consultée avec le réseau.
- [x] Étant donné des modifications en attente et le réseau, alors Limbus propose de les envoyer avant d'effacer, ou de les abandonner ; envoyées, elles sont sur le serveur avant l'effacement.
- [x] Étant donné un envoi qui laisse des modifications refusées, alors Limbus s'arrête, dit lesquelles restent, et propose de les abandonner pour effacer, ou de renoncer.
- [x] Étant donné des modifications en attente sans réseau, alors seul l'abandon est proposé, et renoncer ne change rien.

## Notes techniques

Nouvelle fonction d'effacement des données qui garde l'identité hors ligne et le propriétaire des données (à côté de `clearOfflineData`, qui reste pour la déconnexion) ; envoi par `processOfflineQueue`.

## Tests

De bout en bout (`tests/e2e/offlineDevice.spec.ts`), sur les quatre axes (ADR-0079) :

- Actions : « la place des données s’affiche, et l’effacement la vide sans déconnecter » ; « les modifications en attente partent avant l’effacement ».
- Erreurs de saisie : « une modification refusée arrête l’effacement ; renoncer la garde, l’abandonner efface ».
- Droits : l'effacement ne touche que l'appareil ; le serveur ne garde rien de ces réglages, et aucun lieu n'est créé par une modification abandonnée.
- Hors ligne : « sans réseau, seul l’abandon est proposé, et l’effacement se fait ».
