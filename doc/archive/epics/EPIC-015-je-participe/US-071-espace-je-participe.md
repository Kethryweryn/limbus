---
id: US-071
titre: Espace « Je participe » : sessions, inscriptions, paiements
statut: terminée
epic: EPIC-015
regles: [R11]
adr: [ADR-0041]
---

# US-071 : Espace « Je participe » : sessions, inscriptions, paiements

En tant que personne qui joue, je veux retrouver au même endroit, pour chaque jeu, mes sessions, mes inscriptions et ce que je dois payer.

## Critères d'acceptation

- [x] Page « Je participe » : un bloc par jeu où l'une de mes fiches figure.
- [x] Sessions : nom, date, lieu, statut (prévue, annulée, reportée, terminée), mon rôle (PJ, PNJ, orga, cuisine), ma réponse de présence s'il y en a une. Pas le personnage.
- [x] Inscriptions : période, session, statut, date limite de réponse, et le bouton pour répondre, modifier ou se désister quand c'est possible (US-072).
- [x] Paiement de chaque session : montant dû, déjà versé, reste ; place offerte ; lien de paiement et RIB à télécharger s'ils sont fixés ; remboursement en cours si la session est annulée ou reportée.
- [x] On ne voit que ce qui concerne ses propres fiches : jamais les autres participants, ni les notes des équipes.

## Notes techniques

- `GET /api/me/participations` ; `GET /api/me/sessions/:id/rib` sert le RIB d'une session où l'une de mes fiches doit payer. Page `/participer`.

## Tests

- Intégration : contenu limité à ses fiches, rien d'un autre participant, pas de personnage ; RIB refusé hors de ses sessions.
