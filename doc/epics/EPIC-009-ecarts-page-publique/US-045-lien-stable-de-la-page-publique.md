---
id: US-045
titre: L'adresse de la page publique survit au renommage
statut: terminée
epic: EPIC-009
regles: [R6]
adr: [ADR-0035]
---

# US-045 : L'adresse de la page publique survit au renommage

En tant qu'organisatrice, je veux que les liens déjà diffusés vers la page publique de mon jeu marchent encore après un renommage.

## Critères d'acceptation

- [x] Renommer un jeu garde son ancien slug : l'ancienne adresse de la page publique redirige (301) vers la nouvelle.
- [x] Un slug repris par un autre jeu sert ce jeu : la redirection ne vaut que tant que l'ancien slug est libre.
- [x] Revenir à un ancien titre reprend l'ancien slug, sans boucle de redirection.
- [x] Une redirection vers un jeu qui n'a plus de page publique répond comme une page absente (404).

## Notes techniques

- Table `GameSlugRedirect` (ancien slug, jeu), remplie par `PUT /api/games/:id` ([ADR-0035](../../adr/ADR-0035-anciens-slugs-d-un-jeu.md)).
- La route publique renvoie le slug actuel ; la page redirige avec `navigateTo(…, { redirectCode: 301 })`.

## Tests

- Intégration (`publicPage.test.ts`) : ancien slug redirigé après renommage ; slug repris par un autre jeu ; jeu dépublié.
