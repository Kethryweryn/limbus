---
id: EPIC-011
titre: Tests de bout en bout des parcours
statut: terminé
spec: ../../todo/tests-e2e-des-parcours.md
date: 2026-10-29
---

# EPIC-011 : Tests de bout en bout des parcours

## Objectif

Vérifier dans un vrai navigateur, à chaque PR, les parcours les plus utilisés pour préparer un GN : casting, trombinoscopes, envoi des documents, paiements et page de session hors ligne. Réalise la fiche [Tests de bout en bout des parcours](../../todo/tests-e2e-des-parcours.md) (revue d'architecture, R-14) ; ces tests ne changent aucun comportement, d'où l'absence de spec.

## US

| US | Titre | Statut |
|---|---|---|
| [US-053](US-053-test-du-casting.md) | Test de bout en bout du casting | terminée |
| [US-054](US-054-test-des-trombinoscopes.md) | Test de bout en bout des trombinoscopes | terminée |
| [US-055](US-055-test-de-l-envoi-des-documents.md) | Test de bout en bout de l'envoi des documents | terminée |
| [US-056](US-056-test-des-paiements.md) | Test de bout en bout des paiements | terminée |
| [US-057](US-057-test-de-la-session-hors-ligne.md) | Test de bout en bout de la session hors ligne | terminée |

## Définition de terminé

- Toutes les US terminées ; la CI passe.
- Tests passés en local (conteneur Playwright, 16 sur 16 en 38 s) et en CI.
- [ADR-0037](../../../adr/ADR-0037-jeu-commun-des-tests-de-bout-en-bout.md).
