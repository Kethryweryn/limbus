---
id: EPIC-044
titre: Jeux de test à jour pour tout essayer
statut: terminé
spec: ../../todo/jeux-de-test.md
date: 2026-11-05
---

# EPIC-044 : Jeux de test à jour pour tout essayer

## Objectif

L'utilisatrice recharge en une commande trois jeux de test aux dates toujours à jour, et essaie tout ce que Limbus sait faire, sous plusieurs comptes ([fiche](../../todo/jeux-de-test.md), [ADR-0066](../../../adr/ADR-0066-jeux-de-test-rechargeables-en-production.md)).

## US

| US | Titre | Statut |
|---|---|---|
| [US-150](US-150-rechargement-sur.md) | Recharger les jeux de test sans risque, avec des dates à jour | terminée |
| [US-151](US-151-comptes-de-test.md) | Se connecter avec des comptes de test | terminée |
| [US-152](US-152-jeu-inscriptions.md) | Essayer les inscriptions sur Station Meridian | terminée |
| [US-153](US-153-jeu-session-imminente.md) | Essayer une session imminente sur Les Cendres de Valombre | terminée |
| [US-154](US-154-jeu-apres-et-imprevus.md) | Essayer l'après-session et les imprévus sur Le Bal des Masques Brisés | terminée |
| [US-155](US-155-guide-et-verification.md) | Savoir où essayer chaque fonctionnalité, et garder le script à jour | terminée |

## Décisions

2026-11-05, choix de l'utilisatrice : voir la [fiche](../../todo/jeux-de-test.md). Fonctionnement du script : [ADR-0066](../../../adr/ADR-0066-jeux-de-test-rechargeables-en-production.md).

## Définition de terminé

- Toutes les US terminées ; `npm run lint`, `npm run typecheck`, `npm test` et la CI passent.
- ADR à jour pour les décisions prises.
- Le rechargement en production se fait seulement quand l'utilisatrice le demande : il remplace les trois jeux.

## Suivi

- 2026-11-05 : déployé (PR #146 à #149, guide en #150), puis rechargé en production par l'utilisatrice, avec `SEED_REPLACE_BY_SLUG=1`. Vérifié ensuite : les trois jeux et leurs dates à venir, les périodes de Station Meridian, sa sélection, sa page publique et son formulaire, et l'accès conservé de l'assistant d'IA.
- La revue a notamment rendu le rechargement atomique, gardé le rattachement des fiches sans `SEED_PASSWORD`, déplacé la présence vers une session reportée, seule situation où l'application la demande (US-024), et donné un PDF au trombinoscope.
- Limites connues au déploiement :
  - ce chantier n'a pas essayé les comptes de test en production ni regardé les écrans connectés : ses vérifications de ces données passent par `tests/integration/seed.test.ts` ;
  - ce chantier n'a joué les envois que sur le faux serveur d'emails ;
  - un envoi groupé vers `example.test` montre des échecs attendus ;
  - les jeux vieillissent entre deux rechargements, et l'invitation du legs dure 14 jours.
- Epic archivé.
