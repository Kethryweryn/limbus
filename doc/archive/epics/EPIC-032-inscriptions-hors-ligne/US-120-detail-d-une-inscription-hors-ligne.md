---
id: US-120
titre: Détail d'une inscription lisible hors ligne
statut: terminée
epic: EPIC-032
regles: [R1]
adr: [ADR-0012]
---

# US-120 : Détail d'une inscription lisible hors ligne

En tant qu'organisatrice sur le lieu du GN, sans réseau, je veux ouvrir le détail d'une inscription, afin de retrouver ses coordonnées, ses allergies et ses affinités.

## Critères d'acceptation

- [x] Étant donné une inscription ouverte avec le réseau, quand l'appareil n'a plus de réseau, alors son détail se rouvre depuis l'appareil, allergies et affinités comprises.
- [x] Une inscription jamais ouverte avec le réseau le dit, comme les autres pages.
- [x] La déconnexion efface ces données de l'appareil ([ADR-0012](../../../adr/ADR-0012-donnees-hors-ligne.md)).

## Notes techniques

`RegistrationDetail` lit `/api/registrations/:id` avec `offlineCache`.

## Tests

- E2E `offline.spec.ts` : détail ouvert avec le réseau, puis rouvert sans réseau, allergies affichées.
