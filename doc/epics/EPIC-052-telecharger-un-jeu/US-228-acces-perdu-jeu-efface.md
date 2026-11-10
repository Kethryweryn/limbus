---
id: US-228
titre: Effacer de l’appareil un jeu dont l’accès est perdu
statut: terminée
epic: EPIC-052
regles: [R15]
adr: [ADR-0080, ADR-0081]
---

# US-228 : Effacer de l’appareil un jeu dont l’accès est perdu

En tant que propriétaire d'un jeu, je veux que la co-organisatrice à qui je retire l'accès ne garde pas le jeu sur son appareil, afin que les données de santé des participants n'y restent pas.

## Critères d'acceptation

- [x] Étant donné un jeu téléchargé, quand l'accès est retiré puis qu'une mise à jour a lieu, alors tout ce qui avait été téléchargé de ce jeu est effacé de l'appareil, contact d'urgence et allergies compris, et la section dit que le jeu n'est plus accessible.
- [x] Étant donné un jeu supprimé, alors de même.
- [x] Étant donné les autres jeux téléchargés, alors ils restent, même quand une réponse ou un fichier leur est commun.
- [x] Étant donné les listes gardées (personnages, participants, sessions…), alors les lignes du jeu perdu en sont retirées.

## Notes techniques

Clés écrites par le téléchargement, lues dans le registre (ADR-0081).

## Notes de réalisation

`forgetDownloadedGame` efface les réponses et fichiers du jeu (sauf ceux d'un autre téléchargement), ses lignes dans les listes, et le tableau de bord ; le jeu reste au registre, marqué perdu, pour que la section le dise jusqu'au prochain effacement. De nouveau accessible, il se télécharge comme un autre.

## Tests

De bout en bout (`tests/e2e/offlineDownload.spec.ts`), sur les quatre axes (ADR-0079) :

- Actions : « un accès retiré efface le jeu de l’appareil, contact d’urgence compris, et garde les autres jeux » (au clic sur « Télécharger de nouveau »).
- Erreurs de saisie : aucune saisie.
- Droits : les deux tests ; le jeu gardé, encore accessible, reste avec son contact d'urgence.
- Hors ligne : à la mise à jour qui suit le retour du réseau (« un jeu téléchargé il y a plus d’une heure… »).
