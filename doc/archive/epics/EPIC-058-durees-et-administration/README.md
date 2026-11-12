---
id: EPIC-058
titre: Comptes non activés : durée et administration
statut: terminé
spec: ../../../specs/SPEC-022-compte-pour-chaque-participant.md
date: 2026-11-12
---

# EPIC-058 : Comptes non activés : durée et administration

## Objectif

Lot 3 de [SPEC-022](../../../specs/SPEC-022-compte-pour-chaque-participant.md) :

- un compte jamais activé est effacé avec sa dernière fiche ([ADR-0090](../../../adr/ADR-0090-effacement-du-compte-non-active.md)) ;
- l'administration montre les comptes non activés à part, en lecture seule.

La politique de confidentialité (R16) a été avancée au lot 2 (US-244).

## US

| US | Titre | Statut |
|---|---|---|
| [US-248](US-248-comptes-non-actives-dans-l-administration.md) | Les comptes non activés dans l'administration | terminée |
| [US-249](US-249-effacement-du-compte-non-active.md) | Effacer un compte non activé avec sa dernière fiche | terminée |

## Définition de terminé

- Toutes les US terminées ; `npm run lint`, `npm run typecheck`, `npm test` et la CI passent.
- Spec à jour, ADR écrits pour les décisions prises.

## Suivi

- 2026-11-12 : déployé en deux PR, vérifiées en production (sites joignables, numéro de déploiement sur /nouveautes) : #247 (US-249), #248 (US-248).
- Un compte non activé est effacé avec la dernière fiche qui porte son adresse, quel que soit le chemin de suppression ([ADR-0090](../../../adr/ADR-0090-effacement-du-compte-non-active.md)) ; un compte activé suit la règle des 24 mois.
- L'administration ne renvoie et n'affiche les comptes non activés que sur demande, en lecture seule ; l'administratrice les reprend en créant le compte à leur adresse.
- Les revues ont fait : ajouter la correction d'adresse aux chemins de suppression ; garder un compte dont une inscription attend sa confirmation ; prendre le verrou de l'adresse à la suppression ; ne charger les comptes non activés que sur demande.
- Limite connue : une inscription libre jamais confirmée n'est plus supprimable par l'administratrice ; le nettoyage l'efface au bout de 7 jours.
