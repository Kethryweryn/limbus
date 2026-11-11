---
id: US-235
titre: Le jeu devant le libellé, hors des pages du jeu
statut: à faire
epic: EPIC-055
regles: [R4]
adr: []
---

# US-235 : Le jeu devant le libellé, hors des pages du jeu

En tant que participante, je veux lire le jeu avec la session dans mes emails, mes PDF et « Je participe », afin de savoir de quel jeu parle « Session du 15 mai 2099 ».

## Critères d'acceptation

- [ ] Étant donné un email, un PDF, « Je participe », le tableau de bord ou un document reçu, alors la session se lit « <jeu> — Session du <date> », sauf là où le titre du jeu est affiché juste à côté (R4).
- [ ] Étant donné une page d'un jeu, alors la session se lit sans le jeu (R4).

## Notes techniques

- Relever chaque endroit hors des pages du jeu, et composer le libellé par une seule fonction.

## Tests

De bout en bout (Playwright), sur les quatre axes (ADR-0079) :

- Actions : « Je participe », un document reçu, le tableau de bord.
- Erreurs de saisie : aucune saisie.
- Droits : inchangés.
- Hors ligne : « Je participe » relu sans réseau garde le jeu devant le libellé.
