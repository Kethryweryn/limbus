---
id: US-173
titre: Être prévenue quand une personne castée change ses réponses
statut: à faire
epic: EPIC-048
regles: [R16]
adr: []
---

# US-173 : Être prévenue quand une personne castée change ses réponses

En tant que organisatrice, je veux savoir qu'une personne castée a changé ses réponses, afin de revoir son casting.

## Critères d'acceptation

- [ ] Étant donné une personne castée ou inscrite pour une session à venir, quand elle change ses réponses, alors chaque organisatrice reçoit un email, et un repère apparaît sur sa ligne.
- [ ] Étant donné le repère, quand une organisatrice le marque comme lu, alors il disparaît pour toute l'équipe.
- [ ] Étant donné une personne seulement intéressée, pré-inscrite ou en attente, quand elle change ses réponses, alors rien ne se déclenche.

## Notes techniques

Date de modification sur `RegistrationSession`. L'email ne recopie pas les réponses. Le POST de lecture passe par `useApiAction`.

## Tests

Intégration : déclenchement, absence de déclenchement, lecture. `isolation.test.ts`. Playwright : repère.
