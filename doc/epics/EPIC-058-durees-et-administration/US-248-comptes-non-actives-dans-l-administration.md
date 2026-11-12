---
id: US-248
titre: Les comptes non activés dans l'administration
statut: terminée
epic: EPIC-058
regles: []
adr: [ADR-0088]
---

# US-248 : Les comptes non activés dans l'administration

En tant qu'administratrice, je veux que la liste des comptes ne montre par défaut que les comptes activés, afin de ne pas confondre une personne inscrite à un jeu avec une utilisatrice de Limbus.

## Critères d'acceptation

- [x] Étant donné la liste des comptes, alors elle ne montre que les comptes activés, et une case « Afficher les comptes non activés (N) » montre les autres.
- [x] Étant donné un compte non activé affiché (pré-créé pour une fiche, ou inscription jamais confirmée), alors :
  - il porte la mention « Non activé », à la place du badge « Adresse non confirmée » ;
  - sa carte est en lecture seule : ni enregistrement, ni lien de mot de passe, ni désactivation, ni suppression (choix de l'utilisatrice, 2026-11-12).
- [x] Le serveur ne renvoie les comptes non activés que si la case est cochée (`?inactifs=1`), et leur nombre sinon : la page ne charge pas des milliers de comptes masqués (revue de la PR #248).
- [x] Le serveur refuse ces actions sur tout compte non activé, comme il les refuse déjà pour un compte pré-créé qui porte des fiches (US-244).
- [x] L'administratrice reprend toujours un compte non activé en le créant à son adresse (US-244).

## Notes techniques

`pages/admin/users.vue` (case, mention, carte en lecture seule) ; `assertActivatedForAdmin` (`server/utils/participantAccounts.ts`), appelée par `server/api/admin/users/[id].put.ts`, `[id].delete.ts` et `[id]/password-link.post.ts`.

## Tests

- Actions (`tests/e2e/admin.spec.ts`, « les comptes non activés sont masqués ») : masqué par défaut, la case le montre avec sa mention, sans champ ni bouton ; le créer à son adresse le reprend.
- Erreurs de saisie : sans objet, la carte d'un compte non activé n'a plus de champ.
- Droits : les trois routes refusent un compte pré-créé comme une inscription jamais confirmée (`preCreatedAccounts.test.ts`) ; seule l'administratrice atteint la liste (déjà couvert).
- Hors ligne : sans objet, l'administration ne se consulte pas hors ligne.
