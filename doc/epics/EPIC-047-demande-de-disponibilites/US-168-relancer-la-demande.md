---
id: US-168
titre: Relancer les personnes sans réponse
statut: à faire
epic: EPIC-047
regles: [R12]
adr: []
---

# US-168 : Relancer les personnes sans réponse

En tant que organisatrice, je veux relancer celles qui n'ont pas répondu, afin d'avoir une réponse sans écrire aux autres.

## Critères d'acceptation

- [ ] Étant donné une session avec des réponses partielles, quand je relance, alors seules les personnes sans réponse reçoivent l'email.
- [ ] Étant donné une relance envoyée, alors je vois sa date et le nombre de réponses reçues.

## Notes techniques

Même envoi qu'US-166, filtré. Date de relance sur `RegistrationSession`.

## Tests

Intégration : filtre des destinataires. Playwright : bouton Relancer.
