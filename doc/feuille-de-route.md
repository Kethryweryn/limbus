---
titre: Feuille de route
date: 2026-10-29
statut: en cours
---

# Feuille de route

L'ordre dans lequel on mène les chantiers, et pourquoi. Chaque étape suit le cycle habituel ([README](README.md)) : fiche, spec, epic et US. On met ce document à jour quand une étape se termine, ou quand l'ordre change.

Le principe : rien n'est encore réellement utilisé en production, donc la sécurité n'est pas prioritaire. On finit d'abord ce qui existe, puis on construit les grosses fonctionnalités, qui ont le plus de valeur pour un GN, et on pose les fondations de sécurité et d'exploitation juste avant d'ouvrir Limbus à tout le monde.

## Fait

- Inscriptions, lot 1 : période d'inscription et mode invitation ([EPIC-001](archive/epics/EPIC-001-inscription-sur-invitation/README.md)).
- Legs d'une copie de jeu ([EPIC-002](archive/epics/EPIC-002-legs-de-jeu/README.md)).
- Revue d'architecture et nettoyages techniques ([revue du 2026-10-29](revues/2026-10-29-architecture.md)).
- Documentation de l'existant : SPEC-003 à SPEC-010 ([fiche](archive/todo/documentation-de-l-existant.md)).
- Écarts de SPEC-003, écriture d'un jeu ([EPIC-003](archive/epics/EPIC-003-ecarts-ecriture-d-un-jeu/README.md)).
- Écarts de SPEC-004, sessions et cycle de vie ([EPIC-004](archive/epics/EPIC-004-ecarts-sessions/README.md)).

## 1. Finir les écarts des specs de l'existant

On implémente tous les écarts d'une spec à la fois, dans l'ordre des specs :

1. [SPEC-005](specs/SPEC-005-trombinoscopes-et-pdf.md) : ordre des photos, soi-même dans son trombinoscope, trombinoscopes périmés.
2. [SPEC-006](specs/SPEC-006-emails-et-paiements.md) : renvoi d'une version à jour, échecs d'envoi, montant et paiement partiel.
3. [SPEC-007](specs/SPEC-007-participants-et-rgpd.md), écarts 2, 4 et 5 : retrait complet d'un jeu, export complet, `Participant.published`.
4. [SPEC-008](specs/SPEC-008-comptes-et-partage.md), écarts 5 et 6 : jeton d'invitation en clair, dernière administratrice.
5. [SPEC-009](specs/SPEC-009-page-publique.md), écarts 1, 2 et 4 : crédit d'une copie, lien stable, traceurs YouTube.
6. [SPEC-010](specs/SPEC-010-hors-ligne.md), hors ligne : déconnexion sans réseau, sous-routes mises en file, envoi de la file à l'ouverture, page de session hors ligne. L'écart 2 (resynchronisation) est le gros morceau : il reprend la fiche [Resynchronisation hors ligne](todo/resynchronisation-hors-ligne.md).

Ces écarts sont traités plus loin, dans le chantier qui les réécrit :

- SPEC-008, écarts 1 à 4 (invitation par la bonne adresse, libre-service, quitter et transférer un jeu), et SPEC-007, écart 1 (fiche commune entre équipes) : refonte des comptes (étape 3) ;
- SPEC-009, écart 3 (sessions et lien d'inscription sur la page publique) : formulaire public des inscriptions (étape 4) ;
- SPEC-007, écart 3 (durée de conservation) : fiche [Photos et RGPD](todo/photos-et-rgpd.md) (étape 5).

## 2. Tests de bout en bout des parcours

La fiche [Tests de bout en bout des parcours](todo/tests-e2e-des-parcours.md) : ils protègent les gros chantiers qui suivent.

## 3. Refonte des comptes

La fiche [Un compte pour tout le monde](todo/comptes-participants.md) : on tranche ses points ouverts, puis on réalise ses lots dans l'ordre :

1. un seul rôle global (administrateur oui ou non), les droits venant des jeux ;
2. inscription libre et compte en libre-service ;
3. notes d'organisation propres à chaque équipe ;
4. compte participant et bascule entre « J'organise » et « Je participe » ;
5. coordonnées tenues par la personne ;
6. export et effacement depuis le compte ;
7. documents et trombinoscopes dans le compte.

Elle passe avant la suite des inscriptions : le formulaire public devra rattacher une personne à son compte.

Fusionner, c'est mettre en production : l'inscription libre (lot 2) reste fermée en production jusqu'à l'étape 5, qui l'ouvre avec les conditions d'utilisation et la politique de confidentialité que demande la fiche. L'effacement depuis le compte (lot 6) prévoit la durée de conservation, tranchée à l'étape 5, sans la figer.

## 4. Suite des inscriptions et du casting

Les lots 2 à 6 de [SPEC-001](specs/SPEC-001-inscriptions.md), un epic chacun :

1. formulaire public, inscription permanente et lien de diffusion, avec l'écart 3 de SPEC-009 ;
2. sélection : retenus, liste d'attente, tirage ;
3. affinités ;
4. relations entre personnages et questionnaire relié aux rôles ;
5. assistant de casting.

## 5. Fondations avant d'ouvrir Limbus

L'inscription libre fera venir des personnes inconnues, avec leurs données. Avant de l'ouvrir en production et d'annoncer l'ouverture :

1. [Photos et RGPD](todo/photos-et-rgpd.md) : information des personnes et durée de conservation, après avoir confirmé la base légale auprès d'une source juridique.
2. [Durcissement web](todo/durcissement-web.md) : CSP, origine des écritures, cookie.
3. [Supervision](todo/supervision.md) : être alerté quand le site tombe.
4. Conditions d'utilisation et politique de confidentialité ([fiche des comptes](todo/comptes-participants.md)), puis ouverture de l'inscription libre.

## 6. Première version publique

La fiche [Numéros de version et notes de version](todo/versions-et-notes-de-version.md) : publier la 1.0.0 et ses notes, puis annoncer l'ouverture.

## Sans dépendance forte

- [API pour une IA](todo/api-pour-ia.md) : après la refonte des comptes, dont dépendent ses droits.
- [Interface en TypeScript](todo/interface-en-typescript.md) : au fil de l'eau, quand on touche une page, ou en une passe à part.

## Exploitation

- Redémarrer le serveur après les mises à jour en attente, au moment choisi par l'utilisatrice. Le détail reste hors du dépôt, qui est public.
- Le 3 novembre 2026 : anciennes sauvegardes non chiffrées sur Dedibackup, à supprimer seulement avec son accord.
