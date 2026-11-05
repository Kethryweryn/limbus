---
id: EPIC-044
titre: Jeux de test à jour pour tout essayer
statut: à faire
spec: ../../archive/todo/jeux-de-test.md
date: 2026-11-05
---

# EPIC-044 : Jeux de test à jour pour tout essayer

## Objectif

L'utilisatrice recharge en une commande trois jeux de test aux dates toujours à jour, et essaie tout ce que Limbus sait faire, sous plusieurs comptes ([fiche](../../archive/todo/jeux-de-test.md), [ADR-0066](../../adr/ADR-0066-jeux-de-test-rechargeables-en-production.md)).

## US

| US | Titre | Statut |
|---|---|---|
| [US-150](US-150-rechargement-sur.md) | Recharger les jeux de test sans risque, avec des dates à jour | à faire |
| [US-151](US-151-comptes-de-test.md) | Se connecter avec des comptes de test | à faire |
| [US-152](US-152-jeu-inscriptions.md) | Essayer les inscriptions sur Station Meridian | à faire |
| [US-153](US-153-jeu-session-imminente.md) | Essayer une session imminente sur Les Cendres de Valombre | à faire |
| [US-154](US-154-jeu-apres-et-imprevus.md) | Essayer l'après-session et les imprévus sur Le Bal des Masques Brisés | à faire |
| [US-155](US-155-guide-et-verification.md) | Savoir où essayer chaque fonctionnalité, et garder le script à jour | à faire |

## Décisions

2026-11-05, choix de l'utilisatrice : voir la [fiche](../../archive/todo/jeux-de-test.md). Fonctionnement du script : [ADR-0066](../../adr/ADR-0066-jeux-de-test-rechargeables-en-production.md).

## Définition de terminé

- Toutes les US terminées ; `npm run lint`, `npm run typecheck`, `npm test` et la CI passent.
- ADR à jour pour les décisions prises.
- Le rechargement en production se fait seulement quand l'utilisatrice le demande : il remplace les trois jeux.
