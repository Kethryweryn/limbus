---
id: US-088
titre: Annoncer les résultats
statut: terminée
epic: EPIC-021
regles: [R16, R20, R21]
adr: [ADR-0018, ADR-0047]
---

# US-088 : Annoncer les résultats

En tant qu'organisatrice, je veux prévenir d'un coup toutes les personnes dont le sort a été décidé, afin de pouvoir trier sans que chaque hésitation parte par email.

## Critères d'acceptation

- [x] « Annoncer les résultats » indique combien de personnes seront prévenues, et n'envoie qu'aux décisions pas encore annoncées.
- [x] La personne retenue reçoit la session, sa date et l'échéance pour confirmer ; la personne en attente apprend qu'elle est sur liste d'attente, sans rang ; la personne non retenue est prévenue.
- [x] Chaque email contient un nouveau lien personnel ; l'ancien cesse de marcher.
- [x] L'échéance d'une personne retenue est la date d'annonce plus le délai de la période.
- [x] Avant l'annonce, la personne voit toujours son inscription comme avant (« reçue », ou la dernière décision annoncée).
- [x] Un échec d'envoi n'empêche pas les autres ; la décision reste « à annoncer ».

## Notes techniques

- `Registration.announcedStatus`, `announcedSessionId`, `announcedAt` ; `POST /api/registration-periods/:id/announce`.

## Tests

- Intégration : annonce groupée, emails par statut, lien renouvelé, échéance, rien de renvoyé à la seconde annonce, état vu par la personne avant l'annonce.
