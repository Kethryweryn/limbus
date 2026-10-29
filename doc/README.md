# Documentation du projet

Toute évolution passe par ces documents, de l'idée à l'archive. La base grandit avec le projet : on y retrouve pourquoi les choses sont faites ainsi.

## Arborescence

| Dossier | Contenu | Nom des fichiers |
|---|---|---|
| [`todo/`](todo/README.md) | Fiches de proposition, pas encore engagées | `slug.md` |
| [`specs/`](specs/README.md) | Spécifications validées : ce que fait la fonctionnalité | `SPEC-NNN-slug.md` |
| [`epics/`](epics/README.md) | Découpage pour l'implémentation : un dossier par epic, une fiche par US | `EPIC-NNN-slug/README.md`, `EPIC-NNN-slug/US-NNN-slug.md` |
| [`adr/`](adr/README.md) | Décisions techniques (Architecture Decision Records) | `ADR-NNNN-slug.md` |
| [`revues/`](revues/README.md) | Constats datés sur l'ensemble du projet (architecture, sécurité), avec leurs recommandations | `AAAA-MM-JJ-sujet.md` |
| `archive/` | Fiches todo transformées en specs ou en revues, epics terminés | même nom, sous `archive/todo/` et `archive/epics/` |
| [`modeles/`](modeles/) | Gabarits de chaque type de fiche | |

## Cycle de vie

1. **Idée** : une fiche dans `todo/` (statut `brouillon`, puis `à trancher` tant que des questions restent ouvertes, puis `prête`).
2. **Spécification** : une fiche `prête` devient une `SPEC-NNN` dans `specs/`. La fiche todo part dans `archive/todo/`, avec un lien vers la spec.
3. **Découpage** : la spec est découpée en epics (un epic par lot livrable) et en US. Chaque décision technique prise en chemin fait l'objet d'un ADR.
4. **Implémentation** : les commits citent l'US (`US-012 : …`). Une US passe de `à faire` à `en cours` puis `terminée`, avec ses critères d'acceptation cochés et ses tests nommés.
5. **Archive** : un epic dont toutes les US sont terminées part dans `archive/epics/`. La spec reste dans `specs/` comme description à jour du fonctionnement ; on la modifie quand le comportement change.

Une spec qui décrit un comportement déjà en production (documentation de l'existant) n'a ni epic ni US : elle est `validée` dès sa PR. Quand une fiche donne plusieurs specs de ce type, elle reste dans `todo/` jusqu'à la dernière, puis part dans `archive/todo/` avec un lien vers chacune.

Une revue suit un chemin plus court : la fiche todo `prête` donne directement un rapport dans `revues/`, sans spec, et part dans `archive/todo/` avec un lien vers lui. Les recommandations triées deviennent des fiches todo ou des ADR.

Un ADR n'est jamais supprimé ni archivé : s'il est remis en cause, un nouvel ADR le remplace et l'ancien passe au statut `remplacé par ADR-NNNN`.

## Conventions

- Numéros séquentiels sur tout le projet, jamais réutilisés : le prochain numéro libre est celui qui suit le dernier de l'index.
- Chaque fiche commence par un en-tête YAML (`id`, `titre`, `statut`, `date`, liens) : les index se tiennent à partir de là.
- Chaque création, changement de statut ou archivage met à jour l'index du dossier dans le même commit.
- Les fiches se lient entre elles par chemin relatif (`../adr/ADR-0001-documentation-du-projet.md`).
- Rédaction en français, comme le code et l'interface.
