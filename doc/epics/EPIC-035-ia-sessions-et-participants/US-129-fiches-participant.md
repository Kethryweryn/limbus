---
id: US-129
titre: L'assistant crée et modifie les fiches participant
statut: terminée
epic: EPIC-035
regles: [R4, R5, R8, R10, R11, R12, R13, R15]
adr: [ADR-0058, ADR-0040, ADR-0042]
---

# US-129 : L'assistant crée et modifie les fiches participant

En tant qu'organisatrice, je veux que mon assistant crée et tienne à jour les fiches de mes participants, afin de préparer l'équipe et le casting avec lui.

## Critères d'acceptation

- [x] L'assistant crée une fiche dans un jeu de l'autorisation : nom et note d'organisation de ce jeu. Elle n'a ni email ni téléphone.
- [x] Il change le nom d'une fiche et sa note d'organisation pour un jeu de l'autorisation, en donnant la version lue. Le nom d'une fiche rattachée à un compte reste celui du compte ([ADR-0042](../../adr/ADR-0042-coordonnees-du-compte.md)). Les coordonnées et les notes des autres jeux ne changent pas.
- [x] Il ajoute à un jeu de l'autorisation une personne déjà présente dans un jeu de l'autorisation. Il ne la retire jamais d'un jeu, et ne supprime aucune fiche.
- [x] La lecture des participants rend la version de chaque fiche, toujours sans coordonnées.
- [x] Une fiche d'un jeu hors de l'autorisation est refusée. Une version dépassée est refusée.
- [x] Une autorisation en lecture seule n'a pas ces outils, et le serveur refuse quand même l'écriture.
- [x] Chaque écriture est notée au journal.
- [x] La création et la modification d'une fiche dans l'interface gardent leur comportement : elles appellent les mêmes fonctions serveur.

## Tests

- Intégration : création, nom et note, fiche rattachée (nom gardé), ajout à un jeu, jeux non autorisés intacts, coordonnées intactes, version dépassée, lecture seule, journal, tests existants des routes inchangés.
