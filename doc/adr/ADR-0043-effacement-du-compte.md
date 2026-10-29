---
id: ADR-0043
titre: Effacer son compte efface ses fiches participant, après avoir prévenu les équipes
statut: accepté
date: 2026-10-29
liens: [../specs/SPEC-011-un-compte-pour-tout-le-monde.md, ADR-0041-fiches-rattachees-a-un-compte.md, ADR-0042-coordonnees-du-compte.md]
---

# ADR-0043 : Effacer son compte efface ses fiches participant, après avoir prévenu les équipes

## Contexte

[SPEC-011](../specs/SPEC-011-un-compte-pour-tout-le-monde.md) (R13) : l'effacement demandé depuis le compte est immédiat, et chaque équipe concernée est prévenue (place libérée, paiement à régler à la main). Les données d'une personne sont sur son compte (coordonnées, [ADR-0042](ADR-0042-coordonnees-du-compte.md)) et sur ses fiches rattachées ([ADR-0041](ADR-0041-fiches-rattachees-a-un-compte.md)).

## Décision

- L'effacement efface chaque fiche rattachée par `eraseParticipant` (inscriptions, photos, paiements, envois, notes), puis le compte (partages, liens de compte, invitations envoyées, par cascade).
- Avant d'effacer, Limbus relève pour chaque jeu concerné les sessions où la personne avait une place et les paiements reçus (montant par session) ; une fois tout effacé, il écrit à la propriétaire et aux co-organisatrices. Un effacement interrompu ne prévient donc personne à tort. Un échec d'envoi n'annule pas l'effacement, qui reste la demande de la personne : la page lui dit quelles équipes n'ont pas été prévenues.
- Refus tant que la personne possède un jeu, ou si elle est la dernière administratrice active : rien ne disparaît par surprise pour une co-organisatrice. Une copie léguée en attente qu'elle avait envoyée est supprimée avec ses fichiers, sinon elle resterait sans propriétaire ni invitation.
- Le mot de passe est redemandé.
- L'export (`GET /api/account/export`) assemble le compte et, pour chaque fiche, `exportParticipantData` sans limite de jeux : ce sont ses données, notes des équipes comprises.

## Conséquences

- Comme l'effacement d'une fiche par une équipe ([SPEC-007](../specs/SPEC-007-participants-et-rgpd.md), R12), rien n'est tracé : l'email aux équipes est la seule trace.
- La suppression d'un compte par l'administratrice reste distincte : elle ne touche pas aux fiches.

## Options écartées

- **Garder les fiches et n'effacer que le compte** : écartée par l'utilisatrice ; ce ne serait pas un effacement.
- **Supprimer ses jeux avec le compte** : ses co-organisatrices perdraient leur travail.
