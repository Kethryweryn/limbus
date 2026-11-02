---
id: US-126
titre: L'assistant écrit le contenu d'un jeu
statut: à faire
epic: EPIC-034
regles: [R4, R5, R8, R10, R11, R12, R13, R15]
adr: [ADR-0058]
---

# US-126 : L'assistant écrit le contenu d'un jeu

En tant qu'organisatrice, je veux que mon assistant crée, modifie et supprime les éléments de mes jeux, afin d'écrire avec lui personnages, intrigues et chronologie.

## Critères d'acceptation

- [ ] L'assistant crée, modifie et supprime :
  - personnages ;
  - factions ;
  - intrigues ;
  - objets ;
  - documents (texte) ;
  - lieux ;
  - événements de la chronologie ;
  - relations entre personnages.
- [ ] Il écrit leurs textes et leurs liens vers les autres éléments du même jeu ; un lien vers un autre jeu est refusé. Il marque « prêt à envoyer » une fiche ou un document. Il règle le trombinoscope d'un personnage : nom affiché, note, visage caché, exclusion.
- [ ] Il ne pose ni ne change aucun lien ni fichier : background, document, photo de trombinoscope.
- [ ] Une modification ne change que les champs donnés : les autres, liens compris, restent tels quels.
- [ ] Modifier ou supprimer demande la version lue ; une version dépassée est refusée.
- [ ] Les outils d'écriture sont déclarés non en lecture seule, et la suppression comme destructrice.
- [ ] Une autorisation en lecture seule n'a pas ces outils, et le serveur refuse quand même l'écriture.
- [ ] Chaque écriture est notée au journal : l'assistant, l'action, la sorte et le nom de l'élément, le jeu.
- [ ] Les routes de l'interface gardent leur comportement : elles appellent les mêmes fonctions serveur.

## Tests

- Unitaires : fusion des champs donnés avec la fiche actuelle.
- Intégration :
  - création, modification et suppression de chaque sorte ;
  - champ omis conservé ;
  - lien vers un autre jeu refusé ;
  - version dépassée ;
  - lecture seule ;
  - jeu hors de l'autorisation ;
  - journal ;
  - tests existants des routes, inchangés.
