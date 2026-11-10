---
id: US-225
titre: Désactiver le hors ligne sur un appareil prêté
statut: terminée
epic: EPIC-051
regles: [R5, R6, R7]
adr: [ADR-0081]
---

# US-225 : Désactiver le hors ligne sur un appareil prêté

En tant que personne qui utilise un appareil prêté, je veux que Limbus n'y garde rien, afin de ne laisser aucune donnée derrière moi.

## Critères d'acceptation

- [x] Étant donné la case « Garder Limbus sur cet appareil pour le hors ligne » cochée par défaut, quand je la décoche et confirme, alors tout est effacé, identité hors ligne comprise, et l'application gardée est retirée de l'appareil.
- [x] Étant donné le hors ligne désactivé, quand je consulte des pages puis coupe le réseau, alors rien n'a été gardé, identité hors ligne comprise, et une modification échoue avec le message des actions qui demandent le réseau.
- [x] Étant donné le hors ligne désactivé, quand je me déconnecte et qu'un autre compte se connecte, alors la case reste décochée.
- [x] Étant donné la case recochée, alors les pages consultées sont de nouveau gardées, et rien de ce qui était effacé ne revient.
- [x] Étant donné des modifications en attente, alors la même demande qu'à l'effacement s'affiche avant de désactiver.

## Notes techniques

Réglage `limbusOfflineDisabled` dans `localStorage` (ADR-0081) ; `useApiFetch` ne garde ni ne met en file ; le service worker est désinscrit et n'est pas réinscrit au chargement.

## Notes de réalisation

- L'inscription de l'application passe par `plugins/serviceWorker.client.ts` (option `client.registerPlugin: false` du module) : elle n'a pas lieu quand le hors ligne est désactivé, et se fait sans recharger à la réactivation.
- Désactivé, l'identité reste en mémoire le temps de la page ouverte : une coupure de réseau ne la ferme pas, mais rien n'est écrit sur l'appareil, et Limbus ne s'y rouvre pas sans réseau.
- Le bandeau « Pas de connexion au serveur » dit, sur un appareil désactivé, que rien n'y est gardé.

## Tests

De bout en bout (`tests/e2e/offlineDevice.spec.ts`), sur les quatre axes (ADR-0079) :

- Actions : « décocher efface tout, retire l’application, et ne garde plus rien ; recocher la réinscrit ».
- Erreurs de saisie : renoncer à la confirmation laisse la case cochée (même test).
- Droits : « désactivé, une modification sans réseau échoue sans file, et le réglage survit à un autre compte ».
- Hors ligne : même test : la modification échoue avec le message des actions qui demandent le réseau, et rien n'entre dans la file.

Unitaires : `tests/utils/offlineDevice.test.ts` (réglage de l'appareil, stockage illisible).
