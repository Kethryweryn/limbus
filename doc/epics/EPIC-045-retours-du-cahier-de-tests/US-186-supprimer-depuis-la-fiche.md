---
id: US-186
titre: Supprimer un élément depuis sa fiche
statut: terminée
epic: EPIC-045
regles: [R14b]
adr: []
---

# US-186 : Supprimer un élément depuis sa fiche

En tant qu'organisatrice, je veux supprimer un personnage, un groupe, une intrigue ou un objet depuis sa fiche, afin de ne pas devoir revenir à la liste (retour B1-1 du cahier).

## Critères d'acceptation

- [x] Étant donné la fiche d'un personnage, d'un groupe, d'une intrigue, d'un objet, d'un lieu, d'un document ou d'un événement, alors un bouton « Supprimer » s'y trouve, en lecture comme en modification.
- [x] La suppression demande la même confirmation que depuis la liste ; refuser ne supprime rien.
- [x] Une fois supprimé, l'élément disparaît et la liste s'ouvre (pour un document ou un événement ouvert depuis une session, la page d'où l'on vient).
- [x] Les droits sont ceux de la liste : le serveur refuse une suppression à qui n'a pas accès au jeu, et l'erreur s'affiche sous le bouton.

## Notes techniques

`components/SheetDeleteButton.vue`, `utils/deleteConfirmations.ts`, les sept pages `pages/*/[slug].vue`. [SPEC-003](../../specs/SPEC-003-ecriture-d-un-jeu.md), R14b. Choix de l'utilisatrice le 2026-11-08 : toutes les fiches d'écriture, pas seulement les quatre citées.

## Tests

`tests/e2e/writing.spec.ts`.
