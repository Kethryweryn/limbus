---
id: ADR-0041
titre: Fiches participant rattachées à un compte par l'adresse confirmée
statut: accepté
date: 2026-10-29
liens: [../specs/SPEC-011-un-compte-pour-tout-le-monde.md, ADR-0018-lien-personnel-d-inscription.md, ADR-0039-comptes-en-libre-service.md]
---

# ADR-0041 : Fiches participant rattachées à un compte par l'adresse confirmée

## Contexte

Une personne peut avoir une fiche dans plusieurs équipes, toujours à son adresse email. [SPEC-011](../specs/SPEC-011-un-compte-pour-tout-le-monde.md) (R11) veut qu'elles se rattachent toutes au compte de cette adresse, et que la personne y retrouve ses sessions, inscriptions et paiements, et agisse sur ses inscriptions.

## Décision

- `Participant.userId` (nullable, `ON DELETE SET NULL`) porte le rattachement. Il est recalculé chaque fois qu'il peut changer : à la confirmation d'une adresse (toutes les fiches à cette adresse, sans tenir compte de la casse, se rattachent), et à la création ou à la modification de l'email d'une fiche (elle suit le compte confirmé de sa nouvelle adresse, ou aucun). Une colonne plutôt qu'une comparaison d'emails à la lecture : le lot 5 confie les coordonnées de la fiche à la personne, ce qui demande un lien stable.
- Les routes de l'espace participant sont sous `server/api/me/` : elles partent toujours des fiches dont `userId` est le compte connecté, jamais d'un identifiant de jeu. Une ressource d'une fiche qui n'est pas la sienne répond 404.
- Agir sur une inscription depuis le compte reprend la logique du lien personnel ([ADR-0018](ADR-0018-lien-personnel-d-inscription.md)) : même sélection, mêmes permissions, même email de confirmation, dont le lien mène alors au compte.
- Le RIB d'une session est servi au compte rattaché à une fiche qui doit payer cette session ; le fichier reste servi par une route qui vérifie les droits.
- L'espace affiché vient de l'adresse de la page (`/participer…`) ; le dernier espace utilisé est gardé dans le navigateur (`localStorage`), sans colonne en base. `GET /api/auth/me` dit si le compte a un jeu à organiser et une fiche rattachée.

## Conséquences

- La règle « un fichier destiné à un participant part en pièce jointe » vaut pour les personnes sans compte ; avec un compte, le RIB se télécharge aussi depuis l'espace.
- Une équipe qui saisit par erreur l'adresse d'un autre compte lui montre le nom du jeu, ses sessions et ce qu'elle lui demande de payer. Le lot 5 bornera ce risque, la personne tenant elle-même ses coordonnées.

## Options écartées

- **Rattacher à la seule confirmation** : une fiche créée après le compte n'apparaîtrait jamais.
- **Garder l'espace en base** : un réglage de plus pour un confort d'appareil.
