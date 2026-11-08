---
id: ADR-0072
titre: Le public d'un document est une liste de rôles, plus des personnages et des groupes
statut: accepté
date: 2026-11-08
liens: [../specs/SPEC-003-ecriture-d-un-jeu.md, ../specs/SPEC-006-emails-et-paiements.md, ADR-0024-migrations-compatibles-avec-le-build-en-service.md]
---

# ADR-0072 : Le public d'un document est une liste de rôles, plus des personnages et des groupes

## Contexte

Un document avait un public unique (`Document.audience`) : ciblage manuel, tout le monde, organisateurs, PNJ ou cuisine. Le ciblage manuel visait un personnage (`characterId`), des personnages et des groupes. On ne pouvait ni viser deux rôles à la fois, ni viser les PJ, ni ajouter des personnages à un rôle (retour B3-1 du cahier de tests).

## Décision

- Nouvelle colonne `Document.audiences String[]` : les rôles visés parmi `organizers`, `npcs`, `kitchen` et `pjs`. « Tout le monde » coche les quatre ; il n'est pas stocké à part.
- Les personnages (`characters`) et les groupes (`factions`) restent : ils forment la sélection avancée, qui s'ajoute aux rôles.
- Destinataires dans une session, chacun une fois : organisateurs et cuisine par leur rôle dans l'équipe ; PNJ par leur rôle dans l'équipe ou parce qu'ils tiennent un personnage PNJ ; PJ parce qu'ils tiennent un personnage PJ ; puis ceux qui tiennent un personnage choisi ou un personnage d'un groupe choisi.
- Le champ unique « Personnage » (`characterId`) rejoint la liste des personnages : la migration le recopie dans `characters` et le vide, et l'application ne l'écrit plus.
- La migration remplit `audiences` à partir de `audience` : tout le monde donne les quatre rôles, un rôle donne ce rôle, le ciblage manuel ne donne aucun rôle.
- Compatibilité (ADR-0024) : `audience` et `characterId` restent en base. L'application écrit encore dans `audience` la valeur la plus proche, pour le build encore en service pendant le déploiement. Une écriture qui n'envoie que l'ancien `audience` ou `characterId` (onglet resté ouvert, file hors ligne) est convertie par le serveur. À la lecture, un document sans rôles prend ceux de l'ancien public (`documentRoles`) : document gardé sur l'appareil d'avant, ou créé par l'ancien build pendant le déploiement.

## Conséquences

- « Tout le monde » écrit aux mêmes personnes qu'avant : le cast, PJ comme PNJ, l'organisation, les PNJ et la cuisine.
- Un document visé à « PNJ » atteint maintenant aussi une organisatrice qui tient un personnage PNJ.
- Pendant les quelques minutes d'un déploiement, l'ancien build qui modifie le public d'un document existant change `audience` sans toucher `audiences` : le nouveau public n'est pas pris en compte. Il suffit de rouvrir le document et de l'enregistrer.
- Les colonnes `audience` et `characterId` pourront être retirées dans une migration ultérieure, une fois aucun build ne les lisant plus.

## Options écartées

- **Une table de rôles par document** : une liste de quatre valeurs connues tient dans une colonne.
- **Garder « Tous les PJ », « Tous les PNJ », « Tous les personnages » parmi les groupes** : les cases PJ et PNJ les remplacent (choix de l'utilisatrice).
