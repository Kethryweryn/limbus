---
id: US-155
titre: Savoir où essayer chaque fonctionnalité, et garder le script à jour
statut: à faire
epic: EPIC-044
regles: []
adr: [ADR-0066]
---

# US-155 : Savoir où essayer chaque fonctionnalité, et garder le script à jour

En tant qu'utilisatrice, je veux une liste de ce que je peux essayer, et je veux que les jeux de test ne vieillissent plus sans qu'on le voie.

## Critères d'acceptation

- [ ] Étant donné `doc/jeux-de-test.md`, alors chaque spec implémentée a sa ligne : quoi essayer, sur quel jeu, avec quel compte. Ce qui ne peut pas s'y essayer le dit.
- [ ] Étant donné le guide, alors il indique quelles personnes reçoivent vraiment les emails, et il ne contient ni mot de passe, ni adresse réelle.
- [ ] Étant donné `doc/developpement.md`, alors la commande de rechargement, en local et sur le serveur, et les variables `SEED_*` y sont décrites.
- [ ] Étant donné une pull request qui casse le script, alors la CI échoue.
- [ ] Étant donné `CLAUDE.md`, alors une fonctionnalité qui ajoute une donnée à essayer complète le script et le guide.

## Notes techniques

Le test d'intégration lance le script sur la base jetable, puis lit les écrans des trois étapes avec les comptes de test. Il ne vérifie pas que les données soient réalistes, seulement qu'elles existent et que l'application sait les lire.

## Tests

Le test d'intégration ci-dessus, dans `tests/integration/`.
