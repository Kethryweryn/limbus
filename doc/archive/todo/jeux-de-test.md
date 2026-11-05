---
titre: Jeux de test à jour
statut: archivée
date: 2026-11-05
epic: ../epics/EPIC-044-jeux-de-test/README.md
---

# Jeux de test à jour

## Besoin

L'utilisatrice veut essayer tout ce qui a été construit, sur le site lui-même. Les trois jeux de test ne le permettent plus :

- **Dates figées.** Elles sont écrites en dur dans `prisma/seed.ts` : les sessions « à venir » de septembre et d'octobre 2026 sont passées, et le temps les périmera encore.
- **Données absentes.** Le script n'a pas suivi les fonctionnalités depuis mai 2026. Rien pour les inscriptions, le questionnaire, le tirage, les affinités, les relations, les tarifs et paiements, la présence, les envois, ni « Je participe ».
- **Personne d'autre à incarner.** Aucun compte ne permet de voir Limbus comme une co-organisatrice ou une personne qui participe.
- **Emails illisibles.** Les personnes fictives ont des adresses en `example.test`, qui ne reçoivent rien.
- **Effacement trop large.** Le script supprime sans demander confirmation, et il contient une adresse réelle alors que le dépôt est public.

## Proposition

Les mêmes trois jeux, chacun montrant une étape de la vie d'un jeu, avec des dates calculées à partir du jour du rechargement.

| Jeu | Étape | Ce qu'on y essaie |
|---|---|---|
| Station Meridian | Avant les sessions | page publique, périodes d'inscription, formulaire, qualité et conception du questionnaire, sélection, tirage, affinités, relations, assistant de casting |
| Les Cendres de Valombre | Session imminente | casting, équipe, tarifs, paiements, présence, documents, trombinoscopes, déroulé, co-organisation, assistant d'IA |
| Le Bal des Masques Brisés | Après et imprévus | session passée, annulée, reportée, remboursements, photos, legs |

Trois comptes de test s'ajoutent au compte de l'utilisatrice, qui reste propriétaire : une co-organisatrice et deux participantes. Le guide `doc/jeux-de-test.md` dit où essayer chaque fonctionnalité et avec quel compte.

Le détail technique est dans [ADR-0066](../../adr/ADR-0066-jeux-de-test-rechargeables-en-production.md).

## Découpage envisagé

Un epic, [EPIC-044](../epics/EPIC-044-jeux-de-test/README.md), en six US.

## Points à trancher

Aucun. Choix de l'utilisatrice, le 2026-11-05 :

- rechargement possible en production, et donc aussi en local ;
- un jeu par étape ;
- des comptes de test, avec un mot de passe gardé hors du dépôt ;
- quelques adresses seulement arrivent dans sa boîte : les comptes de test et trois personnes sans compte. Les autres restent en `example.test`.
