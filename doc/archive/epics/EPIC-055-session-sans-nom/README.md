---
id: EPIC-055
titre: Une session sans nom, désignée par sa date
statut: terminé
spec: ../../../specs/SPEC-021-session-sans-nom.md
date: 2026-11-11
---

# EPIC-055 : Une session sans nom, désignée par sa date

## Objectif

Une session n'a plus de nom à saisir : Limbus la désigne par sa date, avec l'heure ou le lieu en cas de doublon, et le jeu devant hors des pages du jeu ([SPEC-021](../../../specs/SPEC-021-session-sans-nom.md)).

## US

| US | Titre | Statut |
|---|---|---|
| [US-234](US-234-libelle-calcule.md) | Une session désignée par sa date, sans nom à saisir | terminée |
| [US-235](US-235-jeu-devant-le-libelle.md) | Le jeu devant le libellé, hors des pages du jeu | terminée |
| [US-236](US-236-supprimer-la-colonne-du-nom.md) | Supprimer la colonne du nom des sessions | terminée |

## Définition de terminé

- Toutes les US terminées ; `npm run lint`, `npm run typecheck`, `npm test` et la CI passent.
- Spec à jour, ADR écrits pour les décisions prises.

## Suivi

- 2026-11-11 : déployé en trois PR, chacune vérifiée en production (sites joignables, note dans /nouveautes) : #217 (libellé calculé à la lecture, colonne du nom rendue facultative), #218 (colonne supprimée), #219 (le jeu devant le libellé dans les emails et PDF).
- En route, les empreintes qui disent si une fiche ou un trombinoscope envoyé est dépassé ne portent plus que leur contenu : ni libellé de session, ni titre du jeu ([ADR-0084](../../../adr/ADR-0084-libelle-de-session-a-la-lecture.md)).
- Les revues ont fait relire le libellé aux sélections Prisma gardées dans des constantes, qui lisaient encore le nom, fait rendre le libellé seul quand le jeu n'est pas connu, et fait tester l'objet et le texte des emails de fiche, de trombinoscope et de paiement.
- Limites connues : les anciens noms sont oubliés ; les sessions des jeux de test ont des dates fixes, et le jeu de test se recharge à la demande quand les dates passées doivent être rejouées.
- Epic archivé ; SPEC-021 implémentée.
