---
id: ADR-0065
titre: Nouveautés datées, une note par pull request, numéro de la pull request déployée
statut: accepté
date: 2026-11-05
liens: [SPEC-017, ADR-0017, ADR-0022, ADR-0023]
---

# ADR-0065 : Nouveautés datées, une note par pull request, numéro de la pull request déployée

## Contexte

Limbus est une application web hébergée, déployée à chaque fusion de code. Le build déployé est celui testé dans la pull request, donc construit avant la fusion ([ADR-0023](ADR-0023-deploiement-sans-ci-redondante.md)). Personne n'installe une version : chacun utilise la dernière. Le besoin est que les personnes sachent ce qui a changé, sans écart entre ce qui est dit et ce qui est en production.

L'état de l'art a été recherché le 2026-11-05. Aucune étude trouvée ne porte sur les notes ou les numéros de version d'une application web hébergée pour un public non technique ; seuls les abrégés ou extraits des études proches ont été lus. Les éléments utiles sont donc des pratiques observées et des avis de praticiens :

- [Linear](https://linear.app/changelog) et [GitHub](https://github.blog/changelog/) publient des entrées datées, sans numéro de version. C'est un petit échantillon.
- [Stripe](https://docs.stripe.com/changelog) date ses versions pour son API, dont dépendent des programmes, ce qui ne s'applique pas aux écrans de Limbus.
- [Herding Coders](https://www.herdingcoders.com/blog/a-guide-to-software-version-numbering-schemes/) décrit des numéros internes avec peu ou pas de numéro pour les utilisateurs, et note que signaler un problème devient plus difficile sans numéro visible. [WorkOS](https://workos.com/blog/software-versioning-guide) conseille de marquer chaque version, au moins en interne.
- [SemVer](https://semver.org/lang/fr/) exige de déclarer une API publique. Les études sur son respect portent sur des bibliothèques de code, et ne s'appliquent pas ici.

Le choix d'une note par pull request vient du fonctionnement de Limbus : c'est la seule façon de garder la page fidèle à la production. Les sources ne le tranchent pas.

## Décision

1. **Une note par fichier.** Chaque note est un fichier JSON de `nouveautes/` (`type`, `titre`, `texte`), ajouté dans la pull request du changement. Un fichier par note évite les conflits entre pull requests simultanées. Un test unitaire valide tous les fichiers avec un schéma zod. Le dossier n'étant ni `doc/` ni la racine, une note modifiée passe par la CI et se déploie ([ADR-0022](ADR-0022-pas-de-ci-pour-la-documentation.md)).
2. **La date vient de git.** Un module Nuxt (`modules/releaseNotes/`) prend au build l'heure du commit qui a ajouté le fichier (`git log --diff-filter=A`), et en affiche le jour à l'heure de Paris. Cette heure classe aussi les notes d'un même jour. Une fois fusionnée en squash, c'est le moment de la fusion. Le build de la pull request ne le connaît pas encore : sa note porte le jour de ce commit de branche jusqu'au déploiement suivant. On ne renomme pas un fichier de note. L'historique doit être lisible partout où l'on construit : le job de build de la CI récupère tout l'historique et déclare `safe.directory` avant le build, et `deploy.sh`, dont le dossier de build n'a pas de `.git`, indique le dépôt de `$APP_DIR`. CI et `deploy.sh` posent `NOUVEAUTES_DEPOT`, avec lequel le build échoue si l'historique manque ou est tronqué, pour ne jamais déployer de fausses dates ; ailleurs (poste de développement, conteneur de test), les notes prennent le jour du build.
3. **Le numéro est celui de la pull request déployée.** La CI le donne au build par une variable d'environnement non secrète (`NOUVEAUTES_PR`, tirée de `github.event.number`). Un build sur `main` (lancement manuel de la CI, `deploy.sh` à la main) le relit dans le titre du dernier commit, qui finit par `(#N)`, même si c'est une pull request de documentation : le numéro désigne toujours ce commit. Sans numéro, la page ne l'affiche pas.
4. **La revue vérifie la présence de la note.** Aucune règle automatique ne sait dire si un changement est visible. `CLAUDE.md` porte la règle ; `/code-review` applique ce fichier.

## Conséquences

- La page dit toujours ce qui est en production, et une note n'a rien à attendre.
- Le numéro affiché identifie ce qui tourne et renvoie à sa pull request, mais n'est pas un ordre : la #150 peut être fusionnée avant la #148. La date classe les notes.
- Si une pull request attend après le commit de sa note, celle-ci montre une date trop ancienne jusqu'au déploiement suivant. Le contenu reste juste.
- Une note oubliée en revue manque simplement à la page. La fusion suivante peut l'ajouter, avec la date de cette fusion.
- Il n'y a pas de grande version à annoncer. Un moment marquant passe par une note.

## Options écartées

- **Version sémantique (`1.4.2`)** : il faudrait trancher à chaque pull request lequel des trois chiffres augmenter, pour un public qui n'en tire rien.
- **Numéro daté (`2026.11.4`)** : il mêle une date et un compteur, sans qu'on voie où finit l'un et où commence l'autre.
- **Compteur de déploiements (`Version 143`)** : c'est un doublon du numéro de la pull request, à attribuer en plus au déploiement.
- **Versions regroupées et section « à venir »** : un changement serait en production avant sa note, écart que cette décision veut éviter.
- **`CHANGELOG.md` à la racine** : un fichier `.md` de la racine seul ne déploie rien, et un fichier unique crée des conflits entre pull requests.
- **Date écrite à la main dans la note** : elle resterait fausse si la fusion a lieu plus tard.
- **Étiquettes git et releases GitHub** : elles n'apportent rien aux personnes qui utilisent Limbus, et le numéro de la pull request identifie déjà le commit.
