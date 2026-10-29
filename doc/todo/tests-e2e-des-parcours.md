---
titre: Tests de bout en bout des parcours principaux
statut: à trancher
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

## Points à trancher

- Faut-il des données de départ communes (un jeu complet préparé une fois), ou chaque scénario crée-t-il les siennes ? Recommandation : un jeu commun créé par une fonction de préparation, chaque scénario ajoutant ce qui lui est propre.
- La durée de la CI : chaque scénario ajoute quelques secondes. Faut-il un plafond ?
