---
id: ADR-0079
titre: Tout développement ajoute ses tests de bout en bout sur quatre axes
statut: accepté
date: 2026-11-10
liens: [../archive/todo/tests-par-ecran.md, ../epics/EPIC-050-tests-par-ecran/README.md, ADR-0067-tests-lies-avant-chaque-push.md]
---

# ADR-0079 : Tout développement ajoute ses tests de bout en bout sur quatre axes

## Contexte

En déroulant son cahier de tests, l'utilisatrice a constaté que les écrans écrits avant la reprise n'avaient qu'un ou deux tests chacun. L'EPIC-050 rattrape ce retard, écran par écran, sur quatre axes qu'elle a choisis le 2026-11-09 : les actions, les erreurs de saisie, les droits et le hors ligne. Les trois premiers lots ont trouvé à chaque fois des défauts que personne n'avait vus (bouton grisé sans explication, option « Aucun » impossible à choisir, refus en anglais, fiches illisibles hors ligne…). Rien n'empêchait jusqu'ici un nouvel écran de naître avec aussi peu de tests : ADR-0067 demande que les tests liés au changement passent, pas qu'ils existent.

## Décision

- Toute PR qui ajoute ou change ce qu'une personne voit ou peut faire (un écran, une action, une route appelée par un écran) ajoute ses tests de bout en bout (Playwright) sur les quatre axes :
  - **actions** : chaque bouton, filtre, recherche, lien, onglet et changement de page ajouté ou changé ;
  - **erreurs de saisie** : chaque champ obligatoire ou valeur refusée, avec le message attendu, et rien d'enregistré ;
  - **droits** : la co-organisatrice, une organisatrice sans accès, une participante, selon ce que l'écran permet ;
  - **hors ligne** : l'écran se relit sans réseau, et une modification part au retour du réseau, si l'écran est consultable hors ligne (SPEC-010).
- Les tests portent sur ce que la PR ajoute ou change, pas sur tout l'écran : un écran ancien pas encore couvert par l'EPIC-050 reçoit les tests de la partie touchée, le reste attend son lot.
- Un axe qui ne s'applique pas est écrit dans l'US, avec sa raison (par exemple « page publique : pas de droits », « action d'envoi : refusée hors ligne ») ; un correctif sans US l'écrit dans la description de sa PR.
- La section « Tests » de l'US liste les quatre axes et les tests qui les couvrent ; le modèle d'US (`doc/modeles/us.md`) les propose.
- La revue de code le vérifie, comme les notes de nouveautés : un axe sans test ni raison est un constat.
- Les tests d'intégration et unitaires restent demandés là où ils s'appliquent (`isolation.test.ts` pour toute route liée à un jeu, utilitaires) : cette règle s'y ajoute.

## Conséquences

- Un nouvel écran arrive avec ses tests, et ne rejoint pas la dette que l'EPIC-050 rattrape.
- Les PR sont plus longues à écrire, et la suite Playwright de la CI s'allonge à chaque écran.
- Écrire les tests sur les quatre axes fait trouver les défauts avant la mise en production plutôt qu'au cahier de tests.

## Options écartées

- **Au cas par cas** : c'est ce qui a laissé les écrans anciens sans tests.
- **Tests d'intégration seuls** : ils vérifient les routes, pas l'écran qui les appelle ; les défauts trouvés par l'EPIC-050 étaient presque tous dans l'écran.
