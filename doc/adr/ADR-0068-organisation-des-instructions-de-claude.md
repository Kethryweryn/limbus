---
id: ADR-0068
titre: Instructions de Claude Code par thème, hook avant push et skill de documentation
statut: accepté
date: 2026-11-06
liens: [ADR-0067]
---

# ADR-0068 : Instructions de Claude Code par thème, hook avant push et skill de documentation

## Contexte

`CLAUDE.md` faisait 16,7 Ko, chargés à chaque session, dont 7,3 Ko de règles sur les routes API qui ne servent pas pour une PR de documentation ou d'interface. La [documentation de Claude Code](https://code.claude.com/docs/en/memory) indique qu'un fichier plus long coûte plus de contexte et que ses consignes sont moins bien suivies. Elle réserve les règles sans exception aux hooks, car `CLAUDE.md` reste un guide. Sur la PR #152, une erreur de type a pourtant été poussée malgré la consigne.

## Décision

1. **`CLAUDE.md`** garde ce qui sert à chaque tâche : documentation, nouveautés, jeux de test, vérifications, git et déploiement, et les renvois vers les règles.
2. **`.claude/rules/`** reçoit le reste, sans changer le texte, avec un champ `paths` qui ne charge chaque règle que pour les fichiers concernés :
   - `securite-api.md` : serveur, schéma et migrations, politique de confidentialité, `nuxt.config.ts`, tests d'intégration ;
   - `conventions-api.md` : serveur, pages et composables ;
   - `interface.md` : pages, composants et utilitaires de l'interface ;
   - `tests.md` : dossier `tests/`.
3. **`.claude/hooks/avant-push.mjs`**, hook `PreToolUse` : un `git push` qui contient du code est refusé tant que lint, typecheck ou tests unitaires échouent. Comme en CI, `doc/` et les `*.md` de la racine passent sans vérification. Les tests liés au changement restent une consigne (ADR-0067), car les choisir demande du jugement.
4. **`.claude/skills/cycle-documentation/`** décrit les étapes de la fiche à l'archive, et renvoie à `doc/README.md` pour le cycle lui-même.

## Conséquences

- Moins de contexte à chaque session, et les règles de sécurité sont présentes quand on touche au serveur.
- Une règle ne se charge qu'à la lecture ou à l'écriture d'un fichier concerné : `CLAUDE.md` nomme donc chaque règle, pour qu'on la lise avant de planifier.
- Un push de code prend le temps de ces vérifications.
- Le hook s'applique à toute personne qui fait confiance au dossier, et ne s'active qu'à l'ouverture d'une session.

## Options écartées

- **Imports `@` dans `CLAUDE.md`** : ils organisent le fichier sans réduire ce qui est chargé.
- **Hook sur la fin de chaque tour (`Stop`)** : il relancerait les vérifications après chaque réponse, y compris sans push.
- **Hook qui joue aussi Playwright** : il faudrait construire l'application à chaque push, et choisir les fichiers liés reste un jugement.
