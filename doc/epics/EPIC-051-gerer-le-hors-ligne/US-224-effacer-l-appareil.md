---
id: US-224
titre: Effacer les données hors ligne de mon appareil sans me déconnecter
statut: à faire
epic: EPIC-051
regles: [R3, R4]
adr: [ADR-0081]
---

# US-224 : Effacer les données hors ligne de mon appareil sans me déconnecter

En tant que personne connectée, je veux effacer ce que mon appareil garde sans me déconnecter, afin de libérer de la place ou de ne rien laisser après un GN.

## Critères d'acceptation

- [ ] Étant donné des données gardées, quand je choisis « Effacer » et confirme, alors pages, PDF, photos, jeux téléchargés et file sont vidés, je reste connectée, et la place affichée retombe.
- [ ] Étant donné un effacement fait, quand je coupe le réseau et rouvre Limbus, alors il s'ouvre pour mon compte, et une page dit qu'elle n'a pas été consultée avec le réseau.
- [ ] Étant donné des modifications en attente et le réseau, alors Limbus propose de les envoyer avant d'effacer, ou de les abandonner ; envoyées, elles sont sur le serveur avant l'effacement.
- [ ] Étant donné des modifications en attente sans réseau, alors seul l'abandon est proposé, et renoncer ne change rien.

## Notes techniques

Nouvelle fonction d'effacement des données qui garde l'identité hors ligne et le propriétaire des données (à côté de `clearOfflineData`, qui reste pour la déconnexion) ; envoi par `processOfflineQueue`.

## Tests

De bout en bout (Playwright), sur les quatre axes (ADR-0079) :

- Actions : effacer, puis vérifier la base vide et la session toujours ouverte.
- Erreurs de saisie : renoncer à la confirmation ne change rien.
- Droits : effacer ne touche que l'appareil ; rien ne change sur le serveur, ni pour un autre appareil du même compte.
- Hors ligne : effacer sans réseau, modifications en attente abandonnées ; avec le réseau, envoyées d'abord.
