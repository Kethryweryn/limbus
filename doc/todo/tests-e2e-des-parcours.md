---
titre: Tests de bout en bout des parcours principaux
statut: tranchée
date: 2026-10-29
revue: ../revues/2026-10-29-architecture.md
---

# Tests de bout en bout des parcours principaux

## Besoin

Les 9 scénarios Playwright couvrent la connexion, la déconnexion, le 403, la page publique et le legs (revue d'architecture, R-14). Les parcours les plus utilisés pour préparer un GN ne sont vérifiés dans un vrai navigateur par aucun test. Ces parcours sont : le casting d'une session, la génération des trombinoscopes, l'envoi des documents et le suivi des inscriptions. Leurs routes sont couvertes par les tests d'intégration, mais pas l'interface.

## Proposition

Un scénario Playwright par parcours, contre l'application compilée et la base de test, comme les scénarios existants :

1. Casting : créer une session, y affecter des participants à des personnages.
2. Trombinoscopes : générer ceux d'une session et ouvrir le PDF.
3. Envoi des documents : envoyer à la session, vérifier l'email reçu par le serveur SMTP de test.
4. Inscriptions : ouvrir une période, inviter, répondre par le lien personnel, voir la réponse dans le suivi.

## Découpage envisagé

Une PR par scénario, ou deux PR (sessions, inscriptions).

## Décisions

Le 29 octobre 2026, avec l'utilisatrice :

- un jeu de test commun, préparé une fois au démarrage des tests ; chaque test y ajoute ce dont il a besoin ([ADR-0037](../adr/ADR-0037-jeu-commun-des-tests-de-bout-en-bout.md)) ;
- pas de plafond de durée : la durée de la CI est surveillée ;
- parcours couverts : casting, trombinoscopes, envoi des documents, paiements, et la page de session hors ligne. Le parcours d'inscription sur invitation a déjà son test (`registration.spec.ts`).

Réalisée par [EPIC-011](../epics/EPIC-011-tests-e2e-des-parcours/README.md).
