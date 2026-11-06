---
id: EPIC-048
titre: Casting depuis le vivier
statut: en cours
spec: ../../specs/SPEC-018-vivier-permanent.md
date: 2026-11-06
---

# EPIC-048 : Casting depuis le vivier

## Objectif

L'assistant part des pré-inscrits, l'équipe garde la main sur chaque email, elle est prévenue des réponses modifiées, et le parcours complet se lit jusqu'à « inscrite validée ».

## US

| US | Titre | Statut |
|---|---|---|
| [US-170](US-170-assistant-sur-les-pre-inscrits.md) | Proposer le casting parmi les pré-inscrits | terminée |
| [US-172](US-172-annoncer-le-casting.md) | Annoncer le casting, puis écrire au cas par cas | terminée |
| [US-173](US-173-reponses-modifiees.md) | Être prévenue quand une personne castée change ses réponses | terminée |
| [US-174](US-174-parcours-complet.md) | Lire le parcours complet d'une personne | terminée |
| [US-175](US-175-retirer-l-ancien-modele.md) | Retirer l'ancien modèle des inscriptions | à faire |

## Définition de terminé

- Toutes les US terminées ; `npm run lint`, `npm run typecheck`, `npm test` et la CI passent.
- Spec à jour, ADR écrits pour les décisions prises.
- Seconde migration d'ADR-0069 faite, ancien modèle retiré, SPEC-001 et ADR-0046 à ADR-0048 mis à jour.
- Les jeux de test (`prisma/seed/`) et `doc/jeux-de-test.md` couvrent ce que le lot ajoute, dans la même PR.
