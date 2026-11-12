---
id: EPIC-056
titre: Une fiche par personne dans tout Limbus
statut: en cours
spec: ../../specs/SPEC-022-compte-pour-chaque-participant.md
date: 2026-11-11
---

# EPIC-056 : Une fiche par personne dans tout Limbus

## Objectif

Lot 1 de [SPEC-022](../../specs/SPEC-022-compte-pour-chaque-participant.md) : une adresse n'a qu'une fiche dans tout Limbus, chaque équipe n'en voyant que ses jeux et ses propres nom et téléphone ; email obligatoire ; fusion des fiches existantes ; effacement et export par équipe.

## US

| US | Titre | Statut |
|---|---|---|
| [US-237](US-237-valeurs-par-jeu.md) | Le nom et le téléphone saisis par jeu | terminée |
| [US-238](US-238-email-obligatoire.md) | L'email obligatoire sur une fiche | terminée |
| [US-239](US-239-une-fiche-par-adresse.md) | Une fiche par adresse dans tout Limbus | terminée |
| [US-240](US-240-fusion-des-fiches.md) | Fusionner les fiches d'une même adresse | terminée |
| [US-241](US-241-effacement-et-export-par-equipe.md) | Effacer et exporter ce qui concerne son équipe | terminée |
| [US-242](US-242-retirer-nom-et-telephone-de-la-fiche.md) | Retirer le nom et le téléphone de la fiche | terminée |
| [US-243](US-243-prouver-une-autre-adresse.md) | Prouver une autre adresse donnée en réponse, puis réunir les deux fiches | terminée |

Ordre : US-237 et US-238, puis US-239, US-240 (migration après le déploiement d'US-239), US-241, et US-242 en dernier (ADR-0024).

## Définition de terminé

- Toutes les US terminées ; `npm run lint`, `npm run typecheck`, `npm test` et la CI passent.
- Spec à jour, ADR écrits pour les décisions prises.
