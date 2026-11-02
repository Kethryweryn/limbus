---
id: US-125
titre: L'assistant crée et modifie un jeu
statut: terminée
epic: EPIC-034
regles: [R4, R5, R10, R11, R13]
adr: [ADR-0058]
---

# US-125 : L'assistant crée et modifie un jeu

En tant qu'organisatrice, je veux que mon assistant crée un jeu ou en change la présentation, afin de démarrer l'écriture avec lui.

## Critères d'acceptation

- [x] Avec une autorisation en lecture et écriture, l'assistant crée un jeu (titre, description, note d'intention, un PJ par personne, attribut d'équilibre). La personne en est propriétaire, et le jeu s'ajoute à l'autorisation.
- [x] Il modifie ces mêmes champs d'un jeu de l'autorisation, en donnant la version lue. Une version dépassée est refusée.
- [x] Il ne touche jamais :
  - la page publique ;
  - les photos ;
  - le contact ;
  - la vidéo de présentation ;
  - l'archivage.
- [x] Une autorisation en lecture seule n'a pas ces outils, et le serveur refuse quand même l'écriture.
- [x] Chaque création ou modification est notée au journal.

## Tests

- Intégration : création (le jeu entre dans l'autorisation), modification, version dépassée, lecture seule, champs interdits absents, journal.
