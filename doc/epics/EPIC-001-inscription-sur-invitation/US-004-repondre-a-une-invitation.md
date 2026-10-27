---
id: US-004
titre: Répondre à une invitation par son lien personnel
statut: à faire
epic: EPIC-001
regles: [R6, R8, R13, R14, R16, R20, R22]
adr: [ADR-0018, ADR-0020, ADR-0021]
---

# US-004 : Répondre à une invitation par son lien personnel

En tant que personne invitée, sans compte, je veux répondre à l'invitation depuis le lien reçu, afin de confirmer ma venue et de donner mes informations aux orgas.

## Critères d'acceptation

- [ ] Le lien personnel ouvre une page publique qui montre :
  - le jeu, la session, sa date et son lieu ;
  - la note d'intention ;
  - le formulaire, dans la version en vigueur, prérempli avec le nom et l'email connus.
- [ ] J'accepte l'invitation en cochant l'adhésion et en remplissant les champs obligatoires. L'inscription passe alors à `confirmée` : je rejoins la session comme participant (R16, R22).
- [ ] Je peux décliner, sans remplir le formulaire ; l'inscription passe à `désistée`.
- [ ] Une page de confirmation récapitule ma réponse, et un email de confirmation part avec le même lien.
- [ ] Jusqu'à la clôture, je peux revenir par le lien et modifier mes informations (R13).
- [ ] Après la clôture, le lien ne permet plus que de consulter et de se désister (US-006).
- [ ] Après l'échéance, je peux encore accepter tant que les orgas n'ont pas libéré la place ; la page indique que le délai est dépassé (R20).
- [ ] Un lien invalide, invalidé ou dont l'inscription a été supprimée affiche une page « lien invalide », sans dire pourquoi.
- [ ] La page n'affiche aucune information sur les autres inscrits.

## Notes techniques

- Pages : `pages/inscription/[token].vue`, hors du layout organisateur, sans mise en cache hors ligne.
- Routes : `GET /api/public/registrations/:token`, `PUT /api/public/registrations/:token` (réponse et modifications), avec limitation de débit par IP ([ADR-0013](../../adr/ADR-0013-un-seul-processus.md)) et validation zod construite à partir de la version du formulaire.
- La création du `SessionParticipant` suit [ADR-0021](../../adr/ADR-0021-inscription-et-participation-de-session.md).
- Les données d'inscription sont ajoutées à `eraseParticipant` et `exportParticipantData`.

## Tests

- Intégration : accepter crée le `SessionParticipant` ; décliner ne le crée pas ; modification refusée après la clôture ; jeton faux et jeton invalidé donnent la même réponse ; débit limité ; export et suppression RGPD couvrent l'inscription.
- Bout en bout (Playwright) : invitation créée par l'organisatrice, réponse par le lien, la personne apparaît dans la session.
