---
id: SPEC-017
titre: Nouveautés et numéro de déploiement
statut: en cours
date: 2026-11-05
origine: ../archive/todo/versions-et-notes-de-version.md
epics: [EPIC-043]
adr: [ADR-0023, ADR-0065]
---

# SPEC-017 : Nouveautés et numéro de déploiement

## Objectif

Chaque fusion de code part en production ([ADR-0023](../adr/ADR-0023-deploiement-sans-ci-redondante.md)) sans que les personnes qui utilisent Limbus sachent ce qui a changé. Cette spec leur donne une page « Nouveautés » toujours fidèle à ce qui est en production : la note arrive avec le changement qu'elle décrit, jamais après.

Limbus n'a pas de numéro de version à annoncer : personne n'installe une version, et chacun utilise la dernière. Pour signaler un problème, le numéro de la pull request déployée suffit à retrouver exactement ce qui tourne. Le raisonnement et ses sources sont dans [ADR-0065](../adr/ADR-0065-nouveautes-et-numero-de-deploiement.md).

## Acteurs et parcours

**Une personne qui utilise Limbus**

1. Elle voit le lien « Nouveautés » en bas du menu, plus petit et séparé du reste.
2. Elle lit les notes, les plus récentes d'abord, chacune avec sa date, son type et son titre.
3. Pour signaler un problème, elle peut donner le numéro affiché en bas de la page.

**Une personne sans compte** ouvre la même page par son adresse. Elle n'a pas de lien de menu.

**La personne qui prépare une pull request**

1. Si le changement est visible (R3), elle ajoute sa note dans la pull request.
2. La note est relue en revue avec le reste.
3. La fusion déploie le changement et sa note ensemble.

## Règles métier

- **R1** La page `/nouveautes` est publique, sans compte, comme les mentions légales.
- **R2** Une note a une date, un type (nouveau, modifié, corrigé ou retiré), un titre et un texte court, écrits en français pour les personnes qui utilisent Limbus, sans vocabulaire technique. Ce n'est pas un journal de commits. Les notes sont classées de la plus récente à la plus ancienne ; le même jour, dans l'ordre inverse de leur fusion.
- **R3** Une pull request qui change ce qu'une personne voit ou peut faire ajoute sa note, correction d'un défaut rencontré comprise. Une pull request sans effet visible (dépendances, nettoyage, tests) n'en ajoute pas, et la documentation seule ne déploie rien. La revue de code le vérifie.
- **R4** Une note et son changement partent dans le même déploiement. Il n'existe ni section « à venir », ni note publiée après coup.
- **R5** La date d'une note est celle de la fusion de sa pull request. Tant qu'aucun déploiement ultérieur n'a eu lieu, c'est le jour du commit de la pull request qui a ajouté la note (ADR-0065).
- **R6** Une note ne donne ni donnée personnelle, ni détail du serveur, ni moyen d'exploiter une faille corrigée.
- **R7** En bas de la page, un texte discret donne le numéro de la pull request déployée : « Déploiement n° 141 ». Après un déploiement lancé à la main, c'est le numéro du dernier commit de `main`, même s'il ne touche que la documentation. Ce numéro sert à identifier ce qui tourne ; il ne dit rien de l'ordre ni de l'importance des changements. Sans numéro connu (poste de développement), le texte n'apparaît pas.
- **R8** Le lien « Nouveautés » est en bas du menu, séparé des autres entrées et en plus petit, sur ordinateur comme sur téléphone. Menu replié, il se réduit à une icône avec son libellé en info-bulle.
- **R9** Rien ne signale qu'une note n'a pas été lue : ni pastille, ni bandeau, ni email.
- **R10** La page démarre avec une seule note, qui annonce la page elle-même. L'historique commence là.

## Données

Les notes sont des fichiers du dépôt, intégrés au build. Rien n'est stocké en base, et aucune donnée personnelle n'est créée : on ne retient pas qui a lu quoi.

## Sécurité et droits

La page est publique et en lecture seule, sans route d'API. Ses textes viennent du dépôt, relus en revue, et s'affichent en texte brut. Le numéro affiché est celui d'une pull request du dépôt, déjà public.

## Hors périmètre

- Numéros de version au sens habituel, 1.0.0, étiquettes git et releases GitHub (écartés, ADR-0065).
- Tout signal de nouveauté non lue (R9).
- Reprise de l'historique dans la page (R10).
- Lecture hors ligne, filtres et recherche dans les notes.
