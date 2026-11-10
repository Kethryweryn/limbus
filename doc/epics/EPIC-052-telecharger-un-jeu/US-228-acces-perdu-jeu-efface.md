---
id: US-228
titre: Effacer de l’appareil un jeu dont l’accès est perdu
statut: à faire
epic: EPIC-052
regles: [R15]
adr: [ADR-0080, ADR-0081]
---

# US-228 : Effacer de l’appareil un jeu dont l’accès est perdu

En tant que propriétaire d'un jeu, je veux que la co-organisatrice à qui je retire l'accès ne garde pas le jeu sur son appareil, afin que les données de santé des participants n'y restent pas.

## Critères d'acceptation

- [ ] Étant donné un jeu téléchargé, quand l'accès est retiré puis qu'une mise à jour a lieu, alors tout ce qui avait été téléchargé de ce jeu est effacé de l'appareil, contact d'urgence et allergies compris, et la section dit que le jeu n'est plus accessible.
- [ ] Étant donné un jeu supprimé, alors de même.
- [ ] Étant donné les autres jeux téléchargés, alors ils restent.

## Notes techniques

Clés écrites par le téléchargement, lues dans le registre (ADR-0081).

## Tests

De bout en bout (Playwright), sur les quatre axes (ADR-0079) :

- Actions : retirer le partage, déclencher la mise à jour, vérifier l'appareil.
- Erreurs de saisie : aucune saisie.
- Droits : c'est l'objet de l'US.
- Hors ligne : sans réseau, rien n'est effacé ; l'effacement se fait au retour du réseau.
