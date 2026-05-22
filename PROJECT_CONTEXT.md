# Contexte projet

Limbus est un logiciel ayant pour but de faciliter l'organisation de jeux de role grandeur nature.

## Objectif

Le projet couvre deux grands besoins :

- gerer l'ecriture d'un jeu ;
- organiser les sessions de ce jeu.

## Ecriture d'un jeu

Limbus permet de structurer un jeu avec ses elements principaux :

- personnages ;
- factions eventuelles ;
- intrigues ;
- objets ;
- documents et supports associes.

L'objectif est de centraliser la matiere de jeu pour faciliter l'ecriture, la relecture, la coherence globale et la preparation de l'exploitation.

## Organisation des sessions

Une session correspond a l'organisation concrete d'un jeu a une date donnee.

Elle associe notamment :

- un jeu ;
- une date ;
- un lieu ;
- une liste de joueurs ;
- des assignations entre joueurs et personnages.

Les joueurs contiennent les informations pratiques stables comme le nom, l'email et le telephone. Un joueur peut etre inscrit a plusieurs jeux. La photo depend de l'assignation d'un joueur a un personnage pour une session donnee, afin de correspondre au role incarne. Ces donnees doivent permettre de generer facilement des trombinoscopes.

Les lieux doivent permettre de stocker les informations utiles a l'organisation, notamment le nom du lieu et son adresse. Ces donnees doivent permettre de generer une feuille de route pour la session.

## Orientation produit

Limbus doit rester un outil d'organisation et de production pour des organisateurs de GN. Les modules de session doivent assembler des donnees existantes, comme les joueurs, les lieux et les personnages, sans forcement porter toute leur gestion detaillee.

Les fonctionnalites offline sont pensees en priorite comme un mode lecture lorsque la connexion est temporairement indisponible. Les modifications offline et leur resynchronisation pourront etre traitees plus tard comme un chantier specifique.

## Conventions API

Les routes visibles par l'utilisateur privilegient les slugs lorsqu'une ressource a une page dediee :

- `/games/:slug`
- `/characters/:slug`

Les operations API qui modifient ou relient des donnees utilisent les identifiants techniques stables, car un slug peut changer si le titre ou le nom change :

- `PUT /api/games/:id`
- `DELETE /api/games/:id`
- `PUT /api/characters/:id`
- `DELETE /api/characters/:id`
- `PUT /api/players/:id`
- `DELETE /api/players/:id`
- `PUT /api/locations/:id`
- `DELETE /api/locations/:id`
- `PUT /api/sessions/:id`
- `DELETE /api/sessions/:id`

Les lectures API par slug sont explicites pour eviter toute ambiguite entre `id` et `slug` :

- `GET /api/games/slug/:slug`
- `GET /api/characters/slug/:slug`

Les fichiers dans `server/api` doivent utiliser les suffixes de methode Nuxt/Nitro (`.get.ts`, `.post.ts`, `.put.ts`, `.delete.ts`) plutot que des chemins comme `/put` ou `/delete`.
