---
id: US-092
titre: Mode de sélection, mode mixte et réglages du tirage
statut: terminée
epic: EPIC-022
regles: [R4, R17, R19]
adr: [ADR-0048]
---

# US-092 : Mode de sélection, mode mixte et réglages du tirage

En tant qu'organisatrice, je veux choisir comment une période sélectionne (à la main, au hasard ou mixte) et régler le tirage.

## Critères d'acceptation

- [x] Une période ordinaire en mode formulaire a un mode de sélection : choix, hasard ou mixte.
- [x] En mode mixte, la période fixe le nombre de places que chaque organisatrice retient elle-même par session ; au-delà, retenir à la main est refusé avant le tirage.
- [x] En mode hasard, retenir à la main est refusé avant le tirage.
- [x] La période active ou non les pondérations « non tirés avant » et « équilibre », et fixe la taille de la liste d'attente (5 par défaut).

## Notes techniques

- `RegistrationPeriod.organizerPicks`, `weightNotDrawnBefore`, `weightBalance`, `waitlistSize` ; `Registration.retainedById`.

## Tests

- Intégration : quota par organisatrice, refus en mode hasard, corrections libres après le tirage.
