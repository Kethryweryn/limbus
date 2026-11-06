---
id: US-167
titre: Répondre à une demande d'un clic
statut: terminée
epic: EPIC-047
regles: [R11, R29]
adr: [../../adr/ADR-0070-liens-personnels-durables.md]
---

# US-167 : Répondre à une demande d'un clic

En tant que personne du vivier, je veux répondre depuis l'email, afin de me pré-inscrire sans tout remplir de nouveau.

## Critères d'acceptation

- [x] Étant donné un bouton de l'email, quand je l'ouvre, alors une page demande de confirmer, et rien n'est enregistré à l'ouverture.
- [x] Étant donné que je confirme « Disponible », alors je suis pré-inscrite pour la session.
- [x] Étant donné que je confirme « Pas disponible », alors l'équipe voit ce refus, distinct d'une absence de réponse.
- [x] Étant donné que je suis déjà pré-inscrite, en attente, retenue ou inscrite, quand je confirme « Disponible », alors rien ne change, et une décision non annoncée reste invisible.
- [x] Étant donné que je suis en attente et réponds « Pas disponible », alors je sors de la file et les suivantes avancent.
- [x] Étant donné que je suis retenue sans annonce et réponds « Pas disponible », alors je lis seulement « réponse enregistrée », je suis retirée du cast, le personnage réservé est libéré et l'équipe reçoit un email.
- [x] Étant donné une place annoncée ou confirmée, alors la page me le dit, ne change rien, et me renvoie vers l'annulation.

## Notes techniques

Page sous `/inscription/<jeton>`, écriture par POST, limite de débit.

## Tests

Intégration : `tests/integration/availabilityRequests.test.ts` (réponse, changement de réponse, chaque cas de R29, lien invalide). Playwright : `tests/e2e/registration.spec.ts`.
