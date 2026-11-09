# Limbus

Outil d'organisation de GN (Nuxt 4, Nuxt UI 4, Prisma 7 / PostgreSQL). Contexte produit : README.md ; installation, variables et commandes : doc/developpement.md. Le code et l'interface sont en français.

## Documentation (`doc/`)

Toute évolution suit le cycle décrit dans `doc/README.md` : fiche `doc/todo/` → `SPEC-NNN` → epics et `US-NNN` → archive.

- Une nouvelle idée ou demande de fonctionnalité devient d'abord une fiche todo (modèles dans `doc/modeles/`).
- Toute décision technique (modèle de données, algorithme, bibliothèque, sécurité) fait l'objet d'un ADR dans `doc/adr/`. On ne supprime pas un ADR, on le remplace.
- Les commits d'implémentation citent l'US ; l'US et l'index sont mis à jour dans le même commit. Exception : un correctif ou un nettoyage sans changement de comportement (revue de code, recommandation d'une revue, dépendances) n'a pas d'US ; il cite sa source (fiche, revue, PR).
- Avant de travailler sur une fonctionnalité, lire sa spec et les ADR liés. Chaque dossier a un index `README.md` : le tenir à jour.
- Pour créer une fiche, une spec, un epic ou un ADR, ou archiver un epic : skill `cycle-documentation`.

## Nouveautés

Une PR qui change ce qu'une personne voit ou peut faire, correction d'un défaut rencontré comprise, ajoute sa note dans `nouveautes/` : un fichier JSON (`type` : `nouveau`, `modifie`, `corrige` ou `retire` ; `titre` ; `texte`), en français, pour les personnes qui utilisent Limbus, sans vocabulaire technique, ni donnée personnelle, ni détail du serveur ou d'une faille. La revue de code le vérifie. On ne renomme pas une note : sa date vient du commit qui l'a ajoutée (SPEC-017, ADR-0065).

## Jeux de test

Une fonctionnalité qui ajoute une donnée à essayer complète `prisma/seed/` et `doc/jeux-de-test.md` dans la même PR (ADR-0066). `tests/integration/seed.test.ts` lance le script : il casse la CI s'il ne suit plus le schéma. Le déploiement ne le lance jamais ; le rechargement en production se fait seulement à la demande de l'utilisatrice, car il remplace les trois jeux.

## Avant de considérer un changement terminé

Avant chaque push de code, correction de revue comprise (ADR-0067) :

- `npm run lint`, `npm run typecheck` et `npm test` passent ; lire leur résultat.
- Les tests liés au changement passent : relever les écrans, routes et utilitaires touchés, puis jouer les fichiers Playwright et d'intégration qui les couvrent, pas seulement les tests ajoutés. Sous Windows, le build échoue au prérendu : passer par le conteneur Linux (voir `.claude/rules/tests.md`). Si ces tests ne peuvent pas tourner, le dire et demander avant de pousser.

Tests à écrire (ADR-0079) : une PR qui ajoute ou change ce qu'une personne voit ou peut faire ajoute ses tests Playwright sur quatre axes : actions, erreurs de saisie, droits, hors ligne. Les tests portent sur ce qui est ajouté ou changé. Un axe qui ne s'applique pas est écrit dans l'US (ou, pour un correctif sans US, dans la description de la PR), avec sa raison. La revue de code le vérifie.

`.claude/hooks/avant-push.mjs` refuse un `git push` de code tant que le premier point échoue (ADR-0068). Une PR de documentation seule vérifie ses liens. La CI de la PR joue ensuite la suite complète (ADR-0023) : inutile de la relancer entière en local.

Revue de code : chaque PR passe par `/code-review`. Tout constat se corrige, nettoyages compris (réutilisation, simplification, efficacité), même dans du code antérieur à la PR. Aucun constat n'est écarté sans l'accord explicite de l'utilisatrice ; un constat jugé faux lui est présenté avec sa raison.

On ne pousse jamais directement sur `main` (ADR-0017) : chaque chantier a sa branche (`us/…`, `doc/…`, `fix/…`, `deps/…`) et sa pull request, qui cite ses US, specs et ADR. On fusionne en squash une PR dont la CI est verte ; GitHub l'impose, et exige une branche à jour avec `main` (ADR-0023). La CI de la PR construit l'application dans un conteneur Debian 12 + Node 24 (comme le serveur), la teste et archive ce build ; la seule vérification exigée est « Verdict CI ». La fusion dans `main` ne relance pas la CI : **le build testé est déployé aussitôt en production** (job `deploy`, qui l'envoie à `deploy.sh <sha>` sur le serveur ; lancé à la main, `deploy.sh` reconstruit sur place). Fusionner une PR est donc une mise en production. Une PR qui ne touche que `doc/` ou les `*.md` de la racine passe sa CI sans rien exécuter et ne déploie rien (ADR-0022, ADR-0023). Si aucune archive testée ne correspond à `main` (archive expirée…), lancer le workflow CI à la main sur `main` : il construit, teste et déploie. Une migration ne doit pas casser le build encore en service pendant le déploiement : la CI refuse suppressions, renommages, `SET NOT NULL` et changements de type, sauf commentaire `-- deploiement-incompatible : <raison>` (ADR-0024).

## Règles par domaine

Chargées avec les fichiers concernés. À lire avant de planifier un changement dans ces domaines :

| Règle | Domaine |
|---|---|
| `.claude/rules/securite-api.md` | Routes, droits, données personnelles, fichiers téléversés, assistants d'IA |
| `.claude/rules/conventions-api.md` | Slugs, identifiants, écritures concurrentes |
| `.claude/rules/interface.md` | Nuxt UI, TypeScript strict, hors ligne |
| `.claude/rules/tests.md` | Scénarios et lancement des tests d'intégration, Playwright, Vitest, Dependabot |
