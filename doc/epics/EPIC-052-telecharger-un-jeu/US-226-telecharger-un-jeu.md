---
id: US-226
titre: Télécharger un jeu pour le consulter sans réseau
statut: à faire
epic: EPIC-052
regles: [R8, R9, R10, R11, R12, R13]
adr: [ADR-0080, ADR-0081]
---

# US-226 : Télécharger un jeu pour le consulter sans réseau

En tant qu'organisatrice, je veux télécharger un jeu d'un clic avant de partir sur le lieu, afin d'en ouvrir toutes les pages sans réseau.

## Critères d'acceptation

- [ ] Étant donné un jeu actif dont je suis organisatrice ou co-organisatrice, alors la section a un bouton « Télécharger » pour lui ; un jeu archivé n'en a pas.
- [ ] Étant donné le téléchargement lancé, alors l'avancement s'affiche, puis la date du téléchargement à côté du jeu.
- [ ] Étant donné le jeu téléchargé et le réseau coupé, alors chaque liste, chaque fiche, la page Inscriptions et chaque inscription, et chaque session avec ses onglets s'ouvrent ; pour une session à venir, ses PDF et les photos du cast aussi.
- [ ] Étant donné le jeu téléchargé et le réseau coupé, alors la fiche d'un participant montre son contact d'urgence et ses allergies ; la section l'a dit à côté du bouton.
- [ ] Étant donné une session passée, alors ses PDF ne sont pas téléchargés.
- [ ] Étant donné un élément modifié sans réseau et pas encore envoyé, alors le téléchargement garde sa copie « en attente ».
- [ ] Étant donné le réseau qui tombe pendant le téléchargement, alors il s'arrête et le dit ; un nouveau clic reprend.
- [ ] Étant donné pas de réseau, alors le bouton est indisponible, avec la raison.

## Notes techniques

Plan des lectures d'un jeu (`utils/offlinePlan.ts`), partagé avec les pages ; registre `offlineDownloads` (ADR-0081).

## Tests

De bout en bout (Playwright), sur les quatre axes (ADR-0079) :

- Actions : télécharger un jeu, couper le réseau, ouvrir chaque écran du jeu.
- Erreurs de saisie : aucune saisie ; le réseau qui tombe en cours est couvert par le hors ligne.
- Droits : une co-organisatrice télécharge le jeu partagé ; une organisatrice sans accès n'a pas de bouton, et ne garde rien du jeu ; une participante n'a pas de bouton de jeu.
- Hors ligne : bouton indisponible sans réseau ; arrêt et reprise ; copie en attente gardée.
