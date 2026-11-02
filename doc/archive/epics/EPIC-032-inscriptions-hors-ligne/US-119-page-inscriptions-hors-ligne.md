---
id: US-119
titre: Page Inscriptions et sélection lisibles hors ligne
statut: terminée
epic: EPIC-032
regles: [R1]
adr: [ADR-0012]
---

# US-119 : Page Inscriptions et sélection lisibles hors ligne

En tant qu'organisatrice sur le lieu du GN, sans réseau, je veux consulter les inscriptions et la sélection de chaque période, afin de savoir qui est inscrit, retenu ou en attente.

## Critères d'acceptation

- [x] Étant donné la page Inscriptions ouverte avec le réseau, quand l'appareil perd le réseau, alors elle se rouvre depuis sa dernière version : jeux, périodes et inscriptions.
- [x] La sélection de chaque période (retenus, listes d'attente, vivier) et le journal des tirages se lisent aussi depuis l'appareil.
- [x] Après une action faite avec le réseau (décision, relance, invitation…), le bloc du jeu relu remplace sa partie dans la copie de la page : hors ligne, la page montre ce dernier état.
- [x] La page se relit quand la connexion change, comme les autres listes.
- [x] Hors ligne, les actions restent visibles et échouent avec un message.

## Notes techniques

- `pages/registrations/index.vue` lit au montage, avec `fetchOfflineList('games', …)` et `useApiFetch('/api/registration-periods', { offlineCache: true })`, et se relit avec `useConnectionRefresh`. Chaque bloc de jeu reprend les périodes relues par la page.
- `useRegistrationPeriodActions` : la relecture d'un bloc reporte ses périodes dans la copie de `/api/registration-periods` (`keepPeriodsOffline`).
- `RegistrationSelection` lit la sélection et le journal avec `offlineCache`.

## Tests

- E2E `offline.spec.ts` : page lue avec le réseau, décision prise, puis page, sélection et décision relues sans réseau.
