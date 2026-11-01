---
id: US-094
titre: Journal des tirages, annuler et refaire
statut: terminée
epic: EPIC-022
regles: [R18]
adr: [ADR-0048]
---

# US-094 : Journal des tirages, annuler et refaire

En tant qu'organisatrice, je veux consulter chaque tirage (graine, réglages, résultat, autrice, date) et pouvoir l'annuler tant que rien n'est annoncé.

## Critères d'acceptation

- [x] Le journal liste les tirages de la période, annulés compris, avec la graine, les réglages, l'ordre et le résultat de chaque session.
- [x] Un tirage s'annule tant qu'aucune de ses personnes n'a reçu d'annonce depuis : ses décisions repartent à « reçue ».
- [x] Un seul tirage actif à la fois : pour refaire, on annule d'abord.

## Notes techniques

- `GET /api/registration-periods/:id/draws`, `POST /api/registration-draws/:id/cancel`.

## Tests

- Intégration : journal, annulation, refus après une annonce, isolation des routes.
