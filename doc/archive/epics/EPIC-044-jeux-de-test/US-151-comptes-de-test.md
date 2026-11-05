---
id: US-151
titre: Se connecter avec des comptes de test
statut: terminée
epic: EPIC-044
regles: []
adr: [ADR-0066]
---

# US-151 : Se connecter avec des comptes de test

En tant qu'utilisatrice, je veux me connecter sous plusieurs comptes de test, afin de voir Limbus comme une co-organisatrice ou une personne qui participe.

## Critères d'acceptation

- [x] Étant donné `SEED_PASSWORD`, alors le rechargement crée ou remet à jour trois comptes confirmés, sans droit d'administration, ayant accepté les conditions en vigueur : Inès (co-organisatrice), Camille et Lucie (participantes).
- [x] Étant donné ces comptes, alors leurs adresses sont construites à partir de `SEED_EMAIL`, et les emails arrivent dans la boîte de l'utilisatrice.
- [x] Étant donné Inès, alors elle co-organise Station Meridian et Les Cendres de Valombre, mais pas Le Bal des Masques Brisés, ce qui permet de voir un refus.
- [x] Étant donné Camille et Lucie, alors leurs fiches sont rattachées à leur compte, et leurs coordonnées et allergies viennent du compte (ADR-0042).
- [x] Étant donné Camille, alors « Je participe » montre au moins deux jeux, avec une session à venir et une inscription en cours.
- [x] Étant donné trois personnes sans compte (Nicolas, Sarah et Manon), alors leurs adresses arrivent aussi dans la boîte de l'utilisatrice, pour essayer les liens personnels et le legs.
- [x] Étant donné toutes les autres personnes fictives, alors leur adresse reste en `example.test`.
- [x] Étant donné un lancement sans `SEED_PASSWORD`, alors aucun compte de test n'est créé ni modifié, et le rechargement réussit quand même.
- [x] Le mot de passe n'apparaît ni dans le dépôt, ni dans ce que le script affiche.

## Notes techniques

Le hachage du mot de passe passe par la même fonction que l'application. `SEED_PASSWORD` respecte les règles de mot de passe des comptes. Le script refuse une valeur trop courte.

## Tests

`tests/integration/seed.test.ts` : connexion avec chaque compte, confirmation et conditions acceptées sans étape supplémentaire, jeux partagés d'Inès, et lancement sans `SEED_PASSWORD`.
