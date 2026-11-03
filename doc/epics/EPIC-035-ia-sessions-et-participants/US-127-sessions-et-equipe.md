---
id: US-127
titre: L'assistant crée une session et compose son équipe
statut: terminée
epic: EPIC-035
regles: [R4, R5, R10, R11, R12, R13, R15]
adr: [ADR-0058, ADR-0028]
---

# US-127 : L'assistant crée une session et compose son équipe

En tant qu'organisatrice, je veux que mon assistant crée les sessions de mes jeux et compose leur équipe, afin de préparer une nouvelle date avec lui.

## Critères d'acceptation

- [x] Avec une autorisation en lecture et écriture, l'assistant crée une session d'un jeu de l'autorisation : nom, date, lieu du même jeu. Elle est prévue et n'est pas visible sur la page publique.
- [x] Il modifie le nom, la date et le lieu d'une session, en donnant la version lue. Le statut, la visibilité, l'équipe, le casting et les photos restent tels quels.
- [x] Il donne l'équipe complète d'une session : chaque personne du jeu avec son rôle (participant, orga, PNJ, cuisine). Une personne retirée de l'équipe perd son personnage dans la session ; son suivi de paiement ne change pas.
- [x] Une personne qui n'est pas du jeu, ou un lieu d'un autre jeu, est refusé. Une version dépassée est refusée.
- [x] Il n'annule, ne reporte, ne termine ni ne supprime une session, et ne la rend pas visible.
- [x] Une autorisation en lecture seule n'a pas ces outils, et le serveur refuse quand même l'écriture.
- [x] Chaque écriture est notée au journal.
- [x] La création et la modification d'une session dans l'interface gardent leur comportement : elles appellent les mêmes fonctions serveur.

## Tests

- Intégration : création (prévue, non visible), modification des détails sans toucher au reste, équipe (ajout, rôle, retrait qui retire le personnage), personne d'un autre jeu, lieu d'un autre jeu, version dépassée, lecture seule, journal, tests existants des routes inchangés.
