---
id: US-174
titre: Lire le parcours complet d'une personne
statut: à faire
epic: EPIC-048
regles: [R17, R18]
adr: [../../adr/ADR-0069-vivier-unique-et-statut-par-session.md]
---

# US-174 : Lire le parcours complet d'une personne

En tant que organisatrice ou personne du vivier, je veux voir les statuts d'intéressée à inscrite validée, afin de savoir où en est chaque personne.

## Critères d'acceptation

- [ ] Étant donné une inscrite avec un premier versement reçu, alors elle est inscrite validée, y compris pour un paiement en plusieurs fois.
- [ ] Étant donné une place offerte ou une session sans tarif, alors elle est inscrite validée dès sa confirmation.
- [ ] Étant donné le seul versement retiré, alors elle redevient inscrite.
- [ ] Étant donné la page Inscriptions et « Je participe », alors les libellés du parcours y sont les mêmes.

## Notes techniques

Calcul à la lecture à partir de `SessionPayment` et des tarifs, avec un utilitaire commun. `REGISTRATION_STATUS_META` dans `utils/domain.ts`.

## Tests

Unitaire : calcul du statut. Intégration : paiements. Playwright : page Inscriptions et espace participant.
