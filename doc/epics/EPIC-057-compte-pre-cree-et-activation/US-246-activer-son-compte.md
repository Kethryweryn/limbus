---
id: US-246
titre: Activer son compte
statut: à faire
epic: EPIC-057
regles: [R2, R9, R11]
adr: [ADR-0088, ADR-0089]
---

# US-246 : Activer son compte

En tant que participant dont une équipe a créé la fiche, je veux activer le compte de mon adresse, afin de retrouver mes sessions dans « Je participe » et de tenir moi-même mes coordonnées.

## Critères d'acceptation

- [ ] Étant donné la page « Activer mon compte », quand je donne mon adresse, alors la page répond la même chose que l'adresse ait un compte ou non. Ce qui part ensuite par email :
  - à un compte non activé, un lien d'activation valable 7 jours ;
  - à un compte activé, l'email « vous avez déjà un compte ».
- [ ] Étant donné le lien d'activation, quand je donne mon nom et mon mot de passe et que j'accepte les conditions, alors :
  - mon adresse est confirmée et je suis connecté ;
  - mon nom est recopié sur mes fiches ;
  - « Je participe » montre mes sessions de toutes les équipes.
- [ ] Étant donné un compte activé, alors son téléphone, son contact d'urgence et ses allergies sont vides, et les équipes gardent les leurs (US-245).
- [ ] Étant donné « Mot de passe oublié » sur un compte non activé, alors le lien envoyé est celui de l'activation.
- [ ] Étant donné l'inscription libre ouverte et une adresse au compte non activé, alors elle ne répond pas « adresse déjà utilisée ». Le lien de confirmation active le compte avec le nom et le mot de passe saisis.
- [ ] Étant donné une invitation à co-organiser vers une adresse au compte non activé, alors la page propose de créer le compte, et l'accepter active ce compte.
- [ ] Étant donné un lien d'activation expiré ou déjà utilisé, alors la page le dit et propose d'en demander un autre.

## Notes techniques

- Jeton `activate` (`server/utils/accounts.ts`).
- Routes publiques `auth/activation-request.post.ts` et `auth/activate.post.ts`, au débit limité comme `password-forgotten`.
- Pages `pages/acces/activer.vue` et `pages/acces/activer/[token].vue`.
- Email d'activation (`server/utils/email.ts`).
- À adapter :
  - `password-forgotten.post.ts` ;
  - `signup.post.ts` et `confirm.post.ts`, qui reprennent le nom saisi à l'inscription ;
  - `register.post.ts` et la lecture d'une invitation (`server/api/invitations/[token]`).
- Un lien vers « Activer mon compte » depuis l'écran de connexion.

## Tests

- Actions (`tests/e2e/access.spec.ts`) : activation par la page, par « Mot de passe oublié », par l'inscription libre et par une invitation à co-organiser, puis connexion et « Je participe ».
- Erreurs de saisie : nom vide, mot de passe trop court, conditions non acceptées, lien expiré ou déjà utilisé.
- Droits :
  - la page d'adresse répond pareil pour une adresse inconnue, un compte non activé et un compte activé ;
  - seul le lien reçu active le compte.
- Hors ligne : sans objet. Comme la connexion, l'activation se fait sans session ouverte et demande le réseau.

Intégration : jeton à usage unique, débit limité, recopie du nom à l'activation.
