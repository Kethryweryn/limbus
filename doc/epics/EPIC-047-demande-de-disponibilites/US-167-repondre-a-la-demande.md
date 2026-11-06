---
id: US-167
titre: Répondre à une demande d'un clic
statut: à faire
epic: EPIC-047
regles: [R11]
adr: [../../adr/ADR-0070-liens-personnels-durables.md]
---

# US-167 : Répondre à une demande d'un clic

En tant que personne du vivier, je veux répondre depuis l'email, afin de me pré-inscrire sans tout remplir de nouveau.

## Critères d'acceptation

- [ ] Étant donné un bouton de l'email, quand je l'ouvre, alors une page demande de confirmer, et rien n'est enregistré à l'ouverture.
- [ ] Étant donné que je confirme « Disponible », alors je suis pré-inscrite pour la session.
- [ ] Étant donné que je confirme « Pas disponible », alors l'équipe voit ce refus, distinct d'une absence de réponse.
- [ ] Étant donné que je suis déjà castée pour cette session, alors la page me le dit et ne change rien.

## Notes techniques

Page sous `/inscription/<jeton>`, écriture par POST, limite de débit.

## Tests

Intégration : réponse, changement de réponse, personne castée, lien invalide. Playwright : parcours depuis le lien.
