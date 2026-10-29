---
id: US-033
titre: Places solidaires : soutien et réductions
statut: à faire
epic: EPIC-006
regles: [R15]
adr: [ADR-0032]
---

# US-033 : Places solidaires : soutien et réductions

En tant qu'organisatrice, je veux proposer des tarifs de soutien qui financent des places réduites, et voir si les réductions attribuées sont couvertes.

## Critères d'acceptation

- [ ] Un tarif peut désigner un tarif de base : il est de soutien s'il est plus cher, réduit s'il est moins cher.
- [ ] Le tableau affiche l'apport des soutiens (attribué et encaissé), le coût des réductions attribuées et le solde, attribué et encaissé.
- [ ] Les réductions restent attribuées à la main par l'organisatrice ; Limbus ne bloque rien.

## Notes techniques

- Calcul dans `server/utils/sessionPayments.ts` à partir des tarifs et des versements.

## Tests

- Unitaires (`tests/server/sessionTariffs.test.ts`) : apport, coût et soldes, avec un soutien payé en partie.
