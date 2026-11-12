---
id: EPIC-056
titre: Une fiche par personne dans tout Limbus
statut: terminé
spec: ../../../specs/SPEC-022-compte-pour-chaque-participant.md
date: 2026-11-11
---

# EPIC-056 : Une fiche par personne dans tout Limbus

## Objectif

Lot 1 de [SPEC-022](../../../specs/SPEC-022-compte-pour-chaque-participant.md) : une adresse n'a qu'une fiche dans tout Limbus, chaque équipe n'en voyant que ses jeux et ses propres nom et téléphone ; email obligatoire ; fusion des fiches existantes ; effacement et export par équipe.

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

## Suivi

- 2026-11-11 au 2026-11-12 : déployé en onze PR, chacune vérifiée en production (sites joignables, /nouveautes) : #228 à #230 (US-237), #231 (US-238), #232 et #233 (US-239), #234 (US-240), #235 (US-241), #236 (US-243), #237 et #238 (US-242, en deux temps : le code cesse de lire les colonnes, puis elles disparaissent).
- Une adresse n'a plus qu'une fiche dans tout Limbus ; le nom et le téléphone vivent sur le lien de la fiche à chaque jeu, et une équipe ne lit jamais ceux d'une autre ([ADR-0086](../../../adr/ADR-0086-fiche-unique-et-valeurs-par-jeu.md)). Une autre adresse donnée en réponse se prouve par un lien ([ADR-0087](../../../adr/ADR-0087-preuve-d-une-autre-adresse.md)).
- Les revues ont fait : une adresse de page neutre, fixée à la création ; garder l'adresse jusqu'à la preuve, sous verrou ; détacher, à l'effacement, les affinités des autres ; ne rien révéler de l'existence d'une autre fiche ; limiter le renvoi du lien de preuve ; laisser à une fiche tenue par la personne les valeurs de chaque jeu ; exporter le nom et le téléphone de chaque jeu ; contrôler par Prisma les sélections rangées en constantes.
- Limites connues : une personne connue sous deux adresses garde deux fiches (hors périmètre de SPEC-022) ; le jeu de test « Le Carnet d'Inès » n'apparaît en production qu'au prochain rechargement des jeux de test, fait à la demande.
- Epic archivé ; SPEC-022 : lot 1 terminé, lots 2 et 3 à découper.
