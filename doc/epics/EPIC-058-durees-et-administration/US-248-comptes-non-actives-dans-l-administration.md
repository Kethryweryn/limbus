---
id: US-248
titre: Les comptes non activés dans l'administration
statut: à faire
epic: EPIC-058
regles: []
adr: [ADR-0088]
---

# US-248 : Les comptes non activés dans l'administration

En tant qu'administratrice, je veux que la liste des comptes ne montre par défaut que les comptes activés, afin de ne pas confondre une personne inscrite à un jeu avec une utilisatrice de Limbus.

## Critères d'acceptation

- [ ] Étant donné la liste des comptes, alors elle ne montre que les comptes activés, et une case « Afficher les comptes non activés (N) » montre les autres.
- [ ] Étant donné un compte non activé affiché (pré-créé pour une fiche, ou inscription jamais confirmée), alors :
  - il porte la mention « Non activé », à la place du badge « Adresse non confirmée » ;
  - sa carte est en lecture seule : ni enregistrement, ni lien de mot de passe, ni désactivation, ni suppression (choix de l'utilisatrice, 2026-11-12).
- [ ] Le serveur refuse ces actions sur tout compte non activé, comme il les refuse déjà pour un compte pré-créé qui porte des fiches (US-244).
- [ ] L'administratrice reprend toujours un compte non activé en le créant à son adresse (US-244).

## Notes techniques

`pages/admin/users.vue`, `server/api/admin/users/[id].put.ts`, `[id].delete.ts`, `[id]/password-link.post.ts`.

## Tests

- Actions (`tests/e2e/admin.spec.ts`) : la case montre les comptes non activés, avec leur mention et une carte sans boutons.
- Erreurs de saisie : sans objet, la carte d'un compte non activé n'a plus de champ modifiable.
- Droits :
  - seule l'administratrice atteint la liste (déjà couvert) ;
  - les routes refusent les actions sur un compte non activé (`preCreatedAccounts.test.ts`).
- Hors ligne : sans objet, l'administration ne se consulte pas hors ligne.
