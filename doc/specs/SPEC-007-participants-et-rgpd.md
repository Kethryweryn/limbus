---
id: SPEC-007
titre: Participants et données personnelles
statut: validée
date: 2026-10-29
origine: ../archive/todo/documentation-de-l-existant.md
epics: [EPIC-007]
adr: [ADR-0007, ADR-0008]
---

# SPEC-007 : Participants et données personnelles

Cette spec décrit un comportement déjà en production, avant la reprise du développement ([Documentation de l'existant](../archive/todo/documentation-de-l-existant.md)). Les écarts 2, 4 et 5, listés à la fin, sont corrigés par [EPIC-007](../archive/epics/EPIC-007-ecarts-participants/README.md) ; les écarts 1 et 3 relèvent de la refonte des comptes et de la fiche Photos et RGPD.

## Objectif

Tenir le carnet des personnes qui jouent, encadrent ou cuisinent aux jeux d'une équipe : leurs coordonnées, les jeux auxquels elles sont liées, et ce que Limbus garde sur elles. Répondre aux droits que le RGPD leur donne : accès à leurs données et effacement.

## Vocabulaire

- **Participant** : une personne réelle, sans compte dans Limbus. Une même fiche peut servir à plusieurs jeux.
- **Lien au jeu** : le rattachement d'un participant à un jeu. Il conditionne sa présence dans les sessions de ce jeu ([SPEC-004](SPEC-004-sessions.md), R4) et l'accès des organisatrices à sa fiche.
- **Données d'un participant** : sa fiche, et tout ce qui le concerne dans les sessions et les inscriptions : rôles, casting et photos, paiements, envois, responsabilités, trombinoscopes, inscriptions (coordonnées, contact d'urgence, régime et allergies, consentements).

## Acteurs

- **Organisatrice** : elle gère les participants liés aux jeux auxquels elle a accès.
- **Administratrice** : en mode administrateur, elle voit tous les participants, liés ou non.
- **Participant** : il n'agit pas dans Limbus. Il exerce ses droits en s'adressant à l'organisation, qui les applique.

## Parcours

### Tenir le carnet

1. Dans la page Participants, l'organisatrice crée une fiche : nom, email, téléphone, notes, et les jeux auxquels la personne est liée.
2. Elle cherche par nom, email, téléphone ou titre de jeu, et filtre par jeu. Le jeu actif limite la liste à ce jeu.
3. Elle modifie ou supprime une fiche.

Une inscription confirmée crée aussi la fiche, ou rattache une fiche existante au jeu ([SPEC-001](SPEC-001-inscriptions.md), R12, R22).

### Répondre à une demande d'accès

Sur la fiche, « Exporter ses données » télécharge un fichier JSON avec ce que Limbus garde sur la personne dans les jeux de l'organisatrice (R7, et voir les écarts).

### Répondre à une demande d'effacement

Depuis la liste, « Supprimer » efface la fiche et ses données, après une confirmation qui dit ce qui part et ce qui reste.

## Règles métier

### Fiche et liens aux jeux

- **R1** Une fiche a un nom (obligatoire), un email, un téléphone et des notes, sans format imposé pour l'email ni le téléphone. Elle a un slug unique, qui suit le nom. Elle n'a pas d'état « publié » ([US-038](../archive/epics/EPIC-007-ecarts-participants/US-038-retirer-participant-published.md)).
- **R2** Une fiche est commune à tous les jeux auxquels elle est liée : une modification se voit dans tous ces jeux. Sauf les notes : chaque jeu a la sienne, que seule l'équipe de ce jeu lit et modifie. Et dès que la personne a un compte, elle seule modifie son nom, son téléphone, son contact d'urgence et ses allergies, recopiés sur ses fiches ([EPIC-016](../archive/epics/EPIC-016-coordonnees-tenues-par-la-personne/README.md)) ([EPIC-014](../archive/epics/EPIC-014-notes-par-jeu/README.md), [US-069](../archive/epics/EPIC-014-notes-par-jeu/US-069-une-note-par-jeu.md)).
- **R3** Une organisatrice ne lie une fiche qu'à des jeux auxquels elle a accès. En modifiant une fiche, elle ne touche qu'aux liens de ces jeux : ceux des autres jeux restent.
- **R3b** Une fiche a toujours au moins un jeu : la créer en demande un, et retirer son dernier lien la supprime avec ses données (R10), après une confirmation ; une fiche encore liée au jeu d'une autre équipe reste ([US-036](../archive/epics/EPIC-007-ecarts-participants/US-036-une-fiche-a-toujours-un-jeu.md)).
- **R4** Retirer le lien à un jeu retire aussi la personne des sessions de ce jeu : équipe, casting (le personnage reste sans joueur ni photo), déroulé et présence. Ses inscriptions à ce jeu passent au statut « retirée » ; ses paiements restent, affichés à part ([US-035](../archive/epics/EPIC-007-ecarts-participants/US-035-retrait-d-un-jeu-et-de-ses-sessions.md)).
- **R5** À l'inscription, une personne est rapprochée d'une fiche existante par son email, parmi les jeux de la même propriétaire seulement ([SPEC-001](SPEC-001-inscriptions.md), R12). Hors inscription, rien ne rapproche deux fiches : la même personne peut en avoir plusieurs.
- **R6** Deux organisatrices qui modifient la même fiche en même temps ne s'écrasent pas : la seconde est refusée (409).

### Droit d'accès

- **R7** L'export contient la fiche et, pour chaque session, les rôles, le casting (personnage, notes et adresse de la photo), les paiements (avec leur remboursement), les envois, les responsabilités, les confirmations de présence et les trombinoscopes générés pour la personne, ainsi que ses inscriptions avec toutes leurs réponses, leurs dates (relance comprise) et le nom de l'organisatrice qui a invité ou retiré la personne ([US-037](../archive/epics/EPIC-007-ecarts-participants/US-037-export-complet-des-inscriptions.md)). Les fichiers eux-mêmes (photos) n'y sont pas joints.
- **R8** L'export est limité aux jeux de l'organisatrice qui exporte : une personne inscrite chez une autre équipe ne révèle pas les jeux de celle-ci. En mode administrateur, l'export est complet.

### Droit à l'effacement

- **R9** Seule une organisatrice qui a accès à tous les jeux liés à la fiche peut la supprimer. Sinon, la suppression est refusée (403), et chaque équipe peut seulement retirer ses propres liens.
- **R10** Supprimer une fiche efface, sans retour possible :
  - ses liens aux jeux, ses rôles dans les sessions et ses responsabilités ;
  - ses paiements et ses envois ;
  - ses inscriptions, avec leurs coordonnées, contacts d'urgence et allergies ;
  - les photos de ses attributions, fichiers compris, sauf celles qui servent encore ailleurs ;
  - ses trombinoscopes, et tous ceux des sessions où figurait sa photo, qui sont à générer à nouveau.
- **R11** Les personnages qu'elle jouait restent dans le casting des sessions, sans participant ni photo.
- **R12** La suppression n'est pas tracée : rien ne garde qu'elle a eu lieu, ni à la demande de qui.

### Conservation

- **R13** Une fiche et ses données sont gardées tant qu'on ne la supprime pas. Supprimer un jeu ne supprime pas ses participants ([SPEC-003](SPEC-003-ecriture-d-un-jeu.md), R4), et supprimer une session efface seulement ce qui la concerne ([SPEC-004](SPEC-004-sessions.md), R3). Il n'y a pas de durée de conservation (voir les écarts).

## Données

- `Participant` (fiche) et `ParticipantGame` (lien au jeu).
- Toutes les tables qui pointent vers un participant sont supprimées en cascade avec lui, sauf le casting (`SessionAssignment`), qui perd seulement son participant et sa photo.
- `eraseParticipant` et `exportParticipantData` (`server/utils/participantPrivacy.ts`) doivent couvrir toute nouvelle donnée liée à un participant.
- La photo de trombinoscope par défaut d'un personnage peut montrer une personne réelle. Elle n'est rattachée à aucun participant : ni l'export ni l'effacement ne la couvrent ([SPEC-003](SPEC-003-ecriture-d-un-jeu.md), Données).

## Sécurité et droits

- **R14** Une organisatrice ne voit, ne modifie et n'exporte que les fiches liées à au moins un de ses jeux, et ne voit que les liens vers ses jeux ([ADR-0007](../adr/ADR-0007-isolation-par-jeu.md)). Une fiche hors de ses jeux est refusée : « introuvable » (404) pour la modifier, l'exporter ou la supprimer, « inaccessible » (403) pour la lire.
- **R15** L'export est servi en pièce jointe, sans mise en cache. Les photos ne sont lues que par des routes qui vérifient les droits ([ADR-0008](../adr/ADR-0008-fichiers-televerses.md)).

## Hors périmètre

- Inscriptions, allergies et consentement santé : [SPEC-001](SPEC-001-inscriptions.md).
- Photos de session et trombinoscopes : [SPEC-004](SPEC-004-sessions.md), [SPEC-005](SPEC-005-trombinoscopes-et-pdf.md).
- Information des participants sur l'usage de leurs photos : fiche [Photos et RGPD](../todo/photos-et-rgpd.md).
- Comptes des participants : fiche [Un compte pour tout le monde](../todo/comptes-participants.md).

## Écarts constatés

Relevés le 29 octobre 2026 avec l'utilisatrice. Les écarts 2, 4 et 5 sont corrigés par [EPIC-007](../archive/epics/EPIC-007-ecarts-participants/README.md) (R3b, R4, R7, R1), l'écart 1 par [EPIC-014](../archive/epics/EPIC-014-notes-par-jeu/README.md) (notes par jeu) et [EPIC-016](../archive/epics/EPIC-016-coordonnees-tenues-par-la-personne/README.md) (coordonnées tenues par la personne qui a un compte) ; reste l'écart 3.

1. **Fiche commune entre équipes (R2)** : une fiche liée à des jeux de deux équipes (par un jeu partagé) montre à chacune les coordonnées et les notes saisies par l'autre, et chacune peut les modifier. Plutôt qu'une fiche par jeu, l'utilisatrice veut unifier vraiment la personne, avec un compte qui lui permette de gérer elle-même ses jeux et ses données : fiche [Un compte pour tout le monde](../todo/comptes-participants.md).
3. **Durée de conservation (R13)** : il faut une durée de conservation des données des participants, pas seulement des photos. Elle est à fixer dans la fiche [Photos et RGPD](../todo/photos-et-rgpd.md).

### Choix faits le 29 octobre 2026

Pour l'écart 2 (retrait d'un jeu) :

- **Retrait complet** : retirer une personne d'un jeu la retire aussi des sessions de ce jeu (équipe, casting, présence).
- **Inscriptions** : ses inscriptions aux périodes de ce jeu restent dans le suivi, au statut « retirée », comme un retrait par l'organisation.
- **Jeu obligatoire** : créer une fiche demande au moins un jeu ; retirer le dernier lien supprime la fiche, après confirmation. Les fiches sans jeu qui existent déjà sont supprimées par la migration.
- **Paiements**, d'après l'usage des GN : une date limite de désistement après laquelle la place n'est remboursée qu'au bon vouloir des orgas, et un remplaçant à qui la place peut être offerte. Cela touche aussi les paiements ([SPEC-006](SPEC-006-emails-et-paiements.md)) :
  - le paiement d'une personne qui se désiste ou est retirée reste affiché à part ; l'organisatrice choisit « à rembourser », « remboursé », « gardé, non remboursé » ou « transféré au remplaçant » : le montant compte alors comme payé par la personne qui reprend la place ;
  - une date limite de désistement se règle par session, dans l'onglet Paiements : avant elle, un désistement propose « à rembourser » ; après, « gardé, non remboursé », et l'organisatrice décide. La date figure dans l'email de paiement ;
  - une case « place offerte » par personne met son dû à 0 € et affiche « place offerte », sans créer de tarif.

Pour l'écart 4 (export) : la date de la dernière relance d'une inscription et le nom de l'organisatrice qui a invité ou retiré la personne sont exportés.

Pour l'écart 5 : `Participant.published` est retiré de l'API et de l'interface ; la colonne reste en base, sans usage.

