---
id: US-051
titre: Se déconnecter sans réseau
statut: terminée
epic: EPIC-010
regles: [R10]
adr: [ADR-0012]
---

# US-051 : Se déconnecter sans réseau

En tant qu'organisatrice sur un appareil prêté, je veux que la déconnexion efface l'appareil même sans réseau.

## Critères d'acceptation

- [x] Sans réseau, la déconnexion efface aussitôt tout le cache de l'appareil et ramène à l'écran de connexion.
- [x] La déconnexion est envoyée au serveur dès que le réseau revient, avant toute autre requête : la session ne se rouvre pas toute seule.

## Notes techniques

- Marqueur `limbusPendingLogout` dans `localStorage`, posé après l'effacement et lu par `app.vue` avant de vérifier la connexion.

## Tests

- Bout en bout : déconnexion avec le réseau coupé, appareil effacé, puis session fermée au retour du réseau.
