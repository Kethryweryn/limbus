---
id: US-101
titre: Voir la note de chaque joueur pour chaque personnage, et les interdits
statut: terminée
epic: EPIC-025
regles: [R24, R27, R28]
adr: [ADR-0051]
---

# US-101 : Voir la note de chaque joueur pour chaque personnage, et les interdits

En tant qu'organisatrice, je veux voir pourquoi un personnage convient à un joueur, et ce qui le lui interdit.

## Critères d'acceptation

- [x] Pour chaque joueur et chaque personnage PJ, l'assistant donne une note et son détail :
  - chaque réponse au questionnaire reliée au personnage vaut 1 point ;
  - une réponse reliée à sa faction ou à son intrigue vaut un demi-point ;
  - une échelle compte à proportion (1 : rien, 5 : en entier).
- [x] Un personnage qui a une relation d'un type refusé par le joueur est interdit, avec la raison (« Relation refusée : Romance, avec Bran »).
- [x] Deux personnes dont l'une ne veut pas jouer avec l'autre (affinité rattachée) ne peuvent pas jouer deux personnages en relation directe. Si l'un des deux personnages est verrouillé, l'autre est interdit, avec la raison.
- [x] Les relations refusées écrites en texte libre sont affichées à côté du joueur.
- [x] Deux personnes de la session dont l'une ne veut pas croiser l'autre sont signalées.
- [x] Ces informations ne sont visibles que de l'équipe du jeu (R24).

## Notes techniques

- `POST /api/sessions/:id/casting-assistant` calcule, à partir du cast en cours d'édition. Il n'écrit rien.
- Calcul dans `utils/castingAssistant.ts`, testé seul.

## Tests

- Unitaires : notes (lien direct, faction, échelle), relation refusée, « Aucune » sans effet.
- Intégration : notes et interdits par l'API, isolation de la route.
