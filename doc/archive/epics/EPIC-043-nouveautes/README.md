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

## Définition de terminé

- Toutes les US terminées ; `npm run lint`, `npm run typecheck`, `npm test` et la CI passent.
- Spec à jour, ADR écrits pour les décisions prises.

## Suivi

- 2026-11-05 : déployé (PR #143). En production, `/nouveautes` répond et affiche la première note, datée du 5 novembre 2026, avec « Déploiement n° 143 ». SPEC-017 est entièrement livrée.
- Limites connues au déploiement :
  - le lien du menu n'a été vu à l'écran que par Playwright, sur le build testé ;
  - le chemin `deploy.sh` lancé à la main n'est pas testé ;
  - une nouvelle note porte le jour de son commit de branche jusqu'au déploiement suivant (R5, ADR-0065).
- Epic archivé.
