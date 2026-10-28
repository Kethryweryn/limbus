---
id: ADR-0023
titre: Construire une fois dans la CI, tester ce build, le déployer tel quel
statut: accepté
date: 2026-10-28
liens: [ADR-0002, ADR-0017, ADR-0022, ADR-0015, ADR-0004]
---

# ADR-0023 : Construire une fois dans la CI, tester ce build, le déployer tel quel

## Contexte

Le 2026-10-28, livrer US-004 a demandé plus de 12 minutes entre l'ouverture de la PR et la mise en production. Les horodatages de GitHub donnent :

- CI de la PR : 2 min 30 ;
- CI sur `main` après la fusion : 2 min ;
- déploiement : 3 min 20.

Le reste vient du temps de surveillance entre les étapes.

L'application était construite trois fois :

- en local, pour les tests d'intégration ;
- dans la CI ;
- sur le serveur.

Sur le serveur, le déploiement se décompose ainsi :

- connexion et récupération du commit : 6 s ;
- `npm ci` : 52 s ;
- client Prisma : 7 s ;
- build : 1 min 58 s ;
- migrations et redémarrage : 12 s.

La production tournait donc sur un build que personne n'avait testé : les tests portaient sur celui de la CI.

La pratique recommandée est inverse. On construit une fois, on teste ce build, et on déploie exactement ce qui a été testé, avec la configuration propre à l'environnement lue au démarrage ([OneUptime](https://oneuptime.com/blog/post/2026-07-28-build-once-promote-everywhere/view), [Barking Iguana](https://barkingiguana.com/writing/promoting-an-artefact-without-rebuilding-it/)). Limbus lit déjà ses secrets au démarrage ([ADR-0004](ADR-0004-secrets-a-l-execution.md)).

Une crainte demeurait : un build fait ailleurs se comporte-t-il pareil sur le serveur ? Elle est fondée. Le runner GitHub est sous Ubuntu 24.04, le serveur sous Debian 12 (glibc 2.36, Node 24 système). Le build contient un module natif, `bcrypt`, compilé pour une glibc donnée.

Autre point : une vérification obligatoire nourrie par un job qui peut être ignoré donne un faux vert si le filtre se trompe ou échoue. La recommandation est qu'un feu vert soit une affirmation explicite ([Mergify](https://mergify.com/blog/path-filters-are-not-a-ci-gate), [discussion GitHub](https://github.com/orgs/community/discussions/44490)).

## Décision

1. **Build dans le même environnement que le serveur** : le job `check` de la CI tourne dans un conteneur `node:24-bookworm` (Debian 12, Node 24), avec PostgreSQL en service. Il construit l'application puis lance les tests unitaires, d'intégration et Playwright sur ce build.
2. **Archive du build testé** : seulement si tous les tests passent, `check` archive `.output`. L'archive porte :
   - l'arbre Git testé (`BUILD_TREE`) ;
   - la version de Node (`BUILD_NODE`).
3. **Verdict unique** : un job `Verdict CI` tourne toujours, lit le résultat des autres et n'est vert que si :
   - la détection des changements a réussi ;
   - les tests ont réussi, ou, pour une PR de documentation seule, n'ont pas été lancés.

   C'est la seule vérification exigée par la protection de `main`.
4. **Protection de la branche `main` dans GitHub** :
   - fusion par pull request uniquement ;
   - vérification `Verdict CI` obligatoire ;
   - branche à jour avec `main` avant la fusion ;
   - règles appliquées aussi aux administrateurs.
5. **Déploiement sans nouvelle CI** : le push sur `main` lance seulement le job `deploy`.
   - Il retrouve la PR fusionnée, puis la dernière CI réussie de son dernier commit, et télécharge l'archive.
   - Il refuse une PR venue d'un fork.
   - Il refuse une archive dont l'arbre Git n'est pas celui de `main`.
   - Il envoie l'archive au serveur sur l'entrée standard de la connexion SSH, toujours restreinte à `deploy.sh`.
6. **Côté serveur**, `deploy.sh`, appelé par la CI :
   - avance le dépôt jusqu'au commit ;
   - vérifie à son tour l'arbre Git, et que la version majeure de Node du build est celle du service ;
   - applique les migrations, bascule `.output` et redémarre.

   Il ne construit plus rien. Les dépendances du serveur, qui servent aux migrations et aux scripts, sont reprises par liens physiques quand `package-lock.json` et Node n'ont pas changé. Lancé à la main, sans archive, il reconstruit sur le serveur comme avant : c'est la voie de secours.
7. **Documentation seule** : `check` n'est pas lancé sur la PR (le verdict le constate), et la fusion ne déploie rien (`paths-ignore` sur le push, [ADR-0022](ADR-0022-pas-de-ci-pour-la-documentation.md)).
8. **Plus de build local** avant d'ouvrir une PR : lint, typecheck et tests unitaires suffisent en local, la CI de la PR fait le reste.

## Conséquences

- Ce qui part en production est exactement ce qui a été testé, construit dans le même système que le serveur.
- De la fusion à la production, il reste le téléchargement de l'archive, les migrations et le redémarrage : moins d'une minute attendue, contre 5 min 30.
- La CI de PR prend quelques dizaines de secondes de plus : téléchargement du conteneur, installation des dépendances système de Chromium.
- Une PR en retard sur `main` doit être mise à jour avant la fusion (« Update branch » ou `gh pr update-branch`), ce qui relance sa CI. Les PR Dependabot aussi.
- Plus aucun push direct sur `main`, même par un administrateur : l'[ADR-0017](ADR-0017-branches-et-pull-requests.md) est désormais imposé par GitHub.
- La confiance passe du serveur à la CI. Un build archivé par la CI part en production sans être reconstruit. La clé de déploiement reste restreinte à `deploy.sh`, et le serveur revérifie l'arbre Git et la version de Node.
- Les archives sont gardées 14 jours. Fusionner une PR dont la CI est plus ancienne fait échouer le déploiement. Il faut alors mettre la PR à jour pour relancer sa CI avant la fusion, ou, une fois fusionnée, déployer à la main sur le serveur.
- Une mise à jour majeure de Node sur le serveur (paquet NodeSource) bloque le déploiement tant que le conteneur de la CI n'est pas aligné. C'est voulu.
- Le premier déploiement après ce changement utilise encore l'ancien `deploy.sh`, qui reconstruit sur le serveur : le script en cours d'exécution est celui d'avant la mise à jour du dépôt.

## Options écartées

- **Reconstruire sur le serveur** (fonctionnement précédent) : la production tournait sur un build non testé, et le build prenait 2 minutes sur un serveur partagé.
- **Construire sur le runner Ubuntu et déployer** : risque d'incompatibilité du module natif `bcrypt` avec la glibc plus ancienne de Debian 12.
- **Reconstruire dans la CI sur `main` après la fusion** : retour d'un build non testé, ou d'un second passage des tests.
- **Rendre obligatoires les jobs `changes` et `check`** : un job ignoré compte comme réussi. Le verdict unique est plus lisible, et ne dépend pas des noms des autres jobs.
- **File de fusion (merge queue)** : utile quand beaucoup de PR arrivent en même temps. Pour un seul développeur, exiger une branche à jour suffit ([Earthly](https://earthly.dev/blog/merge-queues/)).

## Complément du 2026-10-28 (revue de code)

- `deploy.sh` vérifie l'archive (arbre Git du commit visé, version de Node) **avant** d'avancer le dépôt du serveur : un refus le laisse exactement dans son état. Les fichiers de travail sont effacés à la sortie, et l'archive reçue est limitée à 200 Mo.
- Le job `deploy` choisit, parmi les CI réussies du dernier commit de la PR, celle dont l'archive porte l'arbre de `main`.
- Secours : lancer le workflow à la main sur `main` (« Run workflow ») construit, teste et déploie `main` quand aucune archive de PR ne convient (archive expirée, fusion sans PR à jour).
- Les migrations sont contrôlées par la CI avant la fusion ([ADR-0024](ADR-0024-migrations-compatibles-avec-le-build-en-service.md)).

