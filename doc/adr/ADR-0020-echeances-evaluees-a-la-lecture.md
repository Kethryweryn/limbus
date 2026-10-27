---
id: ADR-0020
titre: Échéances évaluées à la lecture, sans tâche planifiée
statut: proposé
date: 2026-10-27
liens: [SPEC-001, EPIC-001, ADR-0013]
---

# ADR-0020 : Échéances évaluées à la lecture, sans tâche planifiée

## Contexte

Les inscriptions ont des échéances : la clôture d'une période d'inscription, le délai de réponse d'une invitation, et plus tard la confirmation d'email et la confirmation de place. L'application n'a aucun mécanisme de tâche planifiée : pas de cron, pas de tâche Nitro. Elle tourne en un seul processus ([ADR-0013](ADR-0013-un-seul-processus.md)).

## Décision

- Les échéances sont stockées comme des dates (`closesAt`, `responseDueAt`…), et l'état qui en découle est **calculé à la lecture** par des fonctions pures : période d'inscription clôturée, invitation en délai dépassé.
- Toute route qui agit sous condition (modifier une inscription, accepter une invitation) vérifie l'échéance côté serveur, au moment de la requête.
- Une échéance ne déclenche jamais d'action par elle-même : un délai dépassé est signalé, et les organisatrices décident (libérer, prolonger), conformément à R20 et R21.
- Exception à venir : la suppression des inscriptions publiques jamais confirmées par email (R11, EPIC-002) demandera un nettoyage. Elle fera l'objet de son propre ADR (nettoyage à l'occasion des requêtes, ou tâche planifiée).

## Conséquences

- Pas d'infrastructure de tâches à maintenir, et aucun risque qu'une tâche manquée laisse un état faux : l'état affiché est toujours celui du moment.
- Les fonctions de calcul d'état sont pures, donc simples à tester unitairement.
- Les requêtes qui filtrent sur un état calculé (« toutes les invitations en délai dépassé ») filtrent sur les dates en SQL ; les fonctions et les filtres doivent rester cohérents, d'où des tests qui couvrent les deux.
- Pas de relance automatique : relancer est une action de l'organisatrice.

## Options écartées

- **Tâche planifiée (cron système ou tâche Nitro)** : nécessaire seulement pour agir sans requête (relances automatiques, purges). Pas de besoin dans cet epic.
- **Statut stocké mis à jour par une tâche** : duplique l'information, et l'état est faux entre deux passages.
