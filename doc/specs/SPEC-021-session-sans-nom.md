---
id: SPEC-021
titre: Une session sans nom, désignée par sa date
statut: en cours
date: 2026-11-11
origine: ../archive/todo/session-sans-nom.md
epics: [EPIC-055]
adr: [ADR-0083, ADR-0084]
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

- **R1** Une session n'a pas de nom à saisir. Son libellé est « Session du <jour> » (« Session du 15 mai 2099 », « Session du 1er mai 2099 »), le jour à l'heure de Paris ; sans date, « Session sans date ». Ni le formulaire de session, à la création comme à la modification, ni la fenêtre « Reporter » ne demandent plus de nom.
- **R2** Si une autre session du même jeu tombe le même jour, le libellé ajoute l'heure (« Session du 15 mai 2099, 14 h », « 14 h 30 ») ; à la même heure, il ajoute aussi le lieu (« — Salle des fêtes ») ; si elles restent pareilles, un numéro dans l'ordre de création (« (2) »). Deux sessions sans date se distinguent de même par le lieu, puis le numéro. Le libellé d'une session peut donc changer quand une autre session du jeu est créée, déplacée ou supprimée.
- **R3** Le libellé remplace le nom partout où le nom apparaissait : pages du jeu, listes, inscriptions, casting, paiements, documents, fiches, PDF, emails, export, page publique, questionnaire d'inscription et liens personnels, assistants d'IA. Le statut reste affiché là où il l'était.
- **R4** Hors des pages d'un jeu (emails, PDF, « Je participe », tableau de bord, documents reçus), le libellé est précédé du titre du jeu : « Station Meridian — Session du 15 mai 2099 », sauf là où le titre du jeu est déjà affiché juste à côté : la page publique, le questionnaire d'inscription et les pages des liens personnels portent le jeu en titre, et gardent le libellé seul.

### Adresse et existant

- **R5** L'adresse d'une session est faite du jeu et de la date : `/sessions/station-meridian-2099-05-15`, ou `…-sans-date` ; une seconde à la même adresse prend un suffixe. Elle change si la date change, comme elle changeait avec le nom.
- **R6** Les sessions existantes perdent leur nom : à la mise en production, chacune prend son libellé et son adresse selon R1, R2 et R5. Une ancienne adresse ne mène plus à la session.
- **R7** Un assistant d'IA crée ou modifie une session sans nom ; il lit le libellé à la place.
- **R8** Les jeux de test donnent à chaque session une date fixe, et non plus relative au jour du rechargement : le cahier de tests les désigne par leur libellé (« Session du 12 juin 2030 »), et `doc/jeux-de-test.md` rappelle le rôle de chacune (ancienne « Session mixte »…). Les sessions à venir sont datées en 2030, les passées à l'automne 2026 ; pour rejouer le jeu de test plus tard, on met à jour ces dates.

## Données

La session n'a plus de nom en base : le libellé se calcule à chaque lecture, et n'entre dans aucune empreinte ni comparaison ([ADR-0084](../adr/ADR-0084-libelle-de-session-a-la-lecture.md), qui remplace [ADR-0083](../adr/ADR-0083-libelle-de-session-calcule.md)). Aucune donnée personnelle nouvelle.

## Sécurité et droits

Inchangés : les droits de [SPEC-004](SPEC-004-sessions.md).

## Hors périmètre

- Changer le cycle de vie d'une session (statuts, report, annulation).
- Un libellé choisi à la main.

## Découpage

Un lot, [EPIC-055](../epics/EPIC-055-session-sans-nom/README.md) :

1. Le libellé calculé, le formulaire sans nom, l'adresse, les sessions existantes, les assistants d'IA et les jeux de test (R1 à R3, R5 à R8).
2. Le jeu devant le libellé hors des pages du jeu (R4).
3. La suppression de la colonne du nom, après le déploiement de la première étape (ADR-0084).

## Historique

- 2026-11-11 : création à partir du retour D2-1, avec les choix de l'utilisatrice :
  - « Session du <date> », le statut en badge ; sans date, « Session sans date » (R1) ;
  - l'heure seulement en cas de doublon, puis le lieu (R2) ;
  - les noms existants oubliés (R6) ;
  - l'adresse faite du jeu et de la date (R5) ;
  - le jeu devant le libellé hors des pages du jeu (R4).
- 2026-11-11 (revue, choix de l'utilisatrice) : les jeux de test prennent des dates fixes, et le cahier désigne les sessions par leur libellé (R8). Précisés aussi : « 1er » pour le premier du mois et la fenêtre « Reporter » (R1), la page publique, le questionnaire et les liens personnels (R3, R4).
- 2026-11-11 (choix de l'utilisatrice) : les sessions passées des jeux de test ont aussi une date fixe ; aucune mécanique propre aux jeux de test (R8).
- 2026-11-11 : US-234 livrée : libellé calculé, formulaire et report sans nom, adresse, sessions existantes, assistants d'IA, jeux de test à dates fixes. En route, la date saisie part avec le fuseau de l'appareil.
- 2026-11-11 (revue de la PR #217, choix de l'utilisatrice) : la colonne du nom disparaît ; le libellé se calcule à la lecture (ADR-0084). Les empreintes des envois et des trombinoscopes ne portent plus que le contenu, sans libellé ni titre du jeu.
- 2026-11-11 : US-234 livrée : libellé calculé à la lecture, formulaire et report sans nom, adresse, sessions existantes, assistants d'IA, jeux de test à dates fixes, empreintes du contenu seul. En route, la date saisie part avec le fuseau de l'appareil.
