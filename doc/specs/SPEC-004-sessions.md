---
id: SPEC-004
titre: Sessions, casting et chronologie de déroulé
statut: validée
date: 2026-10-29
origine: ../archive/todo/documentation-de-l-existant.md
epics: [EPIC-004]
adr: [ADR-0007, ADR-0008, ADR-0018, ADR-0020, ADR-0028, ADR-0029]
---

# SPEC-004 : Sessions, casting et chronologie de déroulé

Cette spec décrit un comportement déjà en production, avant la reprise du développement ([Documentation de l'existant](../archive/todo/documentation-de-l-existant.md)). Les écarts constatés entre le code et l'intention ont été corrigés par [EPIC-004](../archive/epics/EPIC-004-ecarts-sessions/README.md), qui a aussi repris la fiche [Cycle de vie d'une session](../archive/todo/cycle-de-vie-d-une-session.md).

## Objectif

Organiser une représentation d'un jeu : une session réunit une date, un lieu, une équipe et le casting des personnages. Elle prépare la chronologie de déroulé, et sert de base aux trombinoscopes, aux envois, aux paiements et aux inscriptions.

## Vocabulaire

- **Session** : une représentation d'un jeu. Un jeu a plusieurs sessions.
- **Équipe de la session** : les participants de la session, chacun avec un ou plusieurs rôles : participant (joueuse ou joueur), organisateur, PNJ, cuisine.
- **Casting** : l'attribution des personnages du jeu à des participants, pour cette session.
- **Responsable** : un membre de l'équipe affecté à un événement de la chronologie pour cette session.
- **Report** : le remplacement d'une session par une nouvelle session, à une autre date, qui reprend son équipe et son casting.
- **Confirmation de présence** : la réponse de chaque personne de l'équipe d'une session reportée, par un lien personnel.

## Acteurs

- **Organisatrice** : propriétaire ou co-organisatrice du jeu ([SPEC-003](SPEC-003-ecriture-d-un-jeu.md), R16). Elle gère tout dans les sessions du jeu.
- **Participant** : ne se connecte pas. Il est concerné par la session à travers les emails, les inscriptions et le lien de confirmation de présence.

## Parcours

### Créer une session

1. Depuis la page Sessions, l'organisatrice crée une session pour un jeu : un nom, une date (facultative), un lieu du jeu (facultatif), un statut, et si elle est visible sur la page publique.
2. Elle compose l'équipe : des participants inscrits au jeu, avec leurs rôles.
3. Elle fait le casting : pour chaque personnage, un participant, une photo propre à cette session et des notes.

### Préparer le déroulé

1. Dans la chronologie de la session, elle affecte des responsables à chaque événement.
2. Pour chaque événement, un indicateur compare le nombre de responsables affectés au nombre requis ([SPEC-003](SPEC-003-ecriture-d-un-jeu.md), R12).

### Annuler une session

1. Elle passe la session à « Annulée ». Limbus propose un email d'annulation à l'équipe, qu'elle relit, modifie et envoie, ou ferme sans rien envoyer.
2. Dans l'onglet Paiements, elle choisit pour chaque personne qui a payé : à rembourser, puis remboursé.
3. Si une solution est trouvée, elle repasse la session à « Prévue », ou la reporte.

### Reporter une session

1. Sur une session prévue ou annulée, « Reporter » crée une nouvelle session : nom, date et lieu. L'équipe et le casting y sont recopiés ; l'ancienne session passe « Reportée ».
2. Dans l'onglet Présence de la nouvelle session, elle choisit une date limite et envoie à toute l'équipe une demande de confirmation, avec un lien personnel.
3. Elle suit les réponses, relance, prolonge un délai, envoie un nouveau lien, et libère la place de qui ne viendra pas.
4. Dans l'onglet Paiements de l'ancienne session, elle reporte chaque paiement sur la nouvelle session, ou le rembourse.

## Règles métier

### Session

- **R1** Une session appartient à un jeu et n'en change jamais. Elle a un nom (et un slug unique qui suit le nom), une date facultative et un lieu facultatif, qui doit appartenir au même jeu.
- **R2** Le statut d'une session est « Prévue » (par défaut), « Reportée », « Annulée » ou « Terminée ». Il se change librement : une session annulée peut redevenir prévue (« désannulée ») ou être reportée.
  - « Annulée » et « Terminée » retirent la session du tableau de bord et des prochaines sessions affichées avec les jeux ; dans la liste des sessions, elle est rangée avec les sessions passées, quelle que soit sa date. Elle reste modifiable.
  - « Annulée » et « Terminée » empêchent d'ajouter la session à une période d'inscription ([SPEC-001](SPEC-001-inscriptions.md)).
  - « Reportée » est donnée par le report (R15).
- **R2b** Une session est visible ou non sur la page publique du jeu ; elle ne l'est pas par défaut. La page publique ne montre pas encore les sessions ([SPEC-009](SPEC-009-page-publique.md), écart 3).
- **R3** Supprimer une session qui a un paiement reçu ou une inscription est refusé : Limbus oriente vers l'annulation ou le report. Sinon, après une confirmation, la suppression efface :
  - son équipe, son casting, ses photos et ses responsables ;
  - ses paiements, ses envois, ses trombinoscopes et ses confirmations de présence.

### Équipe et casting

- **R4** Seuls les participants inscrits au jeu de la session peuvent en faire partie ou être castés.
- **R5** Un participant peut avoir plusieurs rôles dans une même session (par exemple organisateur et PNJ).
- **R6** Un personnage est attribué à au plus un participant par session. Il peut aussi rester sans participant.
- **R7** Un participant peut être casté sur plusieurs personnages de la même session. C'est utile dans certains jeux, mais pas dans tous :
  - pour un PJ, c'est l'exception, par exemple dans un jeu en plusieurs actes, avec un rôle par acte ;
  - pour un PNJ, cela dépend des jeux.

  Un réglage du jeu, « Un seul PJ par participant et par session », coché par défaut, refuse un casting qui donne plusieurs PJ au même participant. On le décoche pour un jeu en plusieurs actes. Les PNJ ne sont jamais limités.
- **R8** Un personnage PNJ ne peut être attribué qu'à un membre de l'équipe qui a le rôle organisateur ou PNJ.
- **R9** Un participant casté sur un PJ sans aucun rôle dans l'équipe reçoit automatiquement le rôle « participant ».
- **R10** Chaque attribution peut avoir sa propre photo, qui sert aux trombinoscopes de la session. Une photo téléversée appartient au jeu et à la session. Elle est supprimée quand plus rien ne l'utilise ([ADR-0008](../adr/ADR-0008-fichiers-televerses.md)).
- **R11** Enregistrer une session remplace en une fois son équipe et son casting. La page de la session, le formulaire de la liste et les modifications rejouées au retour du mode hors ligne envoient la version lue : une session modifiée ailleurs entre-temps n'est pas écrasée, l'enregistrement est refusé (409) avec un message qui demande de recharger ([ADR-0028](../adr/ADR-0028-version-d-une-session.md)).

### Chronologie de déroulé

- **R12** Les responsables d'un événement sont choisis parmi les membres de l'équipe qui ont le rôle organisateur ou PNJ. Les événements doivent appartenir au jeu de la session.
- **R13** Enregistrer la chronologie remplace toutes les affectations de responsables de la session. Elle fait partie de la version de la session (R11) : un enregistrement sur une version périmée est refusé.

### Cycle de vie

- **R15** Reporter une session prévue ou annulée crée une nouvelle session du même jeu, avec la même équipe (rôles compris) et le même casting (notes et photos comprises). L'ancienne passe « Reportée » et indique la nouvelle, qui indique d'où elle vient. On ne reporte pas vers une session existante. Une photo recopiée est rattachée au jeu, pour survivre à la suppression de l'une des deux sessions ([ADR-0029](../adr/ADR-0029-cycle-de-vie-d-une-session.md)).
- **R16** Pour une session annulée ou reportée, chaque paiement reçu se suit : à rembourser, remboursé (avec la date) ou, pour une session reportée, reporté sur la nouvelle session. Reporter un paiement marque la personne comme ayant payé la nouvelle session, à la date d'origine, si elle fait partie de son tableau des paiements ([SPEC-006](SPEC-006-emails-et-paiements.md), R14).
- **R17** Sur la nouvelle session, l'organisation demande à toute l'équipe (participants, organisateurs, PNJ, cuisine) de confirmer sa présence, avant une date limite choisie (7 jours par défaut). Chaque personne reçoit, une seule fois, un email avec un lien personnel ([ADR-0018](../adr/ADR-0018-jetons-des-liens-personnels.md)) ; l'email est montré en aperçu avant l'envoi.
- **R18** Par le lien, la personne voit la session (nom, date, lieu) et répond « Je viens » ou « Je ne viens pas ». Elle peut répondre tant que sa place n'est pas libérée, et changer d'avis jusqu'à la date limite. Elle ne voit rien des autres.
- **R19** Une personne qui n'a pas répondu à la date limite est signalée « délai dépassé » ; rien ne change tout seul ([ADR-0020](../adr/ADR-0020-echeances-evaluees-a-la-lecture.md)). L'organisation la relance (rappel sans lien), prolonge son délai ou lui envoie un nouveau lien, qui invalide l'ancien.
- **R20** La place d'une personne qui ne viendra pas, ou n'a pas répondu à temps, se libère à la main : elle quitte l'équipe, le casting et le déroulé de la session, son lien cesse de fonctionner, et son paiement éventuel reste à traiter.
- **R21** Quand une session passe « Annulée », Limbus propose un email d'annulation, modifiable, à envoyer une fois à chaque personne de l'équipe qui a un email. On peut l'envoyer, le tester ou ne rien envoyer. Un échec n'arrête pas les autres envois.

## Données

- Tables `Session` (dont `postponedToSessionId`, la session de report), `SessionParticipant` (équipe et rôles), `SessionAssignment` (casting, photo, notes), `TimelineEventResponsible` et `SessionAttendance` (confirmations de présence) ; colonnes de remboursement de `SessionPayment` ([ADR-0029](../adr/ADR-0029-cycle-de-vie-d-une-session.md)). Réglage `Game.singlePjPerParticipant`.
- La photo d'une attribution est une donnée personnelle du participant. Elle est couverte par l'export et la suppression RGPD (`participantPrivacy.ts`), décrits dans [SPEC-007](SPEC-007-participants-et-rgpd.md).
- Supprimer un participant supprime sa place dans les équipes et ses affectations de responsable. Ses attributions perdent leur participant, et leurs photos sont supprimées.
- Les confirmations de présence et les choix de remboursement sont des données du participant : ils sont exportés, et supprimés avec lui.

## Sécurité et droits

- **R14** L'accès à une session suit l'accès à son jeu (`requireSessionAccess`). Toutes les références (participants, personnages, lieu, événements, photos) doivent appartenir au même jeu ([ADR-0007](../adr/ADR-0007-isolation-par-jeu.md)).
- **R14b** Le lien de confirmation de présence ne donne accès qu'à la réponse de la personne : 32 octets aléatoires dont seul le SHA-256 est stocké, page sans référent, sans cache ni indexation, routes publiques limitées par IP. Un jeton inconnu et un jeton invalidé répondent de la même façon ([ADR-0018](../adr/ADR-0018-jetons-des-liens-personnels.md)).

## Hors périmètre

Ces sujets ont leur propre spec :

- trombinoscopes et fiches de personnage en PDF ;
- envois de documents ([SPEC-006](SPEC-006-emails-et-paiements.md)) ;
- paiements ([SPEC-006](SPEC-006-emails-et-paiements.md)) ;
- fiche allergies et inscriptions ([SPEC-001](SPEC-001-inscriptions.md)) ;
- page publique ([SPEC-009](SPEC-009-page-publique.md)).

## Écarts constatés

Relevés le 29 octobre 2026 avec l'utilisatrice, et corrigés par [EPIC-004](../archive/epics/EPIC-004-ecarts-sessions/README.md) :

1. **Cycle de vie d'une session (R2, R3)** : les statuts n'avaient pas d'effet et la suppression effaçait les paiements. Statuts réversibles et session terminée hors des listes courantes (US-020), suppression orientée vers l'annulation (US-021), report (US-022), remboursements (US-023), confirmation de présence (US-024) et email d'annulation (US-025).
2. **Plusieurs PJ par participant (R7)** : réglage du jeu (US-017).
3. **Modifications simultanées (R11, R13)** : la page de la session et la chronologie envoient la version lue (US-018).
4. **`Session.published`** : il décide maintenant si la session est visible sur la page publique (US-019).
