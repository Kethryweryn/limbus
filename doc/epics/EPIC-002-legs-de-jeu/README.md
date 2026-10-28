---
id: EPIC-002
titre: Léguer une copie d'un jeu à une autre équipe
statut: en cours
spec: ../../specs/SPEC-002-copie-de-jeu.md
date: 2026-10-28
adr: [ADR-0025]
---

# EPIC-002 : Léguer une copie d'un jeu à une autre équipe

## Objectif

Une propriétaire lègue une copie de son jeu à une autre organisatrice, qu'elle ait déjà un compte Limbus ou non. La copie reprend le contenu d'écriture, les photos de trombinoscope et le formulaire d'inscription, et elle porte un crédit vers le jeu source. Le jeu source n'est pas modifié.

Règles couvertes : R1 à R14 de [SPEC-002](../../specs/SPEC-002-copie-de-jeu.md).

## US

| US | Titre | Statut |
|---|---|---|
| [US-010](US-010-leguer-a-un-compte-existant.md) | Léguer une copie à une organisatrice qui a un compte | terminée |
| [US-011](US-011-leguer-sans-compte.md) | Léguer une copie à une personne sans compte | à faire |
| [US-012](US-012-suivre-les-legs-en-attente.md) | Suivre et annuler les legs en attente | à faire |

Ordre : US-010, puis US-011, puis US-012. Chaque US fait l'objet d'une PR ([ADR-0017](../../adr/ADR-0017-branches-et-pull-requests.md)).

## Définition de terminé

- Toutes les US terminées ; `npm run lint`, `npm run typecheck`, `npm test` et la CI passent.
- Les nouvelles routes figurent dans `tests/integration/isolation.test.ts`. Une copie en attente n'est visible ni par la propriétaire du jeu source, ni en mode administrateur, ni par une autre organisatrice.
- Un test d'intégration vérifie qu'une copie est complète et indépendante : mêmes contenus, aucun identifiant ni fichier partagé avec le jeu source, et la suppression du jeu source ne touche pas la copie.
- Un test Playwright couvre le legs à un compte existant : legs depuis la fiche, puis copie visible chez la destinataire avec son crédit.
- SPEC-002 est à jour, et ADR-0025 est passé de `proposé` à `accepté`, ou remplacé.
