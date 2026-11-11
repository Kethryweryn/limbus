---
id: SPEC-021
titre: Une session sans nom, désignée par sa date
statut: validée
date: 2026-11-11
origine: ../archive/todo/session-sans-nom.md
epics: [EPIC-055]
adr: [ADR-0083]
---

# SPEC-021 : Une session sans nom, désignée par sa date

## Objectif

Une organisatrice ne nomme plus ses sessions : Limbus les désigne par leur date, partout, et le statut se lit à côté. Retour D2-1 du cahier de tests.

Cette spec change [SPEC-004](SPEC-004-sessions.md) pour le nom d'une session, et rien d'autre de son cycle de vie.

## Parcours

### Organisatrice ou co-organisatrice

1. Elle crée une session : le formulaire demande la date, le lieu et le statut, plus de nom.
2. La session se lit « Session du 15 mai 2099 » dans les listes, les inscriptions, le casting et les fiches, avec son statut en badge là où il l'était.
3. Elle ajoute une seconde session le même jour : les deux se lisent avec leur heure.

### Participante

1. Dans « Je participe », dans ses emails et ses PDF, elle lit « Station Meridian — Session du 15 mai 2099 ».

## Règles métier

### Libellé

- **R1** Une session n'a pas de nom à saisir. Son libellé est « Session du <jour> » (« Session du 15 mai 2099 »), le jour à l'heure de Paris ; sans date, « Session sans date ». Le formulaire de session ne demande plus de nom, ni à la création ni à la modification.
- **R2** Si une autre session du même jeu tombe le même jour, le libellé ajoute l'heure (« Session du 15 mai 2099, 14 h », « 14 h 30 ») ; à la même heure, il ajoute aussi le lieu (« — Salle des fêtes ») ; si elles restent pareilles, un numéro dans l'ordre de création (« (2) »). Deux sessions sans date se distinguent de même par le lieu, puis le numéro. Le libellé d'une session peut donc changer quand une autre session du jeu est créée, déplacée ou supprimée.
- **R3** Le libellé remplace le nom partout où le nom apparaissait : pages du jeu, listes, inscriptions, casting, paiements, documents, fiches, PDF, emails, export, assistants d'IA. Le statut reste affiché là où il l'était.
- **R4** Hors des pages d'un jeu (emails, PDF, « Je participe », tableau de bord, documents reçus), le libellé est précédé du titre du jeu : « Station Meridian — Session du 15 mai 2099 », sauf là où le titre du jeu est déjà affiché juste à côté.

### Adresse et existant

- **R5** L'adresse d'une session est faite du jeu et de la date : `/sessions/station-meridian-2099-05-15`, ou `…-sans-date` ; une seconde à la même adresse prend un suffixe. Elle change si la date change, comme elle changeait avec le nom.
- **R6** Les sessions existantes perdent leur nom : à la mise en production, chacune prend son libellé et son adresse selon R1, R2 et R5. Une ancienne adresse ne mène plus à la session.
- **R7** Un assistant d'IA crée ou modifie une session sans nom ; il lit le libellé à la place.

## Données

Le libellé est calculé par le serveur et gardé à la place du nom ([ADR-0083](../adr/ADR-0083-libelle-de-session-calcule.md)). Aucune donnée personnelle nouvelle.

## Sécurité et droits

Inchangés : les droits de [SPEC-004](SPEC-004-sessions.md).

## Hors périmètre

- Changer le cycle de vie d'une session (statuts, report, annulation).
- Un libellé choisi à la main.

## Découpage

Un lot, [EPIC-055](../epics/EPIC-055-session-sans-nom/README.md) :

1. Le libellé calculé, le formulaire sans nom, l'adresse, les sessions existantes, les assistants d'IA et les jeux de test (R1 à R3, R5 à R7).
2. Le jeu devant le libellé hors des pages du jeu (R4).

## Historique

- 2026-11-11 : création à partir du retour D2-1, avec les choix de l'utilisatrice :
  - « Session du <date> », le statut en badge ; sans date, « Session sans date » (R1) ;
  - l'heure seulement en cas de doublon, puis le lieu (R2) ;
  - les noms existants oubliés (R6) ;
  - l'adresse faite du jeu et de la date (R5) ;
  - le jeu devant le libellé hors des pages du jeu (R4).
