---
id: EPIC-052
titre: Télécharger un jeu pour le hors ligne
statut: terminé
spec: ../../../specs/SPEC-019-hors-ligne-dans-le-compte.md
date: 2026-11-10
---

# EPIC-052 : Télécharger un jeu pour le hors ligne

## Objectif

Une organisatrice ou co-organisatrice télécharge un de ses jeux actifs, tout entier, pour le consulter sans réseau ; il se remet à jour tout seul, et part de l'appareil si elle en perd l'accès (SPEC-019, R8 à R15).

## US

| US | Titre | Statut |
|---|---|---|
| [US-226](US-226-telecharger-un-jeu.md) | Télécharger un jeu pour le consulter sans réseau | terminée |
| [US-227](US-227-mise-a-jour-du-jeu-telecharge.md) | Garder à jour un jeu téléchargé | terminée |
| [US-228](US-228-acces-perdu-jeu-efface.md) | Effacer de l’appareil un jeu dont l’accès est perdu | terminée |

## Définition de terminé

- Toutes les US terminées ; `npm run lint`, `npm run typecheck`, `npm test` et la CI passent.
- Spec à jour, ADR écrits pour les décisions prises ; tests de bout en bout sur les quatre axes (ADR-0079).
- Une note dans `nouveautes/` pour chaque PR.

## Suivi

- 2026-11-10 : déployé en deux PR, vérifiées en production (sites joignables, notes dans /nouveautes) : US-226 (#205), puis US-227 et US-228 (#206).
- La politique de confidentialité dit qu'un jeu téléchargé garde le contact d'urgence et les allergies (ADR-0080) : nouvelle version à accepter par chaque compte (`TERMS_VERSION` 2026-11-10).
- La revue a ajouté : lectures quatre à la fois, tableau de bord effacé avec un jeu perdu, photos déjà gardées non relues, un seul téléchargement à la fois par jeu, test de l'accès retiré.
- Limite connue : un jeu se télécharge en autant de lectures que de pages ; sur un gros jeu et un réseau mobile, cela prend du temps, suivi par l'avancement.
- Epic archivé.
