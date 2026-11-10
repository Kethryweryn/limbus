---
titre: Revoir la page Inscriptions
statut: archivée
date: 2026-11-10
spec: ../../specs/SPEC-020-page-inscriptions.md
---

# Revoir la page Inscriptions

## Besoin

Retour D1-1 du cahier de tests (2026-11-09) : la page Inscriptions est extrêmement longue, et mélange les sessions, le vivier et les réglages. Sans jeu actif, elle affiche l'un sous l'autre le bloc complet de chaque jeu : réglages du vivier, invitations, chaque session à venir dépliée (casting, attente, pré-inscrites, annonces), les personnes du vivier, le journal des tirages et les sorties du vivier. L'utilisatrice demandait des propositions.

## Proposition

- Sans jeu actif, un résumé : une ligne par jeu, avec l'état du vivier, le nombre de personnes et ce qui reste à traiter.
- Une page par jeu, en trois onglets : Sessions, Vivier, Réglages.
- Dans Sessions, chaque session repliée sur une ligne, la prochaine dépliée d'office, ses tirages avec elle.

## Découpage envisagé

Un seul lot : la page d'un jeu et ses onglets, les sessions repliées, la recherche dans le vivier, puis le résumé.

## Points à trancher

Tranchés le 2026-11-10 avec l'utilisatrice :

- découpage : trois onglets, Sessions, Vivier, Réglages ;
- sans jeu actif : un résumé par jeu ;
- tirages avec leur session, sorties du vivier avec le vivier, repliés ;
- sessions repliées, la prochaine dépliée d'office ;
- « à traiter » : réponses modifiées, réponses attendues, casting à annoncer ;
- onglet et sessions dépliées dans l'adresse ;
- tirages d'une session passée ou supprimée : une ligne repliée « Sessions passées » en bas de Sessions ;
- une page propre au jeu, où mène Inscriptions quand un jeu est actif ;
- dans le vivier, une recherche par nom et un filtre par vœu de session.

Devenue [SPEC-020](../../specs/SPEC-020-page-inscriptions.md).
