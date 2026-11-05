---
id: US-150
titre: Recharger les jeux de test sans risque, avec des dates à jour
statut: à faire
epic: EPIC-044
regles: []
adr: [ADR-0066]
---

# US-150 : Recharger les jeux de test sans risque, avec des dates à jour

En tant qu'utilisatrice, je veux recharger les jeux de test quand je le décide, afin de retrouver des dates à jour sans toucher au reste.

## Critères d'acceptation

- [ ] Étant donné un lancement sans `SEED_ALLOW_ERASE=1`, alors le script s'arrête avant toute écriture, avec un message clair.
- [ ] Étant donné un `SEED_EMAIL` sans compte correspondant, ou une adresse de page de jeu de test prise par un autre jeu, alors le script s'arrête aussi avant toute écriture.
- [ ] Étant donné un jeu de test renommé, alors le rechargement le retrouve et le remplace, sans créer de doublon.
- [ ] Étant donné une copie léguée déjà acceptée, alors le rechargement la laisse à sa destinataire ; seule une copie en attente disparaît.
- [ ] Étant donné un fichier ajouté à un jeu de test pendant les essais, alors le rechargement le retire du disque (`deleteUnusedUploads`).
- [ ] Étant donné un rechargement, alors toutes les dates sont calculées à partir de ce jour-là, et aucune session « à venir » n'est passée.
- [ ] Étant donné un jeu, un compte ou une fiche hors des jeux de test, alors le rechargement n'y change rien, y compris une fiche rattachée à la fois à un jeu de test et à un autre jeu.
- [ ] Étant donné deux rechargements de suite, alors le second réussit et donne le même contenu.
- [ ] Étant donné un rechargement, alors aucun email n'est envoyé.
- [ ] Étant donné un partage ou une autorisation d'assistant sur un jeu de test, alors il existe encore après le rechargement.
- [ ] Le dépôt ne contient plus d'adresse réelle : le propriétaire et la base des adresses viennent de `SEED_EMAIL`.
- [ ] Les photos sont enregistrées avec leur taille, là où l'application les lit, et le service peut les ouvrir après un rechargement lancé sur le serveur.

## Notes techniques

`prisma/seed.ts`, à découper par jeu si le fichier devient trop long. Les trois jeux ont un identifiant fixe (ADR-0066). Les données des nouvelles tables doivent aussi disparaître au rechargement : les relations en cascade font l'essentiel, le reste s'efface explicitement.

À vérifier sur le serveur avant le premier rechargement : que le script y est à la version de `main`, que le dossier des fichiers téléversés est le bon, et à qui appartiennent les fichiers créés. `doc/developpement.md` donne la commande.

## Tests

Test d'intégration du script : refus sans confirmation, deux lancements de suite, arrêts avant écriture, jeu renommé, copie acceptée et fichier retiré, jeu et fiche témoins hors périmètre intacts, partage et autorisation conservés. Dates : test unitaire de la fonction de calcul.
