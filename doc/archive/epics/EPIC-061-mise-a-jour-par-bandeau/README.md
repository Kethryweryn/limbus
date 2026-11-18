---
id: EPIC-061
titre: Une nouvelle version se charge depuis un bandeau
statut: terminé
spec: ../../../specs/SPEC-010-hors-ligne.md
origine: ../../../archive/todo/mise-a-jour-par-bandeau.md
date: 2026-11-17
---

# EPIC-061 : Une nouvelle version se charge depuis un bandeau

## Objectif

Après un déploiement, aucune page ne se recharge d'elle-même : un bandeau propose de recharger, et la personne choisit le moment (R14 de [SPEC-010](../../../specs/SPEC-010-hors-ligne.md), [ADR-0093](../../../adr/ADR-0093-mise-a-jour-par-bandeau.md)). Au retour du réseau, l'envoi des modifications faites hors ligne ne recharge plus la page non plus (R7).

## US

| US | Titre | Statut |
|---|---|---|
| [US-254](US-254-bandeau-de-mise-a-jour.md) | Charger une nouvelle version quand je le décide | terminée |
| [US-255](US-255-retour-du-reseau-sans-rechargement.md) | Retrouver le réseau sans que la page se recharge | terminée |

## Définition de terminé

- Toutes les US terminées ; `npm run lint`, `npm run typecheck`, `npm test` et la CI passent.
- Spec à jour, ADR écrits pour les décisions prises.

## Suivi

- 2026-11-17 et 2026-11-18 : les deux US sont déployées.
  - US-254, bandeau de nouvelle version : PR #260, déploiement n° 260.
  - US-255, retour du réseau sans rechargement : PR #262, déploiement n° 262.
- Revue de la documentation (PR #259) : l'onglet resté sur l'ancienne version se recharge au changement de page qui demande un fichier disparu (exception acceptée par l'utilisatrice) ; le bandeau réserve sa hauteur ; l'US-255 est ajoutée à sa demande.
- Ce que la revue de code a changé :
  - la recherche d'une version continue quand une version attend, et une version plus récente rouvre le bandeau fermé ;
  - les toasts passent au-dessus du bandeau, annoncé aux lecteurs d'écran ;
  - la page relue après l'envoi rend la position de défilement.
- Changé en passant :
  - l'audit de la CI exempte l'avis picomatch sans correctif, qui bloquait toutes les PR (PR #261, ADR-0094) ;
  - un test du déroulé attend la réponse du premier enregistrement.
- Cause vérifiée : le test des deux onglets échoue sans `onNeedReload`, ce qui reproduit le rechargement d'un onglet par un autre.
- Limites connues :
  - après l'envoi des modifications faites hors ligne, la recherche et la page de la liste repartent de zéro, comme avec l'ancien rechargement ;
  - le déploiement est simulé dans les tests par une autre adresse du service worker : Playwright n'intercepte pas son fichier.
- Non vérifié sur l'appareil de l'utilisatrice : le bandeau après un vrai déploiement, et la disparition des rechargements pendant la saisie.
