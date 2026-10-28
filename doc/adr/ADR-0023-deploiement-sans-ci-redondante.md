---
id: ADR-0023
titre: Déployer à la fusion sans relancer la CI, et réutiliser les dépendances du serveur
statut: accepté
date: 2026-10-28
liens: [ADR-0002, ADR-0017, ADR-0022, ADR-0015]
---

# ADR-0023 : Déployer à la fusion sans relancer la CI, et réutiliser les dépendances du serveur

## Contexte

Le 2026-10-28, livrer US-004 a demandé plus de 12 minutes entre l'ouverture de la PR et la mise en production. Les horodatages de GitHub donnent :

- CI de la PR : 2 min 30 ;
- CI sur `main` après la fusion : 2 min ;
- déploiement : 3 min 20.

Le reste vient du temps de surveillance entre les étapes.

La CI sur `main` reteste le code que la PR vient de valider. [ADR-0017](ADR-0017-branches-et-pull-requests.md) la gardait parce que `main` peut avoir avancé entre la CI de la PR et sa fusion. Il notait aussi que rien n'impose techniquement la CI avant une fusion.

Le déploiement se décompose ainsi :

- connexion et récupération du commit : 6 s ;
- `npm ci` complet : 52 s ;
- génération du client Prisma : 7 s ;
- build Nuxt : 1 min 58 s ;
- migrations et redémarrage : 12 s.

Les dépendances sont réinstallées à chaque déploiement, même quand `package-lock.json` n'a pas changé.

L'application reste construite sur le serveur, et pas dans la CI : c'est le build de l'environnement réel (Node système, système, chemins) qui doit être vérifié, et `deploy.sh` protège déjà la production si ce build échoue. Le build de la CI reste nécessaire : les tests d'intégration et Playwright tournent sur l'application compilée ([ADR-0015](ADR-0015-strategie-de-tests.md)).

## Décision

1. **Protection de la branche `main` dans GitHub** :
   - fusion par pull request uniquement ;
   - vérification `check` obligatoire ;
   - branche à jour avec `main` avant la fusion ;
   - règles appliquées aussi aux administrateurs.

   Le code fusionné est donc exactement celui que la CI de la PR a testé.
2. **Plus de CI sur `main`** : le push sur `main` lance seulement le job `deploy`. Une PR qui ne touche que la documentation ne déploie toujours rien (`paths-ignore` sur le push, [ADR-0022](ADR-0022-pas-de-ci-pour-la-documentation.md)).
3. **Filtre de documentation à l'intérieur du workflow pour les PR** : la vérification `check` étant obligatoire, une PR de documentation doit la recevoir. Un job `changes` compare la PR à sa base. Si seuls `doc/**` ou des `*.md` de la racine changent, le job `check` est ignoré, et GitHub compte un job ignoré comme réussi. Cela remplace le `paths-ignore` de l'ADR-0022 pour les PR, comme cet ADR le prévoyait.
4. **Réutilisation des dépendances sur le serveur** : `deploy.sh` garde une empreinte de `package-lock.json` et de la version de Node. Si l'empreinte n'a pas changé, il reprend le `node_modules` en place par liens physiques (`cp -al`, même système de fichiers) au lieu de lancer `npm ci`. Le client Prisma et le build sont toujours refaits.

## Conséquences

- De la fusion à la production : environ 2 min 30 au lieu de 5 min 30.
- Une PR en retard sur `main` doit être mise à jour avant la fusion (« Update branch » ou `gh pr update-branch`), ce qui relance sa CI. Les PR Dependabot aussi.
- Plus aucun push direct sur `main`, même par un administrateur : l'ADR-0017 est désormais imposé par GitHub.
- La CI de `main` ne sert plus de filet si la protection est désactivée un jour. Dans ce cas, il faut rétablir le job `check` sur `main`.
- Une dépendance corrompue dans le `node_modules` du serveur serait reprise d'un déploiement à l'autre. Pour forcer une réinstallation propre, il suffit de supprimer l'empreinte `node_modules/.limbus-deps-stamp`. Une mise à jour de Node la renouvelle d'elle-même.
- Le premier déploiement après ce changement utilise encore l'ancien `deploy.sh` : le script en cours d'exécution est celui d'avant la mise à jour du dépôt.
- Le build lui-même reste la plus longue étape, à environ 2 minutes. Le réduire (prérendu, ressources du serveur) est un chantier à part.

## Options écartées

- **Construire dans la CI et déployer ce build** : déploiement plus court, mais le build ne serait plus vérifié dans l'environnement de production. L'utilisateur préfère construire sur le serveur.
- **Garder la CI sur `main`** : 2 minutes par livraison pour retester un code identique, une fois la branche obligatoirement à jour.
- **Fusion automatique de GitHub** : supprimerait le temps de surveillance, mais elle n'est pas activée sur le dépôt. C'est une décision à part.
- **Copier `node_modules` (`cp -a`)** : 900 Mo à copier à chaque déploiement, alors que les liens physiques sont quasi instantanés.
