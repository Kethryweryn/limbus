---
id: US-014
titre: Saisir la quantité d'un objet
statut: terminée
epic: EPIC-003
regles: [R10]
adr: []
---

# US-014 : Saisir la quantité d'un objet

En tant qu'organisatrice, je veux indiquer combien d'exemplaires d'un objet il faut, afin de préparer l'accessoirisation.

## Critères d'acceptation

- [x] Le formulaire d'un objet a un champ « Quantité » : un entier d'au moins 1, 1 par défaut.
- [x] La quantité est enregistrée à la création et à la modification ; une valeur absente garde 1 à la création et la valeur actuelle à la modification.
- [x] Une quantité inférieure à 1, ou non entière, est refusée (400).
- [x] La liste des objets affiche la quantité quand elle dépasse 1.

## Notes techniques

- Champ `Item.quantity` existant ; schéma `itemSchema` ; routes `POST /api/items` et `PUT /api/items/:id` ; page `pages/items/index.vue`.
- La copie d'un jeu recopie déjà la quantité.

## Tests

- Unitaires : `itemSchema` accepte 1 et 3, refuse 0, -1 et 1,5, et laisse la quantité absente quand la requête n'en porte pas.
- Intégration (`content.test.ts`) : quantité enregistrée à la création, gardée par une modification qui n'en porte pas, 0 refusé, 1 par défaut.
