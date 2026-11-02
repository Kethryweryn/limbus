---
id: US-117
titre: Inscriptions : périodes, formulaire, sélection, liens personnels
statut: terminée
epic: EPIC-031
regles: []
adr: [ADR-0057]
---

# US-117 : Inscriptions : périodes, formulaire, sélection, liens personnels

En tant que développeuse, je veux que les écrans des inscriptions soient vérifiés.

## Critères d'acceptation

- [x] Pages et composants des inscriptions en TypeScript strict, couverts par la règle de lint : page Inscriptions, périodes, formulaire de période, éditeur du formulaire, invitations, sélection et tirage, détail d'une inscription, réponse par le lien personnel ou le compte, formulaire de diffusion (`/i/…`).
- [x] `RegistrationPeriodsPanel` découpé en sous-composants, sans changement de comportement : `RegistrationPeriodCard`, `RegistrationInvitationList`, `RegistrationExtensionModal`, état et actions partagés (`useRegistrationPeriodActions`). La sélection appelle ces actions directement au lieu de les remonter par des événements.
- [x] Code recopié mis en commun :
  - dates en toutes lettres (`utils/dates.ts`), aussi pour les emails, la présence, le legs et « Je participe » ;
  - statut affiché d'une inscription et décomptes d'une période (`utils/registrations.ts`) ;
  - réponses au formulaire, communes à la page du lien personnel ou du compte et au formulaire de diffusion (`RegistrationAnswerFields`), avec les champs demandés (`askedRegistrationInputs`) et les libellés des cases de fin, repris par l'aperçu de l'éditeur ;
  - appel direct des pages publiques (`publicFetch`) ;
  - types des réponses au formulaire, partagés entre le serveur et l'interface.
- [x] API :
  - `GET /api/registration-periods` rend toujours les inscriptions (seule la page Inscriptions la lit) ; `?include=registrations` n'existe plus ;
  - `GET /api/participants?gameId=` limite la liste à un jeu : l'invitation ne charge plus tous les participants ;
  - le journal des tirages et les réponses d'une inscription sont typés.
- [x] Changements visibles, voulus :
  - un formulaire d'inscription enregistré hors ligne affiche qu'il partira au retour du réseau, au lieu d'une erreur ;
  - un désistement sans date n'affiche plus le 1er janvier 1970.

## Tests

- `npm run typecheck`, `npm run lint`, `npm test` (dates, décomptes d'une période, actions du bloc d'un jeu).
- Intégration : isolation de `GET /api/participants?gameId=`.
- Parcours Playwright de la CI : inscription sur invitation, page publique.
