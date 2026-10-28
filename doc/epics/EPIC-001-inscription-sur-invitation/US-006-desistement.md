---
id: US-006
titre: Désistement d'une personne confirmée
statut: terminée
epic: EPIC-001
regles: [R13, R16, R22]
adr: [ADR-0021]
---

# US-006 : Désistement d'une personne confirmée

En tant que personne confirmée, je veux pouvoir me désister par mon lien personnel, afin de libérer ma place sans devoir écrire aux orgas. En tant qu'organisatrice, je veux que ce désistement soit reflété partout.

## Critères d'acceptation

- [x] Sur la page de mon lien personnel, un bouton « Me désister » demande une confirmation, puis fait passer l'inscription à `désistée`. C'est possible même après la clôture (R13).
- [x] Le désistement, ou le retrait par une organisatrice (US-005) :
  - retire le `SessionParticipant` de la session ;
  - retire la personne du personnage éventuellement attribué dans cette session ; le personnage reste, sans joueur ;
  - laisse le paiement éventuel intact, à traiter à la main (R22).
- [x] La page du lien affiche ensuite « Vous vous êtes désisté·e », et le lien ne permet plus rien d'autre.
- [x] La liste des inscriptions montre le désistement, avec sa date et son auteur (la personne ou une organisatrice).
- [x] Les organisateurs du jeu reçoivent un email signalant le désistement.

Précisions apportées pendant la réalisation :

- Le désistement ne concerne qu'une inscription confirmée. Une invitation sans réponse se décline (US-004).
- La page distingue « Vous avez décliné l'invitation » et « Vous vous êtes désisté·e ».
- Quand la photo d'attribution retirée apparaissait dans des trombinoscopes de la session, ces trombinoscopes sont supprimés et seront à régénérer, comme pour l'effacement d'un participant.
- L'email part au propriétaire du jeu et à ses co-organisatrices. Un échec d'envoi n'annule pas le désistement.
- La liste distingue « invitation déclinée », « désistée par la personne » et « retirée par <organisatrice> ». Ce dernier cas est prévu pour US-005.

## Notes techniques

- Route : `POST /api/public/registrations/:token/withdraw`, avec limitation de débit. Le retrait par une organisatrice réutilise la même fonction serveur.
- Retirer le joueur d'un personnage efface aussi sa photo d'attribution, et le fichier si plus rien ne le référence ([ADR-0008](../../adr/ADR-0008-fichiers-televerses.md)).

## Tests

- Intégration : désistement après confirmation (`SessionParticipant` et attribution retirés, paiement conservé, photo nettoyée) ; désistement après la clôture accepté ; second désistement sans effet.

## Réalisation

- Migration `20261028160000_add_registration_withdrawn_by` : `Registration.withdrawnById`, l'organisatrice qui a retiré la personne. Il reste à null pour un refus ou un désistement par le lien.
- `withdrawRegistration` (`server/utils/registrations.ts`), partagée avec le retrait par une organisatrice (US-005). Dans une transaction, avec revérification du statut :
  - l'inscription passe à désistée ;
  - le `SessionParticipant` de rôle participant est supprimé ;
  - les attributions de la personne dans la session sont vidées (joueur et photo) ;
  - si une photo est retirée, les trombinoscopes de la session sont supprimés.

  Ensuite, `deleteUnusedUploads` efface les photos devenues inutiles, et les organisateurs sont prévenus par email.
- Route `POST /api/public/registrations/:token/withdraw`, avec la même protection que les autres routes du lien (débit, en-têtes). Le droit `canWithdraw` est ajouté à `registrationPermissions`.
- Page du lien : bloc « Me désister » avec confirmation, et message adapté une fois désisté·e.
- Liste des inscriptions : date et auteur du désistement.

## Tests réalisés

- Unitaires : droit de se désister (y compris après la clôture), texte de l'email aux organisateurs.
- Intégration (`tests/integration/publicRegistrations.test.ts`) :
  - le désistement après confirmation retire la participation, vide le personnage, efface la photo (fichier compris) et les trombinoscopes de la session ;
  - le paiement est conservé et l'organisatrice reçoit l'email ;
  - la liste montre le désistement, et le lien ne permet plus rien ;
  - le désistement est accepté après la clôture ;
  - il est refusé sur une invitation sans réponse.
- Écran vérifié en local : bloc « Me désister » sur une période clôturée, page « Vous vous êtes désisté·e », email reçu, ligne « désistée … par la personne » dans la page Inscriptions.
