---
id: US-067
titre: Conversion des anciens comptes « organisateur »
statut: terminée
epic: EPIC-013
regles: [R1]
adr: [ADR-0038, ADR-0039]
---

# US-067 : Conversion des anciens comptes « organisateur »

En tant que mainteneuse, je veux qu'il ne reste que les rôles `admin` et `user` en base, comme prévu par [ADR-0038](../../../adr/ADR-0038-un-seul-role-global.md).

## Critères d'acceptation

- [x] Une migration passe les comptes `organizer` à `user` ; le build en service (lot 1) accepte déjà `user`.
- [x] Le code ne garde plus de cas pour `organizer`.

## Tests

- Unitaires et intégration existants.
