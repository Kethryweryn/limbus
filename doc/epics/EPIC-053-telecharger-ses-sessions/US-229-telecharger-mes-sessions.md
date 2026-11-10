---
id: US-229
titre: Télécharger mes sessions à venir
statut: à faire
epic: EPIC-053
regles: [R16]
adr: [ADR-0081]
---

# US-229 : Télécharger mes sessions à venir

En tant que participante, je veux télécharger mes sessions à venir, afin de relire mes documents sur le lieu sans réseau.

## Critères d'acceptation

- [ ] Étant donné une personne qui participe à au moins une session, alors la section a un bouton « Télécharger mes sessions à venir ».
- [ ] Étant donné le téléchargement fait et le réseau coupé, alors « Je participe » s'ouvre, avec chaque document reçu pour une session à venir et ses PDF.
- [ ] Étant donné une session passée, alors ses documents ne sont pas téléchargés.
- [ ] Étant donné le téléchargement fait, alors il se met à jour comme un jeu (une fois par heure au plus), et une session dont la personne ne fait plus partie part de l'appareil.

## Notes techniques

Même registre et même mise à jour qu'EPIC-052, entrée « mes sessions à venir ».

## Tests

De bout en bout (Playwright), sur les quatre axes (ADR-0079) :

- Actions : télécharger, couper le réseau, ouvrir « Je participe » et un document.
- Erreurs de saisie : aucune saisie.
- Droits : la participante ne garde que ce que « Je participe » lui montre.
- Hors ligne : bouton indisponible sans réseau ; mise à jour au retour du réseau.
