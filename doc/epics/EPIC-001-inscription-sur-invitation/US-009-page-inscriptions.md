---
id: US-009
titre: Page Inscriptions dans le menu Organisation
statut: à faire
epic: EPIC-001
regles: [R33]
adr: []
---

# US-009 : Page Inscriptions dans le menu Organisation

En tant qu'organisatrice, je veux retrouver les inscriptions avec les autres outils d'organisation (participants, lieux, sessions), et non sur la fiche du jeu, qui sert à l'écriture.

## Critères d'acceptation

- [ ] Le menu de gauche a une entrée « Inscriptions » dans la section Organisation, juste au-dessus de « Participants ».
- [ ] La page `/registrations` liste les périodes d'inscription regroupées par jeu. Chaque jeu a son bloc, avec :
  - son titre et son nombre de périodes ;
  - ses périodes (état, sessions et places, délai, clôture) et leurs actions (ouvrir, clôturer, rouvrir, modifier, supprimer) ;
  - les boutons « Nouvelle période d'inscription » et, une fois US-002 livrée, « Formulaire ».
- [ ] Avec un jeu actif, la page n'affiche que ce jeu et rappelle le jeu actif, comme les autres pages d'organisation (`GameContextBar`).
- [ ] Sans jeu actif, un filtre propose « Tous les jeux » ou un jeu précis. Les jeux archivés sont masqués, sauf si l'on coche « Afficher les jeux archivés ».
- [ ] La fiche du jeu n'affiche plus la section « Inscriptions ».
- [ ] Aucun changement d'API : la page réutilise `GET /api/games` et les routes de US-001.

## Notes techniques

- Composant `RegistrationPeriodsPanel` : il devient le bloc d'un jeu, avec son titre en paramètre ; la page en affiche un par jeu.
- Page `pages/registrations/index.vue`, sur le modèle des pages Sessions et Participants (jeu actif, filtre de jeu).
- Ordre avec US-002 : US-009 d'abord, puis US-002 ajoute le bouton « Formulaire » dans ce bloc.

## Tests

- Pas de nouvelle route : les tests d'intégration et d'isolation de US-001 couvrent l'API.
- Vérification de l'écran à la main (menu, jeu actif, filtre, jeux archivés). Un test Playwright du parcours d'inscription viendra avec US-004, comme prévu par l'epic.
