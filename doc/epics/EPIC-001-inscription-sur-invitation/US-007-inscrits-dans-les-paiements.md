---
id: US-007
titre: Inscrits confirmés dans le tableau des paiements
statut: terminée
epic: EPIC-001
regles: [R22]
adr: [ADR-0021]
---

# US-007 : Inscrits confirmés dans le tableau des paiements

En tant qu'organisatrice, je veux suivre le paiement des personnes confirmées dès leur confirmation, sans attendre le casting.

## Critères d'acceptation

- [x] Le tableau des paiements d'une session liste les participants qui ont un personnage PJ, comme aujourd'hui, et aussi les participants de rôle « participant » sans personnage. Ces derniers apparaissent avec la mention « personnage à attribuer ».
- [x] Une personne n'apparaît qu'une fois, même si elle a un personnage et un rôle de participant.
- [x] L'envoi des emails de paiement, les relances et le marquage « payé » fonctionnent pour ces lignes. Le texte de l'email ne mentionne pas de personnage quand il n'y en a pas.
- [x] Le reste du tableau ne change pas : les participants qui ont un personnage PJ ou PNJ y figurent déjà (`isPlayableCharacterType`), l'équipe cuisine et les orgas sans personnage n'y sont pas.

## Réalisation

- `buildPaymentRows` (`server/utils/sessionPayments.ts`) construit une ligne par personne : d'abord les personnes qui jouent un PJ ou un PNJ, triées par nom de personnage, puis les personnes de rôle « participant » sans personnage, triées par nom. L'envoi, la relance et le marquage « payé » partent de ces lignes.
- Une personne qui joue plusieurs personnages n'a plus qu'une ligne, avec tous ses personnages : auparavant elle apparaissait (et recevait l'email) une fois par personnage.
- L'email de paiement ne parlait déjà d'aucun personnage : il est inchangé.

## Notes techniques

- `getSessionPaymentDashboard` et `sendSessionPaymentEmails` (`server/utils/sessionPayments.ts`) partent aujourd'hui des attributions. Ils partiront de l'union des attributions PJ et des `SessionParticipant` de rôle participant.

## Tests

- Unitaires : construction des lignes (avec et sans personnage, doublon).
- Intégration : un inscrit confirmé sans personnage reçoit l'email de paiement ; le tableau d'une session sans inscription reste identique à aujourd'hui.
