---
id: US-229
titre: Télécharger mes sessions à venir
statut: terminée
epic: EPIC-053
regles: [R16]
adr: [ADR-0081]
---

# US-229 : Télécharger mes sessions à venir

En tant que participante, je veux télécharger mes sessions à venir, afin de relire mes documents sur le lieu sans réseau.

## Critères d'acceptation

- [x] Étant donné une personne qui participe à au moins une session, alors la section a un bouton « Télécharger mes sessions à venir ».
- [x] Étant donné le téléchargement fait et le réseau coupé, alors « Je participe » s'ouvre, avec chaque document reçu pour une session à venir et ses PDF.
- [x] Étant donné une session passée, alors ses documents ne sont pas téléchargés.
- [x] Étant donné le téléchargement fait, alors il se met à jour comme un jeu (une fois par heure au plus), et une session que « Je participe » ne montre plus part de l'appareil, avec ses documents.
- [x] Étant donné une personne PNJ ou en cuisine sur une session, sans accès d'organisation au jeu, alors elle a ce bouton, et pas celui du jeu.

## Notes techniques

- `downloadMySessions` (`utils/offlineDownload.ts`), entrée `mes-sessions` du registre : participations, puis pour chaque session à venir ses documents reçus, leur PDF et leurs photos. Une mise à jour efface de l'appareil ce que le téléchargement précédent gardait et que le nouveau ne garde plus ; il en va de même pour un jeu.
- Le service worker ne garde jamais en passant un PDF ou une photo d'un document reçu ; sans réseau, il les sert depuis les téléchargements (`nuxt.config.ts`).

## Tests

De bout en bout (`tests/e2e/offlineMySessions.spec.ts`), sur les quatre axes (ADR-0079) :

- Actions : « sans réseau, « Je participe » et les documents des sessions à venir s’ouvrent ; ceux des sessions passées ne sont pas gardés ».
- Erreurs de saisie : aucune saisie.
- Droits : « un PNJ sans accès au jeu a ce bouton et pas celui du jeu ; une personne sans session n’en a aucun ».
- Hors ligne : le premier test, et « une session que « Je participe » ne montre plus part de l’appareil à la mise à jour ».
