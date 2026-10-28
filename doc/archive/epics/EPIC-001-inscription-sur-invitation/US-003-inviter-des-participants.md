---
id: US-003
titre: Inviter des participants
statut: terminée
epic: EPIC-001
regles: [R12, R13, R16, R20]
adr: [ADR-0018, ADR-0019, ADR-0020]
---

# US-003 : Inviter des participants

En tant qu'organisatrice, je veux inviter des personnes à une session de ma période d'inscription, afin qu'elles confirment leur venue et me donnent leurs informations.

## Critères d'acceptation

- [x] Depuis une période d'inscription ouverte, j'invite pour une de ses sessions :
  - des participants existants du jeu (sélection multiple) ;
  - ou une nouvelle personne (nom et email).
- [x] Pour une nouvelle personne, l'email est rapproché, sans tenir compte de la casse, des participants liés aux jeux de la même propriétaire. S'il y en a un, il est réutilisé et lié au jeu ; sinon, un participant est créé et lié au jeu (R12).
- [x] Une même personne ne peut avoir qu'une inscription par période d'inscription : une seconde invitation est refusée avec un message.
- [x] Une personne sans email ne peut pas être invitée ; l'interface l'indique.
- [x] Chaque invitation crée une inscription au statut `invitée`, avec l'organisateur invitant, l'échéance de réponse (aujourd'hui + délai de la période d'inscription) et un lien personnel (R16, R20).
- [x] Un email part à chaque personne invitée. Il contient le nom du jeu, la session et sa date, l'échéance et le lien personnel (`absoluteAppUrl`).
- [x] Un envoi groupé utilise le verrou d'envoi de session (pas de double envoi sur double clic), et un échec SMTP est signalé sans bloquer les autres envois.
- [x] Je peux renvoyer l'invitation : l'ancien lien est alors invalidé.
- [x] Je peux annuler une invitation sans réponse : son lien est invalidé et l'inscription supprimée.
- [x] Le nombre d'invitations est affiché face au nombre de places de la session ; dépasser les places est permis, avec un avertissement.

Reprises d'US-001 : la liste montre les inscriptions de chaque session, et une période qui a des inscriptions ne peut plus être supprimée (il faut la clôturer). Le nombre par statut viendra avec US-005.

Précisions apportées pendant la réalisation :

- Un échec d'envoi n'annule pas l'invitation : elle est créée, marquée « email non envoyé », et « Renvoyer » la repartira.
- Renvoyer ne change pas l'échéance : la prolonger reste une action à part (US-005). L'email part à l'adresse actuelle de la fiche du participant, pour qu'une adresse corrigée soit prise en compte.
- Une session qui a des inscriptions ne peut pas être retirée de sa période.
- Le lien personnel mène à `/inscription/<jeton>`, page qui arrive avec US-004 : d'ici là, il aboutit à une page introuvable.

Après la revue de code du 2026-10-28 :

- Une personne qui a décliné ou s'est désistée peut être réinvitée : son inscription repart au statut `invitée`, avec un nouveau lien, une nouvelle échéance et sans adhésion ni consentement ; ses réponses précédentes préremplissent le formulaire.
- Deux fiches sélectionnées avec la même adresse email sont refusées (une seule doit être invitée).
- Le renvoi part à l'adresse de l'inscription, celle que la personne a donnée (R12).
- Les emails d'un envoi groupé partent sur une seule connexion SMTP, avec des délais bornés.
- Une session dont toutes les inscriptions sont déclinées ou désistées peut être retirée de sa période.

## Notes techniques

- Modèle : `Registration` ([ADR-0019](../../../adr/ADR-0019-modele-des-inscriptions.md)) ; jeton selon [ADR-0018](../../../adr/ADR-0018-jetons-des-liens-personnels.md).
- Routes : `POST /api/registration-periods/:id/invitations`, `POST /api/registrations/:id/resend`, `DELETE /api/registrations/:id`.
- Le rapprochement par email est une fonction serveur testée à part, réutilisée par le formulaire public (EPIC-002).

## Réalisation

- Migration `20261028140000_add_registrations` : table `Registration` complète selon ADR-0019 (les colonnes des réponses seront remplies par US-004), plus `invitationSentAt`. Unicité (période, participant) et du hash du jeton.
- Constantes `REGISTRATION_STATUSES`, `REGISTRATION_STATUS_META` et `REGISTRATION_SOURCES` dans `utils/domain.ts` (seuls les statuts du mode invitation pour l'instant).
- `server/utils/registrations.ts` :
  - jeton de 32 octets en base64url, seul son SHA-256 est stocké ;
  - `participantEmailMatchWhere` / `findParticipantByEmail` : rapprochement par email (R12) ;
  - `inviteToRegistrationPeriod` : contrôles (période ouverte, session de la période, participants du jeu avec email, doublons), création des inscriptions dans une transaction, puis envoi des emails un par un ;
  - `resendRegistrationInvitation` : nouveau jeton, puis email.
- Routes :
  - `POST /api/registration-periods/:id/invitations`, sous le verrou d'envoi de la session et une limite de débit ;
  - `GET /api/registration-periods/:id/registrations` : liste sans les réponses ni le hash, que US-005 enrichira ;
  - `POST /api/registrations/:id/resend` et `DELETE /api/registrations/:id`, réservés aux invitations sans réponse.
- `DELETE /api/registration-periods/:id` refuse une période qui a des inscriptions ; `PUT` refuse de retirer une session qui en a.
- RGPD : `exportParticipantData` exporte les inscriptions (limitées aux jeux de l'organisatrice) ; `eraseParticipant` les efface par cascade.
- Écrans : dans `RegistrationPeriodsPanel`, chaque session de la période montre ses invitations face aux places, avec « Renvoyer » et « Annuler », et un bouton « Inviter » qui ouvre `RegistrationInviteForm` (participants du jeu cochables, personnes sans email ou déjà inscrites grisées, nouvelle personne, alerte de dépassement des places).

## Tests

- Unitaires (`tests/server/registrations.test.ts`) : jeton et hash, URL du lien, échéance, rapprochement par email (casse, autre propriétaire, jeu sans propriétaire), schéma de l'invitation, texte de l'email, doublon concurrent.
- Intégration (`tests/integration/registrations.test.ts`), avec un serveur SMTP de test (`tests/integration/smtp.ts`) qui reçoit les emails :
  - invitation d'un participant existant et d'une nouvelle personne, email reçu et hash du lien en base ;
  - rapprochement par email chez la même propriétaire, fiche distincte chez une autre équipe ;
  - doublon refusé, personne sans email refusée, période non ouverte, session hors période, participant d'un autre jeu ;
  - dépassement des places permis, échec SMTP signalé sans perdre l'invitation ;
  - renvoi qui invalide l'ancien lien sans changer l'échéance, annulation, refus sur une invitation qui a reçu une réponse ;
  - période avec inscriptions ni supprimable ni privée d'une session inscrite.
- `isolation.test.ts` : les quatre routes sur les données de Bob, et l'invitation dans une période d'Alice d'un participant ou d'une session de Bob, avec témoin.
- `privacy.test.ts` : export des inscriptions limité aux jeux de l'organisatrice, effacement avec le participant.
