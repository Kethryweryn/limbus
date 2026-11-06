---
id: US-166
titre: Demander au vivier qui est disponible
statut: à faire
epic: EPIC-047
regles: [R9, R10]
adr: []
---

# US-166 : Demander au vivier qui est disponible

En tant que organisatrice, je veux écrire au vivier quand une session s'ouvre, afin de savoir qui est intéressé.

## Critères d'acceptation

- [ ] Étant donné une session que je viens d'ouvrir, alors Limbus me propose d'envoyer la demande, sans rien envoyer de lui-même.
- [ ] Étant donné que je confirme, alors chaque personne du vivier sans réponse ni place pour cette session reçoit un email, sauf les rejoueurs exclus, les personnes sorties et les invitées qui n'ont pas encore répondu au questionnaire.
- [ ] Étant donné l'email, alors il dit que c'est une pré-inscription sans place garantie, donne la date, les deux réponses et le lien pour revoir ses réponses.
- [ ] Étant donné un échec d'envoi, alors l'écran le signale pour cette personne, et je peux réessayer.

## Notes techniques

Route d'action sous `server/api/registration-periods`, jamais mise en file hors ligne. Modèle d'email dans `server/utils/registrations.ts`, liens via `absoluteAppUrl()`. Date d'envoi sur `RegistrationSession`.

## Tests

Intégration : destinataires, exclusions, échec. `isolation.test.ts`. Playwright : envoi depuis la page Inscriptions.
