---
id: US-221
titre: Ne lire qu’une fois le refus d’une décision faite sans réseau
statut: terminée
epic: EPIC-050
regles: []
adr: []
---

# US-221 : Ne lire qu’une fois le refus d’une décision faite sans réseau

En tant qu'organisatrice, je veux qu'une décision de sélection refusée faute de réseau ne s'affiche qu'une fois, afin de ne pas lire deux messages pour un seul refus (défaut trouvé en écrivant les tests de l'US-203).

## Critères d'acceptation

- [x] Étant donné une décision prise sans réseau, alors seul le message de la sélection dit « Pas de réseau : cette action demande une connexion… ».
- [x] La relecture du vivier qui suit reprend la copie gardée sur l'appareil ; sans copie, elle dit que la page n'a pas été consultée avec le réseau, et non qu'une action demande une connexion.

## Notes techniques

`refresh` de `composables/useRegistrationPeriodActions.ts` reprend, sans réseau, les périodes du jeu dans la copie de la page (`/api/registration-periods`, tenue à jour par `keepPeriodsOffline`) ; sinon il passe par `loadErrorMessage` (revue de la PR #198).

## Tests

`tests/e2e/registrationRules.spec.ts` : décision prise sans réseau, un seul message.
