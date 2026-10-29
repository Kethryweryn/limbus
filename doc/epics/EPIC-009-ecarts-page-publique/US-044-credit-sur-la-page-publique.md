---
id: US-044
titre: Le crédit d'une copie sur la page publique
statut: terminée
epic: EPIC-009
regles: [R2, R8]
adr: []
---

# US-044 : Le crédit d'une copie sur la page publique

En tant qu'autrice d'un jeu légué, je veux que la page publique d'une copie me crédite, comme sa fiche.

## Critères d'acceptation

- [x] La page publique d'une copie affiche son crédit, avec le même texte que sa fiche ([SPEC-002](../../specs/SPEC-002-copie-de-jeu.md), R11).
- [x] La route publique renvoie le titre du jeu d'origine et le nom de son autrice, rien de plus sur la copie.

## Notes techniques

- `server/api/public/games/[slug].get.ts` ; l'affichage existe déjà dans `GamePageContent.vue`.

## Tests

- Intégration (`publicPage.test.ts`) : crédit renvoyé pour une copie, absent pour un jeu original.
