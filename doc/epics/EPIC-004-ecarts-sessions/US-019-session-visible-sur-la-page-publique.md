---
id: US-019
titre: Choisir si une session est visible sur la page publique
statut: terminée
epic: EPIC-004
regles: [R1]
adr: []
---

# US-019 : Choisir si une session est visible sur la page publique

En tant qu'organisatrice, je veux choisir quelles sessions pourront apparaître sur la page publique du jeu, afin de n'annoncer que les dates prêtes.

## Critères d'acceptation

- [x] Le champ `published` d'une session devient « Visible sur la page publique », une case du formulaire de session.
- [x] Une nouvelle session n'est pas visible par défaut. Les sessions existantes passent à « non visible », pour que rien ne devienne public sans qu'on le décide.
- [x] La page publique n'affiche pas encore les sessions ([SPEC-009](../../specs/SPEC-009-page-publique.md), écart 3) : le réglage servira quand elle les montrera.
- [x] Le badge « Visible sur la page publique » apparaît sur la session (liste et page) quand la case est cochée. Une modification qui ne porte pas le champ ne change pas la visibilité.

## Notes techniques

- `Session.published` : valeur par défaut à `false` et mise à jour des lignes existantes, dans une migration compatible (pas de suppression ni de changement de type).
- `sessionSchema`, routes de création et de modification, `SessionForm.vue`, page de la session.

## Tests

- Intégration (`sessionLifecycle.test.ts`) : une session créée sans le champ n'est pas visible ; la case est enregistrée ; une modification sans le champ ne change pas la visibilité.
