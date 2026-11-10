---
id: US-209
titre: Ouvrir une session d'un clic sur sa carte, et la supprimer depuis sa fiche
statut: terminée
epic: EPIC-050
regles: [R3]
adr: []
---

# US-209 : Ouvrir une session d'un clic sur sa carte, et la supprimer depuis sa fiche

En tant qu'organisatrice, je veux que la liste des sessions se comporte comme les autres listes, afin d'ouvrir une session d'un clic et de la supprimer depuis sa fiche (écarts trouvés en écrivant les tests de l'US-199).

## Critères d'acceptation

- [x] Étant donné la liste des sessions, quand je clique sur une carte, hors de ses boutons, alors la session s'ouvre ; ses raccourcis d'onglet, « Modifier » et « Supprimer » gardent leur action sans ouvrir la session.
- [x] Le bouton qui ouvre le formulaire depuis la carte s'appelle « Modifier », et non plus « Organisation ».
- [x] La fiche d'une session propose « Supprimer », avec la même confirmation que la liste ; une session qui a un paiement reçu ou une inscription est refusée avec le même message (R3), sinon l'écran revient à la liste.

## Notes techniques

Choix de l'utilisatrice le 2026-11-09. `components/SessionCard.vue` passe par `ContentCard` (US-197), `pages/sessions/[slug].vue` par `SheetDeleteButton` (US-186) ; la confirmation est `DELETE_CONFIRMATIONS.session`, commune à la liste et à la fiche.

## Tests

`tests/e2e/sessionScreens.spec.ts` : carte, « Modifier », suppression refusée puis faite depuis la fiche.
