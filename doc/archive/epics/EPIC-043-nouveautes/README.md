---
id: EPIC-043
titre: Nouveautés et numéro de déploiement
statut: terminé
spec: ../../../specs/SPEC-017-nouveautes.md
date: 2026-11-05
---

# EPIC-043 : Nouveautés et numéro de déploiement

## Objectif

Les personnes qui utilisent Limbus lisent ce qui change sur une page « Nouveautés » publique, fidèle à ce qui est en production, et peuvent donner le numéro du déploiement pour signaler un problème ([SPEC-017](../../../specs/SPEC-017-nouveautes.md), lot unique ; [ADR-0065](../../../adr/ADR-0065-nouveautes-et-numero-de-deploiement.md)).

## US

| US | Titre | Statut |
|---|---|---|
| [US-147](US-147-page-nouveautes.md) | Lire les nouveautés de Limbus | terminée |
| [US-148](US-148-numero-de-deploiement.md) | Donner le numéro du déploiement | terminée |
| [US-149](US-149-lien-du-menu.md) | Trouver les nouveautés dans le menu | terminée |

## Décisions

2026-11-05, choix de l'utilisatrice : voir l'historique de SPEC-017. Notes, dates et numéro : [ADR-0065](../../../adr/ADR-0065-nouveautes-et-numero-de-deploiement.md).

## Définition de terminé

- Toutes les US terminées ; `npm run lint`, `npm run typecheck`, `npm test` et la CI passent.
- Spec à jour, ADR écrits pour les décisions prises.

## Suivi

- 2026-11-05 : déployé (PR #143). En production, `/nouveautes` répond et affiche la première note, datée du 5 novembre 2026, avec « Déploiement n° 143 ». SPEC-017 est entièrement livrée.
- Limites connues au déploiement :
  - le lien du menu n'a été vu à l'écran que par Playwright, sur le build testé ;
  - le chemin `deploy.sh` lancé à la main n'est pas testé ;
  - le numéro relu dans le titre du dernier commit, sur `main`, n'est testé que sur un dépôt git temporaire : ni `deploy.sh` ni un lancement manuel de la CI ne l'ont encore exercé ;
  - la date de la note en production vient du commit de branche, car le build a été fait avant la fusion : le passage à la date de fusion, testé sur un dépôt git temporaire, ne se verra sur le vrai dépôt qu'au prochain déploiement ;
  - une nouvelle note porte le jour de son commit de branche jusqu'au déploiement suivant (R5, ADR-0065).
- Epic archivé.
