---
id: US-019
titre: Choisir si une session est visible sur la page publique
statut: à faire
epic: EPIC-004
regles: [R1]
adr: []
---

# US-019 : Choisir si une session est visible sur la page publique

En tant qu'organisatrice, je veux choisir quelles sessions pourront apparaître sur la page publique du jeu, afin de n'annoncer que les dates prêtes.

## Critères d'acceptation

- [ ] Le champ `published` d'une session devient « Visible sur la page publique », une case du formulaire de session.
- [ ] Une nouvelle session n'est pas visible par défaut. Les sessions existantes passent à « non visible », pour que rien ne devienne public sans qu'on le décide.
- [ ] La page publique n'affiche pas encore les sessions ([SPEC-009](../../specs/SPEC-009-page-publique.md), écart 3) : le réglage servira quand elle les montrera.
- [ ] Le badge « Visible sur la page publique » apparaît sur la session quand la case est cochée.

## Notes techniques

- `Session.published` : valeur par défaut à `false` et mise à jour des lignes existantes, dans une migration compatible (pas de suppression ni de changement de type).
- `sessionSchema`, routes de création et de modification, `SessionForm.vue`, page de la session.

## Tests

- Intégration : une session créée sans le champ n'est pas visible ; cocher puis décocher la case est enregistré.
