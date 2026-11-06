---
id: US-159
titre: Se connecter sans rester bloquée
statut: terminée
epic: EPIC-045
regles: []
adr: []
---

# US-159 : Se connecter sans rester bloquée

En tant que personne qui se connecte, je veux qu'un double clic ou une panne passée ne me bloque pas, afin de retrouver mon accès sans chercher à fermer mon onglet.

## Critères d'acceptation

- [x] Étant donné un double clic sur « Se connecter », alors une seule connexion part, et le bouton reste inactif jusqu'au rechargement.
- [x] Étant donné un onglet marqué hors ligne, quand il s'ouvre avec le réseau, alors il interroge le serveur et rend le formulaire s'il répond.
- [x] Étant donné une panne vraie, quand le serveur répond de nouveau, alors « Réessayer » rend le formulaire sans recharger.

## Notes techniques

Une requête coupée par un rechargement ressemble à une panne (`isServerUnavailableError`), et l'indisponibilité est gardée dans `sessionStorage`. `components/LoginScreen.vue`, `app.vue`.

## Tests

`tests/e2e/auth.spec.ts`.
