---
id: US-213
titre: Lire la raison d'un refus dans les formulaires de l'accès, du compte et de l'administration
statut: à faire
epic: EPIC-050
regles: []
adr: []
---

# US-213 : Lire la raison d'un refus dans les formulaires de l'accès, du compte et de l'administration

En tant que personne qui crée son compte, gère son compte ou administre Limbus, je veux que le formulaire me dise ce qui manque ou ce qui est refusé, afin de savoir quoi corriger (défaut trouvé en écrivant les tests de l'US-201 : la bulle du navigateur bloquait l'envoi, et le refus du serveur s'affichait « Requête invalide »).

## Critères d'acceptation

- [ ] Étant donné l'inscription libre, le mot de passe oublié, le nouveau mot de passe, « Mon compte », l'invitation à co-organiser, la création d'un compte et l'email de test de l'administration, quand un champ obligatoire est vide ou un mot de passe trop court, alors le message de Limbus s'affiche (« Le nom est obligatoire », « Le mot de passe doit faire au moins 8 caractères »…), et non la bulle du navigateur, sans rien enregistrer.
- [ ] Le refus d'une validation par le serveur affiche son détail, et non « Requête invalide ».
- [ ] Dans la fenêtre de partage d'un jeu, « Inviter » reste actif quand l'adresse est vide ; un clic affiche « L’email est obligatoire ».

## Notes techniques

Suite du choix « un message partout » de l'utilisatrice ([US-204](US-204-champ-obligatoire-explique.md)). Les attributs `required` et `minlength` sont retirés de `pages/acces/*`, `pages/compte.vue`, `pages/invitations/[token].vue`, `pages/admin/users.vue`, `pages/admin/smtp.vue` et `components/GameShareModal.vue` ; un formulaire qui garde un champ `type="email"` (clavier adapté sur téléphone) prend `novalidate`. Ces pages affichent `apiErrorMessage` au lieu de `serverMessage`, qui ne lisait pas le détail de la validation.

## Tests

`tests/e2e/accountScreens.spec.ts` : inscription (nom vide, mot de passe court, conditions non cochées), compte (nom vide, mot de passe court, allergies sans consentement, mauvais mot de passe), invitation (mot de passe court), administration (nom vide, adresse invalide, email de test vide), partage (adresse vide).
