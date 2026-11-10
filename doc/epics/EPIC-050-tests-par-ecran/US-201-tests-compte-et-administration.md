---
id: US-201
titre: Tester les écrans du compte, de l'accès et de l'administration
statut: terminée
epic: EPIC-050
regles: []
adr: []
---

# US-201 : Tester les écrans du compte, de l'accès et de l'administration

En tant qu'organisatrice, je veux que l'inscription libre, le compte, les invitations et l'administration aient des tests automatiques sur leurs actions, leurs erreurs de saisie, leurs droits et le hors ligne, afin qu'une régression s'y voie avant la mise en production.

## Critères d'acceptation

- [x] Chaque écran du lot a les tests listés dans la [fiche](../../archive/todo/tests-par-ecran.md), ou la raison de leur absence est notée ici.
- [x] Un défaut trouvé en écrivant un test est corrigé dans le lot, avec sa note de nouveautés : [US-213](US-213-refus-explique-acces-et-compte.md), [US-214](US-214-action-sans-reseau.md), [US-215](US-215-page-d-administration-refusee.md), [US-216](US-216-message-dans-la-carte.md).

## Notes techniques

Specs : SPEC-008, SPEC-011, SPEC-013. Tests Playwright dans `tests/e2e/`, selon `.claude/rules/tests.md`.

## Tests

`tests/e2e/accountScreens.spec.ts` :

- **Inscription libre** : champ manquant, mot de passe trop court, conditions non cochées (SPEC-008, R1) ; adresse d'un compte confirmé, même réponse et email « compte existant » ; champ piège rempli, ni compte ni email (SPEC-011, R6) ; hors ligne. L'inscription fermée était déjà testée (`access.spec.ts`). Droits : page publique, sans objet.
- **Mon compte** : nom et coordonnées recopiés sur la fiche ; chaque formulaire refusé avec son message, dans sa carte ; sans connexion, retour à l'écran de connexion ; hors ligne. « Déconnecter tous mes appareils » (R4) était déjà testé (`auth.spec.ts`).
- **Invitation à co-organiser** : invitation expirée, annulée ou inconnue (R11) ; compte d'une autre adresse refusé (R12) ; compte créé depuis le lien, mot de passe court refusé, puis adresse confirmée et jeu partagé ; propriétaire et co-organisatrice ne s'invitent pas (R10) ; invitation annulée dont le lien ne mène plus à rien. Hors ligne : action d'envoi, refusée sans réseau (US-214, testé sur le compte).
- **Administration** : création refusée (nom vide, adresse invalide ou prise) ; plafond de stockage, réactivation, suppression refusée tant que le compte possède un jeu, suppression ; ni désactivation ni suppression de son propre compte (R5) ; réglage SMTP refusé sans serveur et email de test sans destinataire ; mode administrateur activé puis désactivé (R7) ; organisatrice sans menu ni page d'administration (US-215). La création d'un compte avec son lien et la désactivation étaient déjà testées (`admin.spec.ts`). Hors ligne : pages d'administration, actions seulement, sans copie sur l'appareil.

`tests/e2e/helpers.ts` : `uniqueName` prend un suffixe aléatoire, car deux tests rejoués en parallèle (`--repeat-each`) prenaient le même nom à la même milliseconde. Temps ajouté à la suite : 17 tests, environ 40 secondes sur un navigateur.
