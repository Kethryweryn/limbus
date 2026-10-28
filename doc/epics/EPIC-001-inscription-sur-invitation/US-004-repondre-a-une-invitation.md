---
id: US-004
titre: Répondre à une invitation par son lien personnel
statut: terminée
epic: EPIC-001
regles: [R6, R8, R13, R14, R16, R20, R22]
adr: [ADR-0018, ADR-0020, ADR-0021]
---

# US-004 : Répondre à une invitation par son lien personnel

En tant que personne invitée, sans compte, je veux répondre à l'invitation depuis le lien reçu, afin de confirmer ma venue et de donner mes informations aux orgas.

## Critères d'acceptation

- [x] Le lien personnel ouvre une page publique qui montre :
  - le jeu, la session, sa date et son lieu ;
  - la note d'intention ;
  - le formulaire, dans la version en vigueur, prérempli avec le nom et l'email connus.
- [x] J'accepte l'invitation en cochant l'adhésion et en remplissant les champs obligatoires. L'inscription passe alors à `confirmée` : je rejoins la session comme participant (R16, R22).
- [x] Je peux décliner, sans remplir le formulaire ; l'inscription passe à `désistée`.
- [x] Une page de confirmation récapitule ma réponse, et un email de confirmation part avec le même lien.
- [x] Jusqu'à la clôture, je peux revenir par le lien et modifier mes informations (R13).
- [x] Après la clôture, le lien ne permet plus que de consulter et de se désister (US-006).
- [x] Après l'échéance, je peux encore accepter tant que les orgas n'ont pas libéré la place ; la page indique que le délai est dépassé (R20).
- [x] Un lien invalide, invalidé ou dont l'inscription a été supprimée affiche une page « lien invalide », sans dire pourquoi.
- [x] La page n'affiche aucune information sur les autres inscrits.

Précisions apportées pendant la réalisation :

- Une invitation sans réponse peut encore être acceptée ou déclinée après la clôture (R13 : « confirmer sa place ou se désister »). C'est la modification d'une inscription confirmée qui s'arrête à la clôture.
- Décliner n'est possible que sur une invitation sans réponse. Une personne qui a accepté se désiste avec US-006.
- L'email de confirmation part à la première acceptation, à l'adresse saisie dans le formulaire. Il ne contient pas les informations de santé. Une modification ou un refus n'envoient pas d'email.
- Le préremplissage découpe le nom de la fiche en « Prénom Nom » ; la personne corrige au besoin.
- Si le jeu n'a jamais enregistré de formulaire, la première réponse enregistre la définition par défaut comme version 1, pour que l'inscription garde la version qu'elle a remplie (R9).
- La page s'affiche hors de l'application organisateur (ni menu, ni bandeau de synchronisation), même pour une organisatrice connectée.

## Notes techniques

- Pages : `pages/inscription/[token].vue`, hors du layout organisateur, sans mise en cache hors ligne.
- Routes : `GET /api/public/registrations/:token`, `PUT /api/public/registrations/:token` (réponse et modifications), avec limitation de débit par IP ([ADR-0013](../../adr/ADR-0013-un-seul-processus.md)) et validation zod construite à partir de la version du formulaire.
- La création du `SessionParticipant` suit [ADR-0021](../../adr/ADR-0021-inscription-et-participation-de-session.md).
- Les données d'inscription sont ajoutées à `eraseParticipant` et `exportParticipantData`.

## Tests

- Intégration : accepter crée le `SessionParticipant` ; décliner ne le crée pas ; modification refusée après la clôture ; jeton faux et jeton invalidé donnent la même réponse ; débit limité ; export et suppression RGPD couvrent l'inscription.
- Bout en bout (Playwright) : invitation créée par l'organisatrice, réponse par le lien, la personne apparaît dans la session.

## Réalisation

- `utils/registrations.ts` (partagé) : invitation en délai dépassé (R20), expiration du lien 30 jours après la dernière session (ADR-0018), découpage du nom pour le préremplissage.
- `server/utils/publicRegistrations.ts` :
  - recherche par le hash du jeton ; un jeton mal formé ne touche pas la base ;
  - une même réponse 404 pour un lien inconnu, invalidé, supprimé ou expiré ;
  - droits du lien (`registrationPermissions`) ;
  - données exposées : celles de la personne et du jeu seulement ; une inscription désistée n'expose que le titre du jeu ;
  - acceptation dans une transaction, avec revérification du statut et création du `SessionParticipant` (ADR-0021) ;
  - en-têtes `Cache-Control: no-store`, `Referrer-Policy: no-referrer`, `X-Robots-Tag: noindex`, et limite de débit par IP (60 lectures et 20 écritures par 10 minutes).
- Routes : `GET` et `PUT /api/public/registrations/:token`, `POST /api/public/registrations/:token/decline`. Le `PUT` valide avec `registrationAnswerSchema` construit sur la version remplie (ou en vigueur pour une première réponse).
- Page `pages/inscription/[token].vue` : chargée dans le navigateur avec `$fetch`, hors du cache hors ligne. Mêmes en-têtes posés par `routeRules` dans `nuxt.config.ts`, et `<meta name="referrer" content="no-referrer">`.
- `app.vue` rend `/inscription/*` hors du cadre de l'application.

## Tests réalisés

- Unitaires : `tests/utils/registrations.test.ts` (délai dépassé, expiration, découpage du nom), `tests/server/publicRegistrations.test.ts` (droits du lien, jeton mal formé, hash, expiration, email de confirmation).
- Intégration (`tests/integration/publicRegistrations.test.ts`) :
  - consultation (jeu, session, lieu, note, préremplissage, en-têtes), sans données des autres inscrits ;
  - acceptation : statut, `SessionParticipant`, version 1 figée, consentement santé, fiche inchangée, email de confirmation avec le même lien ;
  - formulaire incomplet et consentement santé manquant refusés ;
  - acceptation après l'échéance et après la clôture ;
  - modification avec la version remplie, refusée après la clôture ;
  - refus : statut désisté, pas de participation de session, lien qui ne permet plus rien ;
  - même 404 pour les liens inconnus, invalidés, supprimés ou expirés ; limite de débit par IP.
- Bout en bout (`tests/e2e/registration.spec.ts`) : l'organisatrice invite depuis la page Inscriptions, la personne ouvre le lien reçu par email dans un navigateur vierge, remplit et accepte, puis apparaît dans la session et comme confirmée.
