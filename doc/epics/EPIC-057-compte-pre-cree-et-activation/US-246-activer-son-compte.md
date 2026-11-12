---
id: US-246
titre: Activer son compte
statut: terminée
epic: EPIC-057
regles: [R2, R9, R11]
adr: [ADR-0088, ADR-0089]
---

# US-246 : Activer son compte

En tant que participant dont une équipe a créé la fiche, je veux activer le compte de mon adresse, afin de retrouver mes sessions dans « Je participe » et de tenir moi-même mes coordonnées.

## Critères d'acceptation

- [x] Étant donné la page « Activer mon compte », quand je donne mon adresse, alors la page répond la même chose que l'adresse ait un compte ou non. Ce qui part ensuite par email :
  - à un compte non activé, un lien d'activation valable 7 jours ;
  - à un compte activé, l'email « vous avez déjà un compte ».
- [x] Étant donné le lien d'activation, quand je donne mon nom et mon mot de passe et que j'accepte les conditions, alors :
  - mon adresse est confirmée et je suis connecté ;
  - mon nom est recopié sur mes fiches ;
  - « Je participe » montre mes sessions de toutes les équipes.
- [x] Étant donné un compte activé, alors son téléphone, son contact d'urgence et ses allergies sont vides, et les équipes gardent les leurs (US-245).
- [x] Étant donné « Mot de passe oublié » sur un compte non activé, alors le lien envoyé est celui de l'activation.
- [x] Étant donné l'inscription libre ouverte et une adresse au compte non activé, alors elle ne répond pas « adresse déjà utilisée ». Le lien de confirmation active le compte avec le nom et le mot de passe saisis.
- [x] Étant donné une invitation à co-organiser vers une adresse au compte non activé, alors la page propose de créer le compte, et l'accepter active ce compte.
- [x] Étant donné un lien d'activation expiré ou déjà utilisé, alors la page le dit et propose d'en demander un autre.

## Notes techniques

- Jeton `activate` (`server/utils/accounts.ts`).
- Routes publiques `auth/activation-request.post.ts` et `auth/activate.post.ts`, au débit limité comme `password-forgotten`.
- Pages `pages/acces/activer.vue` et `pages/acces/activer/[token].vue`.
- Email d'activation (`server/utils/email.ts`).
- À adapter :
  - `password-forgotten.post.ts` ;
  - `signup.post.ts` et `confirm.post.ts` : le nom, le mot de passe et les conditions voyagent avec le jeton et ne s'appliquent qu'à la confirmation ;
  - `register.post.ts` et la lecture d'une invitation (`server/api/invitations/[token]`).
- Un lien vers « Activer mon compte » depuis l'écran de connexion.

## Tests

- Actions (`tests/e2e/access.spec.ts`, « activer mon compte ») : lien depuis l'écran de connexion, demande du lien, activation, arrivée dans « Je participe » avec le jeu de l'équipe.
- Invitation à co-organiser (`tests/e2e/accountScreens.spec.ts`, « active le compte pré-créé ») et « Mot de passe oublié » sur un compte pré-créé (`access.spec.ts`), ajoutés à la revue de la PR #243.
- Erreurs de saisie : mots de passe différents, conditions non acceptées (même test) ; nom vide, mot de passe trop court, lien expiré (`tests/integration/activation.test.ts`) ; rien n'est activé.
- Droits : la page répond pareil pour une adresse inconnue (même test e2e, aucun email) ; un compte activé reçoit « vous avez déjà un compte », un compte non activé le lien (intégration) ; le lien ne sert qu'une fois, la page le dit et propose d'en demander un autre.
- Hors ligne : sans objet. Comme la connexion, l'activation se fait sans session ouverte et demande le réseau.

Intégration (`activation.test.ts`) : nom recopié et téléphone de l'équipe gardé, « Mot de passe oublié », inscription libre qui n'écrit rien avant la confirmation, invitation à co-organiser qui active le compte et pose un cookie valable.
