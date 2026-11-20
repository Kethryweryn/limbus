---
id: EPIC-063
titre: Bandeaux qui suivent le défilement, confirmation en fenêtre
statut: terminé
spec: ../../../specs/SPEC-010-hors-ligne.md
origine: ../../../specs/SPEC-019-hors-ligne-dans-le-compte.md
date: 2026-11-20
---

# EPIC-063 : Bandeaux qui suivent le défilement, confirmation en fenêtre

## Objectif

Corriger les trois retours du test A13 du cahier de tests (2026-11-19), sur « Hors ligne sur cet appareil » :

- A13-2 : les bandeaux du haut restent visibles quand la page défile (R15 de [SPEC-010](../../../specs/SPEC-010-hors-ligne.md), note du 2026-11-20 d'[ADR-0093](../../../adr/ADR-0093-mise-a-jour-par-bandeau.md)) ;
- A13-1 : la confirmation d'un effacement ou d'une désactivation s'ouvre dans une fenêtre (R4 de [SPEC-019](../../../specs/SPEC-019-hors-ligne-dans-le-compte.md)) ;
- A13-3 : en recochant la case, la liste « Télécharger pour le hors ligne » s'affichait deux fois. Défaut corrigé sans US, dans la même PR.

Choix de l'utilisatrice du 2026-11-20 : tous les bandeaux restent collés, la barre du logo défile comme avant ; la confirmation passe dans une fenêtre.

## US

| US | Titre | Statut |
|---|---|---|
| [US-257](US-257-bandeaux-qui-suivent-le-defilement.md) | Garder les bandeaux sous les yeux quand la page défile | terminée |
| [US-258](US-258-confirmation-en-fenetre.md) | Confirmer un effacement dans une fenêtre | terminée |

## Définition de terminé

- Toutes les US terminées ; `npm run lint`, `npm run typecheck`, `npm test` et la CI passent.
- Spec à jour, ADR écrits pour les décisions prises.

## Suivi

- 2026-11-20 : US-257, US-258 et le défaut A13-3 déployés (PR #269, déploiement n° 269).
- Ce que la revue de code a changé : un effacement qui échoue ferme la fenêtre, pour que son message se voie dans la section ; la page règle `scroll-padding-top` sur la hauteur des bandeaux, pour qu'un champ qui prend le focus ne s'arrête pas derrière eux ; les bandeaux de connexion gardent texte et bouton sur une ligne quand ils tiennent ; le bloc des bandeaux passe au-dessus des listes des pages (`z-40`) ; ADR-0093 renvoie à sa note du 2026-11-20 dans la section Décision.
- Limite connue : sur un petit écran, plusieurs bandeaux affichés ensemble couvrent en permanence le haut de l'écran, puisqu'ils ne défilent plus.
- La CI était bloquée par un avis grave sur `effect`, épinglé par Prisma : version corrigée forcée (PR #270, note du 2026-11-20 d'ADR-0016).
- Non vérifié sur l'appareil de l'utilisatrice : les trois retours, passés « à vérifier » dans le cahier de tests.
