---
id: SPEC-004
titre: Sessions, casting et chronologie de déroulé
statut: validée
date: 2026-10-29
origine: ../todo/documentation-de-l-existant.md
epics: []
adr: [ADR-0007, ADR-0008]
---

# SPEC-004 : Sessions, casting et chronologie de déroulé

Cette spec décrit un comportement déjà en production, avant la reprise du développement ([Documentation de l'existant](../todo/documentation-de-l-existant.md)). Elle n'a ni epic ni US. Les écarts constatés entre le code et l'intention sont listés à la fin, sans être corrigés.

## Objectif

Organiser une représentation d'un jeu : une session réunit une date, un lieu, une équipe et le casting des personnages. Elle prépare la chronologie de déroulé, et sert de base aux trombinoscopes, aux envois, aux paiements et aux inscriptions.

## Vocabulaire

- **Session** : une représentation d'un jeu. Un jeu a plusieurs sessions.
- **Équipe de la session** : les participants de la session, chacun avec un ou plusieurs rôles : participant (joueuse ou joueur), organisateur, PNJ, cuisine.
- **Casting** : l'attribution des personnages du jeu à des participants, pour cette session.
- **Responsable** : un membre de l'équipe affecté à un événement de la chronologie pour cette session.

## Acteurs

- **Organisatrice** : propriétaire ou co-organisatrice du jeu ([SPEC-003](SPEC-003-ecriture-d-un-jeu.md), R16). Elle gère tout dans les sessions du jeu.
- **Participant** : ne se connecte pas. Il est concerné par la session à travers les emails et les inscriptions.

## Parcours

### Créer une session

1. Depuis la page Sessions, l'organisatrice crée une session pour un jeu : un nom, une date (facultative), un lieu du jeu (facultatif), un statut.
2. Elle compose l'équipe : des participants inscrits au jeu, avec leurs rôles.
3. Elle fait le casting : pour chaque personnage, un participant, une photo propre à cette session et des notes.

### Préparer le déroulé

1. Dans la chronologie de la session, elle affecte des responsables à chaque événement.
2. Pour chaque événement, un indicateur compare le nombre de responsables affectés au nombre requis ([SPEC-003](SPEC-003-ecriture-d-un-jeu.md), R12).

## Règles métier

### Session

- **R1** Une session appartient à un jeu et n'en change jamais. Elle a un nom (et un slug unique qui suit le nom), une date facultative et un lieu facultatif, qui doit appartenir au même jeu.
- **R2** Le statut d'une session est « Prévue » (par défaut), « Reportée », « Annulée » ou « Terminée ». Aujourd'hui :
  - « Annulée » retire la session du tableau de bord et des prochaines sessions affichées avec les jeux ;
  - « Annulée » et « Terminée » empêchent d'ajouter la session à une période d'inscription ([SPEC-001](SPEC-001-inscriptions.md)) ;
  - les statuts n'ont pas d'autre effet. Voir les écarts : ils devraient agir.
- **R3** Supprimer une session, après une simple confirmation, efface :
  - son équipe, son casting, ses photos et ses responsables ;
  - ses paiements, ses envois et ses trombinoscopes.

  Ses inscriptions restent, mais ne sont plus rattachées à aucune session. Voir les écarts : la suppression devrait permettre de gérer le remboursement ou le report.

### Équipe et casting

- **R4** Seuls les participants inscrits au jeu de la session peuvent en faire partie ou être castés.
- **R5** Un participant peut avoir plusieurs rôles dans une même session (par exemple organisateur et PNJ).
- **R6** Un personnage est attribué à au plus un participant par session. Il peut aussi rester sans participant.
- **R7** Un participant peut être casté sur plusieurs personnages de la même session. C'est utile dans certains jeux, mais pas dans tous :
  - pour un PJ, c'est l'exception, par exemple dans un jeu en plusieurs actes, avec un rôle par acte ;
  - pour un PNJ, cela dépend des jeux.

  Aucune règle par jeu ne le limite aujourd'hui (voir les écarts).
- **R8** Un personnage PNJ ne peut être attribué qu'à un membre de l'équipe qui a le rôle organisateur ou PNJ.
- **R9** Un participant casté sur un PJ sans aucun rôle dans l'équipe reçoit automatiquement le rôle « participant ».
- **R10** Chaque attribution peut avoir sa propre photo, qui sert aux trombinoscopes de la session. Une photo téléversée appartient au jeu et à la session. Elle est supprimée quand plus rien ne l'utilise ([ADR-0008](../adr/ADR-0008-fichiers-televerses.md)).
- **R11** Enregistrer une session remplace en une fois son équipe et son casting. Quand la requête porte la date de la version lue, une session modifiée ailleurs entre-temps n'est pas écrasée : l'enregistrement est refusé (409). C'est le cas du formulaire de la liste des sessions et des modifications rejouées au retour du mode hors ligne, mais pas de la page de la session, où se font l'équipe et le casting (voir les écarts).

### Chronologie de déroulé

- **R12** Les responsables d'un événement sont choisis parmi les membres de l'équipe qui ont le rôle organisateur ou PNJ. Les événements doivent appartenir au jeu de la session.
- **R13** Enregistrer la chronologie remplace toutes les affectations de responsables de la session.

## Données

- Tables `Session`, `SessionParticipant` (équipe et rôles), `SessionAssignment` (casting, photo, notes) et `TimelineEventResponsible`.
- La photo d'une attribution est une donnée personnelle du participant. Elle est couverte par l'export et la suppression RGPD (`participantPrivacy.ts`), décrits dans [SPEC-007](SPEC-007-participants-et-rgpd.md).
- Supprimer un participant supprime sa place dans les équipes et ses affectations de responsable. Ses attributions perdent leur participant, et leurs photos sont supprimées.

## Sécurité et droits

- **R14** L'accès à une session suit l'accès à son jeu (`requireSessionAccess`). Toutes les références (participants, personnages, lieu, événements, photos) doivent appartenir au même jeu ([ADR-0007](../adr/ADR-0007-isolation-par-jeu.md)).

## Hors périmètre

Ces sujets ont leur propre spec :

- trombinoscopes et fiches de personnage en PDF ;
- envois de documents ([SPEC-006](SPEC-006-emails-et-paiements.md)) ;
- paiements ([SPEC-006](SPEC-006-emails-et-paiements.md)) ;
- fiche allergies et inscriptions ([SPEC-001](SPEC-001-inscriptions.md)) ;
- page publique.

## Écarts constatés

Relevés le 29 octobre 2026 avec l'utilisatrice. Aucun n'est corrigé ici.

1. **Cycle de vie d'une session (R2, R3)** : les statuts devraient agir, ce qui est repris dans la fiche [Cycle de vie d'une session](../todo/cycle-de-vie-d-une-session.md). Ce qui manque :
   - une session peut être annulée puis reportée, ou « désannulée » une fois une solution trouvée ;
   - pour une session annulée ou reportée, il faut gérer le remboursement de chaque personne qui a payé ;
   - pour une session reportée, il faut reprendre le casting sur la nouvelle session, et faire confirmer leur présence à tout le monde (participants, organisateurs, cuisine, PNJ), avec un suivi pour l'organisation ;
   - supprimer une session ne propose aujourd'hui ni remboursement ni report.
2. **Plusieurs rôles par participant (R7)** : rien ne permet de dire, pour un jeu donné, qu'un participant ne joue qu'un PJ.
3. **Modifications simultanées (R11)** : la page d'une session n'envoie pas la date de la version lue. Si deux organisatrices modifient l'équipe ou le casting en même temps, le dernier enregistrement écrase le premier sans prévenir. La chronologie de déroulé (R13) n'a pas non plus de contrôle.
4. **`Session.published`** : le champ existe et est enregistré, mais aucune action ne le change et il n'a aucun effet, comme pour le contenu d'un jeu ([SPEC-003](SPEC-003-ecriture-d-un-jeu.md), écart 1).
