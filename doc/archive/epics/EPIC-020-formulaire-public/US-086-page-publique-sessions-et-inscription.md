---
id: US-086
titre: Sessions à venir et lien d'inscription sur la page publique
statut: terminée
epic: EPIC-020
regles: [SPEC-009 R1, R2, R8]
adr: [ADR-0046]
---

# US-086 : Sessions à venir et lien d'inscription sur la page publique

En tant qu'organisatrice, je veux choisir si la page publique de mon jeu montre ses prochaines sessions et le lien d'inscription, afin qu'elle serve d'annonce complète.

## Critères d'acceptation

- [x] La fiche du jeu a deux cases, décochées par défaut : « Afficher les sessions à venir » et « Afficher le lien d'inscription ».
- [x] Cochée, la première montre les sessions à venir marquées visibles sur la page publique, avec leur date et leur lieu.
- [x] Cochée, la seconde montre un bouton vers le formulaire de chaque période ouverte en mode formulaire.
- [x] Rien d'autre ne sort : ni participants, ni écriture, ni sessions non visibles.

## Notes techniques

- `Game.publicShowSessions`, `Game.publicShowRegistration` ; SPEC-009 (écart 3).

## Tests

- Intégration : rien par défaut, sessions visibles seulement, lien des seules périodes ouvertes en mode formulaire.
