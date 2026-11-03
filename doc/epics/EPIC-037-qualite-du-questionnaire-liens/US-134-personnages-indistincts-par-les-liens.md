---
id: US-134
titre: Les personnages que les liens ne distinguent pas
statut: terminée
epic: EPIC-037
regles: [R2, R6]
adr: [ADR-0061, ADR-0051]
---

# US-134 : Les personnages que les liens ne distinguent pas

En tant qu'organisatrice, je veux savoir quels personnages mon questionnaire ne pourra pas départager, afin d'ajouter ou de changer des liens avant les inscriptions.

## Critères d'acceptation

- [x] Pour chaque paire de personnages PJ reliés, Limbus compare les points que chaque réponse possible leur donne, comme la note de l'assistant de casting (1 point direct, ½ par la faction ou l'intrigue, une échelle comptée à 5/5).
- [x] À partir d'une similarité cosinus de 0,80, la paire est « à revoir » : « Aldric et Bertrand rapportent presque les mêmes points pour chaque réponse : le questionnaire aura du mal à les départager. »
- [x] La phrase donne une piste : une réponse qui les sépare déjà, ou l'absence de réponse propre à l'un d'eux.
- [x] Un personnage sans lien (US-133) n'est pas comparé.
- [x] Le détail replié donne la similarité, le seuil de 0,80 et l'origine du seuil (choix de l'utilisatrice).

## Notes techniques

- Profil de points d'un personnage : un vecteur indexé par (question, option), calculé avec `answerFactor` et les liens. La similarité est le cosinus de deux profils.
- Le nombre de paires croît comme le carré du nombre de personnages : pour quelques centaines, c'est négligeable.

## Tests

- Unitaires : profils identiques (1), profils sans réponse commune (0), lien par faction qui rapproche deux personnages de la même faction, échelle, seuil de 0,80.
- Intégration : la route rend la paire indistincte d'un jeu de test.
