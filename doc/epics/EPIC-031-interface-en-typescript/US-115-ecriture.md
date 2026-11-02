---
id: US-115
titre: Écriture du jeu : jeux, personnages, groupes, intrigues, objets, documents, lieux, timeline
statut: terminée
epic: EPIC-031
regles: []
adr: [ADR-0057]
---

# US-115 : Écriture du jeu : jeux, personnages, groupes, intrigues, objets, documents, lieux, timeline

En tant que développeuse, je veux que les écrans d'écriture du jeu soient vérifiés.

## Critères d'acceptation

- [x] Pages et formulaires de l'écriture en TypeScript strict, couverts par la règle de lint : jeux (partage, legs), personnages (relations, trombinoscope), groupes, intrigues, objets, documents, lieux, timeline.
- [x] Un élément en cours d'édition a le type de l'élément rendu par l'API, sans ses éléments liés, tenus en identifiants (`utils/writingDrafts.ts`).
- [x] `pages/timeline/index.vue` découpé en sous-composants, sans changement de comportement : recherche du jeu, raccourcis, vue chronologique, détail par jour.
- [x] Défauts révélés par la vérification, corrigés :
  - le badge « Jeu archivé » de la timeline s'affichait pour tout jeu actif ;
  - l'alerte de conflit d'un événement disparaissait après son enregistrement ;
  - une page enregistrée hors ligne remplaçait l'élément affiché par sa mise en file ;
  - un champ facultatif vidé s'enregistre vide (`null`), plus en chaîne vide.

## Tests

- `npm run typecheck` et `npm run lint` sur ces fichiers.
- Parcours Playwright existants dans la CI (legs, trombinoscopes, documents).
