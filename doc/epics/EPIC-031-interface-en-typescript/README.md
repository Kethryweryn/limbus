---
id: EPIC-031
titre: Interface en TypeScript strict
statut: en cours
spec: ../../todo/interface-en-typescript.md
date: 2026-11-02
---

# EPIC-031 : Interface en TypeScript strict

## Objectif

[Fiche](../../todo/interface-en-typescript.md) et revue d'architecture, R-10. Pages et composants passent en TypeScript strict. La vérification (`npm run typecheck`) contrôle alors aussi l'interface, et une route dont la réponse change casse la vérification des écrans qui la lisent.

## Décisions

- Les réponses de l'API sont déduites des routes Nitro, sans types écrits à la main.
- La vérification est stricte dès le départ : un fichier converti n'a pas de `any`.
- Une PR par domaine. Les plus gros écrans sont découpés en sous-composants au passage, sans changer ce qu'ils font.
- Une règle de lint exige TypeScript, sans `any`, dans les fichiers convertis. Elle s'étend à chaque lot, puis à toute l'interface.

## US

| US | Titre | Statut |
|---|---|---|
| [US-114](US-114-fondations.md) | Fondations : appels typés, mise en page, composants communs, pages d'accès | terminée |
| [US-115](US-115-ecriture.md) | Écriture du jeu : jeux, personnages, groupes, intrigues, objets, documents, lieux, timeline | terminée |
| [US-116](US-116-sessions.md) | Sessions : cast, déroulé, documents, paiements, présence | terminée |
| [US-117](US-117-inscriptions.md) | Inscriptions : périodes, formulaire, sélection, liens personnels | à faire |
| [US-118](US-118-compte-participation-administration.md) | Compte, « Je participe », administration, page publique ; règle étendue à tout | à faire |

## Définition de terminé

- `npm run lint`, `npm run typecheck`, `npm test` et la CI passent à chaque PR.
- Plus aucun `<script setup>` sans `lang="ts"`, et la règle de lint couvre toute l'interface.
- [ADR-0057](../../adr/ADR-0057-interface-en-typescript.md).
