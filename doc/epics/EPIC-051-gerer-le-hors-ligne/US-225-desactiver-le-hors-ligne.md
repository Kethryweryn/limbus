---
id: US-225
titre: Désactiver le hors ligne sur un appareil prêté
statut: à faire
epic: EPIC-051
regles: [R5, R6, R7]
adr: [ADR-0081]
---

# US-225 : Désactiver le hors ligne sur un appareil prêté

En tant que personne qui utilise un appareil prêté, je veux que Limbus n'y garde rien, afin de ne laisser aucune donnée derrière moi.

## Critères d'acceptation

- [ ] Étant donné la case « Garder Limbus sur cet appareil pour le hors ligne » cochée par défaut, quand je la décoche et confirme, alors tout est effacé, identité hors ligne comprise, et l'application gardée est retirée de l'appareil.
- [ ] Étant donné le hors ligne désactivé, quand je consulte des pages puis coupe le réseau, alors rien n'a été gardé, et une modification échoue avec le message des actions qui demandent le réseau.
- [ ] Étant donné le hors ligne désactivé, quand je me déconnecte et qu'un autre compte se connecte, alors la case reste décochée.
- [ ] Étant donné la case recochée, alors les pages consultées sont de nouveau gardées, et rien de ce qui était effacé ne revient.
- [ ] Étant donné des modifications en attente, alors la même demande qu'à l'effacement s'affiche avant de désactiver.

## Notes techniques

Réglage `limbusOfflineDisabled` dans `localStorage` (ADR-0081) ; `useApiFetch` ne garde ni ne met en file ; le service worker est désinscrit et n'est pas réinscrit au chargement.

## Tests

De bout en bout (Playwright), sur les quatre axes (ADR-0079) :

- Actions : décocher, consulter une page, couper le réseau : la page n'est pas gardée.
- Erreurs de saisie : renoncer à la confirmation laisse la case cochée.
- Droits : le réglage vaut pour l'appareil, et survit à la connexion d'un autre compte.
- Hors ligne : désactivé, une modification sans réseau échoue avec le message attendu, et rien n'entre dans la file.
