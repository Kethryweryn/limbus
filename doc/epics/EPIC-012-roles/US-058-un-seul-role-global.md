---
id: US-058
titre: Un seul rôle global : administrateur ou non
statut: terminée
epic: EPIC-012
regles: [R1, R17]
adr: [ADR-0038]
---

# US-058 : Un seul rôle global : administrateur ou non

En tant qu'utilisatrice de Limbus, je veux que mon compte me permette d'organiser mes jeux sans rôle « organisateur » à part, l'administration restant le seul rôle global.

## Critères d'acceptation

- [x] Toute route de l'API demande un compte connecté (`requireUser`), quel que soit son rôle ; l'accès à chaque jeu reste vérifié comme avant.
- [x] L'administration des comptes propose « Administratrice » oui ou non, et plus le rôle « Organisateur ».
- [x] Les nouveaux comptes ont le rôle de compte simple ; les comptes « organisateur » existants gardent les mêmes droits.

## Notes techniques

- `requireOrganizer` devient `requireUser` ; `USER_ROLES.user` remplace `USER_ROLES.organizer`, la valeur ancienne restant acceptée jusqu'à la migration des données ([ADR-0038](../../adr/ADR-0038-un-seul-role-global.md)).

## Tests

- Unitaires (`tests/server/auth.test.ts`) : un compte ancien « organisateur » et un compte simple passent `requireUser`.
- Intégration : l'isolation entre jeux est inchangée (`isolation.test.ts`).
