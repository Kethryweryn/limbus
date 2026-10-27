---
id: US-007
titre: Inscrits confirmés dans le tableau des paiements
statut: à faire
epic: EPIC-001
regles: [R22]
adr: [ADR-0021]
---

# US-007 : Inscrits confirmés dans le tableau des paiements

En tant qu'organisatrice, je veux suivre le paiement des personnes confirmées dès leur confirmation, sans attendre le casting.

## Critères d'acceptation

- [ ] Le tableau des paiements d'une session liste les participants qui ont un personnage PJ, comme aujourd'hui, et aussi les participants de rôle « participant » sans personnage. Ces derniers apparaissent avec la mention « personnage à attribuer ».
- [ ] Une personne n'apparaît qu'une fois, même si elle a un personnage et un rôle de participant.
- [ ] L'envoi des emails de paiement, les relances et le marquage « payé » fonctionnent pour ces lignes. Le texte de l'email ne mentionne pas de personnage quand il n'y en a pas.
- [ ] Les PNJ et l'équipe cuisine restent hors du tableau, comme aujourd'hui.

## Notes techniques

- `getSessionPaymentDashboard` et `sendSessionPaymentEmails` (`server/utils/sessionPayments.ts`) partent aujourd'hui des attributions. Ils partiront de l'union des attributions PJ et des `SessionParticipant` de rôle participant.

## Tests

- Unitaires : construction des lignes (avec et sans personnage, doublon).
- Intégration : un inscrit confirmé sans personnage reçoit l'email de paiement ; le tableau d'une session sans inscription reste identique à aujourd'hui.
