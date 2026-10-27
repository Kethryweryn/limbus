---
id: US-001
titre: Créer et paramétrer une période d'inscription
statut: à faire
epic: EPIC-001
regles: [R1, R2, R3, R5, R6, R20]
adr: [ADR-0019, ADR-0020]
---

# US-001 : Créer et paramétrer une période d'inscription

En tant qu'organisatrice d'un jeu, je veux ouvrir une période d'inscription pour une ou plusieurs de ses sessions, afin d'y recruter les PJ.

## Critères d'acceptation

- [ ] Depuis la page du jeu, un onglet « Inscriptions » liste les périodes d'inscription du jeu (nom, sessions, statut, nombre d'inscrits par statut) et permet d'en créer une.
- [ ] Une période d'inscription porte :
  - un nom ;
  - une ou plusieurs sessions du jeu ;
  - le mode d'entrée (seul « invitation » est proposé dans cet epic) ;
  - une date de clôture facultative ;
  - un délai de réponse en jours (7 par défaut) ;
  - un nombre de places par session.
- [ ] Étant donné une session déjà rattachée à une autre période d'inscription, quand je l'ajoute, alors l'enregistrement est refusé avec un message clair (R1).
- [ ] Le modèle prévoit la portée « tout le jeu » de l'inscription permanente (R1, R30), mais l'interface de cet epic ne propose que la portée « sessions précises ». L'inscription permanente, qui est en mode formulaire, arrive avec EPIC-002.
- [ ] Étant donné une session d'un autre jeu, quand je l'envoie à l'API, alors la requête est refusée (400 ou 403).
- [ ] Le nombre de places proposé par défaut est le nombre de personnages PJ du jeu ; je peux le modifier pour chaque session (R5).
- [ ] Une période d'inscription a un état : `brouillon`, `ouverte` ou `clôturée`. Elle est clôturée à la main ou par sa date de clôture, évaluée à la lecture (ADR-0020). Une période d'inscription clôturée n'accepte plus de modifications par les inscrits (R6, R13).
- [ ] Je peux supprimer une période d'inscription sans inscription ; si elle en a, l'interface l'interdit et propose de la clôturer.
- [ ] Un co-organisateur du jeu a les mêmes droits ; un organisateur sans accès au jeu n'atteint rien.

## Notes techniques

- Modèle : `RegistrationPeriod` (jeu, nom, portée `sessions` | `game`, identifiant public du lien de diffusion, mode d'entrée, mode de sélection réservé aux epics suivants, état, clôture, délai), `RegistrationPeriodSession` (période, session unique, places), selon [ADR-0019](../../adr/ADR-0019-modele-des-inscriptions.md).
- Routes : `GET/POST /api/registration-periods`, `GET/PUT/DELETE /api/registration-periods/:id`, avec `requireGameAccess`, `assertSameGame` et les schémas zod de `server/utils/schemas.ts`.
- Écrans : onglet du jeu, formulaire de période d'inscription (`UModal`, contenu dans `#body`).
- Supprimer un jeu ou une session supprime en cascade ce qui en dépend (ADR-0009) ; supprimer une session retire seulement son rattachement.

## Tests

- Unitaires : schémas de validation (sessions en double, délai, places).
- Intégration : CRUD complet ; une session dans deux périodes d'inscription refusée ; ajout à `isolation.test.ts` (Alice ne lit, ne crée ni ne modifie de période d'inscription sur le jeu de Bob, ni avec une session de Bob).
