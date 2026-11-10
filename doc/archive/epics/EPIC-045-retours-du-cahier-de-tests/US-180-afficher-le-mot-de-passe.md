---
id: US-180
titre: Afficher le mot de passe pendant la saisie
statut: terminée
epic: EPIC-045
regles: []
adr: []
---

# US-180 : Afficher le mot de passe pendant la saisie

En tant que personne qui tape un mot de passe, je veux pouvoir l'afficher, afin de vérifier ce que j'ai écrit (test A6 du cahier, retour A6-1).

## Critères d'acceptation

- [x] Étant donné un champ de mot de passe, alors un bouton en forme d'œil l'affiche en clair, puis le masque de nouveau.
- [x] Le bouton est sur tous les champs de mot de passe : connexion, inscription libre, nouveau mot de passe, Mon compte, invitation à une équipe, réglages d'envoi des emails.
- [x] Le champ revient masqué quand on recharge la page.

## Notes techniques

`components/PasswordInput.vue`, utilisé à la place de chaque `UInput type="password"`.

## Tests

`tests/e2e/auth.spec.ts`, et les parcours qui remplissent un mot de passe (`access.spec.ts`, `account.spec.ts`, `accountData.spec.ts`, `admin.spec.ts`, `writing.spec.ts`).
