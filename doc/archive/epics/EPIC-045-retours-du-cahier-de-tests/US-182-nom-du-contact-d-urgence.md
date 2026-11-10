---
id: US-182
titre: Lire le nom du contact d'urgence sur la fiche
statut: terminée
epic: EPIC-045
regles: [R1b]
adr: []
---

# US-182 : Lire le nom du contact d'urgence sur la fiche

En tant qu'organisatrice, je veux lire le nom du contact d'urgence à part de son téléphone, afin de savoir qui appeler (retour A5-2 du cahier, après US-178).

## Critères d'acceptation

- [x] Étant donné la fiche d'une personne, alors le contact d'urgence tient sur deux lignes nommées, « nom » et « téléphone », chacune avec « Non renseigné » si elle est vide.
- [x] Étant donné les jeux de test, alors chaque contact d'urgence de Meridian a un nom de personne (« Proche de … »), et plus le mot « Contact d'urgence », qui se confondait avec le libellé.

## Notes techniques

`pages/participants/[slug].vue`, `prisma/seed/meridian.ts`. Hypothèse, non vérifiée en production : la fiche regardée était celle d'une personne de Meridian, dont le contact s'appelait « Contact d'urgence ».

## Tests

`tests/e2e/participants.spec.ts`, `tests/integration/seed.test.ts`.
