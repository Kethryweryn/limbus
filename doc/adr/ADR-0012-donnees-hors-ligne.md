---
id: ADR-0012
titre: Hors ligne en lecture d'abord, données de l'appareil effacées à la déconnexion
statut: accepté
date: 2026-10-27
liens: [ADR-0006]
---

# ADR-0012 : Hors ligne en lecture d'abord, données de l'appareil effacées à la déconnexion

*Rédigé a posteriori, pour des décisions prises le 2026-10-27.*

## Contexte

L'application est une PWA utilisée sur le lieu du GN, où le réseau est souvent absent. Elle met en cache des données personnelles (fiches, photos) dans IndexedDB et le Cache Storage. Avant, ces données restaient sur l'appareil après la déconnexion, et un autre compte connecté sur le même appareil pouvait les voir. N'importe quelle erreur d'API, y compris un 403 ponctuel, renvoyait à l'écran de connexion.

## Décision

- Hors ligne, l'application fonctionne d'abord en lecture. Les écritures hors ligne sont mises en file (`utils/offlineSync.ts`) ; leur resynchronisation reste un chantier à part.
- La déconnexion efface tout ce qui est sur l'appareil (`clearOfflineData`) : la base IndexedDB `limbus-db`, le cache des photos et l'identité hors ligne. Si des modifications hors ligne sont en attente, l'interface prévient avant de les perdre.
- À la connexion, `claimOfflineData(userId)` efface les données laissées par un autre compte.
- L'identité gardée pour le mode hors ligne expire après 7 jours sans connexion.
- Seul un 401 renvoie à l'écran de connexion ; un 403 est un refus ponctuel, affiché comme tel.

## Conséquences

- Un appareil prêté ou partagé ne garde rien après la déconnexion.
- Se déconnecter sans réseau fait perdre les modifications en attente : c'est signalé, mais pas empêché.
- Les tests de bout en bout vérifient l'effacement en comptant les enregistrements : la base IndexedDB est recréée vide après la déconnexion, elle ne disparaît pas.

## Options écartées

- **Chiffrer les données locales** : la clé devrait être sur l'appareil, ce qui protège peu contre un autre utilisateur de la même session du navigateur.
- **Aucun cache de données personnelles** : rendrait l'application inutile sur place sans réseau.
