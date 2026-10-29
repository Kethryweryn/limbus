---
id: ADR-0035
titre: Les anciens slugs d'un jeu redirigent vers sa page publique
statut: accepté
date: 2026-10-29
liens: [../specs/SPEC-009-page-publique.md, ../epics/EPIC-009-ecarts-page-publique/US-045-lien-stable-de-la-page-publique.md]
---

# ADR-0035 : Les anciens slugs d'un jeu redirigent vers sa page publique

## Contexte

L'adresse de la page publique suit le slug du jeu, qui suit son titre : renommer un jeu casse les liens déjà diffusés ([SPEC-009](../specs/SPEC-009-page-publique.md), écart 2). L'utilisatrice a choisi de garder une adresse lisible, par le slug, avec une redirection depuis les anciens slugs.

## Décision

- Une table `GameSlugRedirect` garde chaque ancien slug d'un jeu (clé : le slug ; jeu ; date). `PUT /api/games/:id` l'écrit quand le slug change, et retire la redirection du slug que le jeu reprend.
- Le slug actuel d'un jeu l'emporte toujours : une redirection ne sert que si aucun jeu n'a ce slug aujourd'hui. Un ancien slug repris par un autre jeu ne redirige plus ; s'il se libère à nouveau, la redirection la plus récente vaut.
- La route publique, quand le slug n'est celui d'aucun jeu, cherche une redirection vers un jeu qui a une page publique, et renvoie son slug actuel. La page redirige (301). Sans page publique, la réponse est la même que pour un jeu absent : rien n'apprend qu'un jeu a été renommé.
- Seule la page publique redirige ; les pages de l'application, connectées, suivent le slug actuel.

## Conséquences

- `generateUniqueSlug` ignore les redirections : un nouveau jeu peut prendre un ancien slug, et la page de l'ancien jeu ne répond plus à cette adresse.
- Les redirections partent avec le jeu (suppression en cascade).

## Options écartées

- **Un identifiant aléatoire dans l'adresse** : stable, mais illisible ; l'utilisatrice préfère le slug.
- **Ne jamais libérer un ancien slug** : un titre abandonné bloquerait ce slug pour toujours, pour tous les jeux.
