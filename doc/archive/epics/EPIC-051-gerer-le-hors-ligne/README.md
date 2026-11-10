---
id: EPIC-051
titre: Place prise, effacement et désactivation du hors ligne
statut: terminé
spec: ../../../specs/SPEC-019-hors-ligne-dans-le-compte.md
date: 2026-11-10
---

# EPIC-051 : Place prise, effacement et désactivation du hors ligne

## Objectif

Dans « Mon compte », une personne voit la place que prennent les données gardées sur son appareil, les efface sans se déconnecter, ou désactive le hors ligne sur un appareil prêté (SPEC-019, R1 à R7).

## US

| US | Titre | Statut |
|---|---|---|
| [US-223](US-223-voir-la-place-prise.md) | Voir la place que prennent les données hors ligne de mon appareil | terminée |
| [US-224](US-224-effacer-l-appareil.md) | Effacer les données hors ligne de mon appareil sans me déconnecter | terminée |
| [US-225](US-225-desactiver-le-hors-ligne.md) | Désactiver le hors ligne sur un appareil prêté | terminée |

## Définition de terminé

- Toutes les US terminées ; `npm run lint`, `npm run typecheck`, `npm test` et la CI passent.
- Spec à jour, ADR écrits pour les décisions prises ; tests de bout en bout sur les quatre axes (ADR-0079).
- Une note dans `nouveautes/` pour chaque PR.

## Suivi

- 2026-11-10 : déployé en deux PR, vérifiées en production (sites joignables, notes dans /nouveautes) : US-223 à US-225 (#202), puis un correctif de l'US-223, la section affichée sans réseau (#203), trouvé en préparant le cahier de tests.
- La revue a ajouté : rechargement de la page après la désactivation (l'application retirée la contrôlait encore), taille des photos envoyée par le serveur, un seul envoi de la file à la fois, réglage suivi dans les autres onglets.
- En route : désactivé, l'identité reste en mémoire le temps de la page ouverte, pour qu'une coupure de réseau ne la ferme pas ; l'inscription du service worker passe par `plugins/serviceWorker.client.ts`.
- Epic archivé.
