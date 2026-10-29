---
id: US-016
titre: Archiver un jeu dépublie sa page publique
statut: à faire
epic: EPIC-003
regles: [R3]
adr: []
---

# US-016 : Archiver un jeu dépublie sa page publique

En tant qu'organisatrice, je veux qu'archiver un jeu dépublie sa page publique, afin que la restauration ne la republie pas sans que je le demande.

## Critères d'acceptation

- [ ] Quand j'archive un jeu, sa marque « page publique » est retirée, quelle que soit la requête.
- [ ] Quand je restaure le jeu, sa page reste dépubliée ; je la republie à la main si je le veux.
- [ ] Un jeu archivé ne peut pas recevoir la marque « page publique » : la requête qui la demande sur un jeu archivé l'ignore.

## Notes techniques

- `PUT /api/games/:id` : quand le jeu résultant est archivé (`published` faux), `publicPage` est forcé à faux.
- La case « Publier la page publique » du formulaire reste ; elle n'a pas d'effet sur un jeu archivé.

## Tests

- Intégration : archiver un jeu publié retire `publicPage` ; restaurer le laisse à faux ; la page publique répond 404 après restauration.
