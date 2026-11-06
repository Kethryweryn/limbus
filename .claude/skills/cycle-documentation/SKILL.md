---
name: cycle-documentation
description: Fait avancer une évolution de Limbus dans sa documentation : créer une fiche, une spec, un epic et ses US, ou un ADR, passer une US à terminée, ou archiver un epic. À utiliser avant d'implémenter une demande, et à chaque changement de statut d'une de ces fiches.
---

# Cycle de documentation de Limbus

Le cycle et les conventions sont dans `doc/README.md`, les gabarits dans `doc/modeles/`. Lire les deux avant d'écrire. Rédiger en français, en langage simple.

## Prendre le bon numéro

Numéros séquentiels sur tout le projet, jamais réutilisés. Relever le plus grand existant, archives comprises :

- epics et US : `doc/epics/README.md` ;
- specs : `doc/specs/README.md` ;
- ADR : `doc/adr/README.md`.

## Créer

1. **Demande nouvelle** : une fiche dans `doc/todo/`, avec chaque choix de conception posé à l'utilisatrice en français simple. Aucun n'est tranché seul.
2. **Fiche prête** : une `SPEC-NNN` dans `doc/specs/`. La fiche part dans `doc/archive/todo/`, avec un lien vers la spec. Un chantier technique peut aller directement à un epic, avec sa fiche pour spec.
3. **Découpage** : un dossier `doc/epics/EPIC-NNN-slug/`, avec son `README.md` et une fiche par US. Un epic par lot livrable.
4. **Décision technique** : un ADR. On ne supprime jamais un ADR : on le remplace, et l'ancien le dit.

Dans la même PR, mettre à jour l'index de chaque dossier touché, et la feuille de route si une étape change.

## Terminer une US

Dans le commit d'implémentation, qui cite l'US : statut `terminée`, critères cochés, tests nommés, et ligne à jour dans le `README.md` de l'epic et dans `doc/epics/README.md`.

## Archiver un epic

Seulement après le déploiement, sur le feu vert de l'utilisatrice, dans une PR de documentation séparée :

1. `git mv doc/epics/EPIC-NNN-slug doc/archive/epics/EPIC-NNN-slug`.
2. Corriger les liens relatifs, qui gagnent un niveau.
3. Dans son `README.md` : statut `terminé`, section `## Suivi` avec le déploiement, ce que la revue a changé et les limites connues. S'en tenir à ce qui a été vérifié.
4. Mettre à jour `doc/epics/README.md`, la feuille de route, et la fiche d'origine.
5. Quand tous ses epics sont archivés, passer la spec à `implémentée`, dans `doc/specs/README.md` aussi, avec son `## Historique`.
6. Vérifier que chaque lien vers l'epic mène à un fichier existant.
