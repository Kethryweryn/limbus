---
id: US-174
titre: Lire le parcours complet d'une personne
statut: terminée
epic: EPIC-048
regles: [R17, R18, R30]
adr: [../../../adr/ADR-0069-vivier-unique-et-statut-par-session.md]
---

# US-174 : Lire le parcours complet d'une personne

En tant que organisatrice ou personne du vivier, je veux voir les statuts d'intéressée à inscrite validée, afin de savoir où en est chaque personne.

## Critères d'acceptation

- [x] Étant donné une inscrite avec un premier versement reçu, alors elle est inscrite validée, y compris pour un paiement en plusieurs fois.
- [x] Étant donné une session en mode simple, quand la case « payé » est cochée, alors elle est inscrite validée.
- [x] Étant donné une place offerte, ou aucun tarif pour elle dans une session à tarifs, alors elle est inscrite validée dès sa confirmation.
- [x] Étant donné une session reportée, alors l'ancienne montre « transférée », et le paiement reporté la valide sur la nouvelle.
- [x] Étant donné le seul versement retiré, alors elle redevient inscrite.
- [x] Étant donné la page Inscriptions et « Je participe », alors les libellés du parcours y sont les mêmes.

## Notes techniques

Calcul à la lecture : `isPlaceValidated` (`utils/sessionTariffs.ts`), avec `tariffForPerson` et `tariffRolesOf`, comme le tableau des paiements ; `validatedPlaces` lit une série de places. « Inscrite validée » n'est pas un statut enregistré : la ligne reste `confirmed`, avec `validated`. Libellé dans `REGISTRATION_SESSION_STATUS_META`.

## Tests

Unitaire : `tests/utils/placeValidated.test.ts`. Intégration : `tests/integration/publicRegistrations.test.ts`, `seed.test.ts`. Playwright : `tests/e2e/registration.spec.ts`.
