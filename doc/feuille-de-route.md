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
- Écarts de SPEC-005, trombinoscopes ([EPIC-005](archive/epics/EPIC-005-ecarts-trombinoscopes/README.md)).
- Écarts de SPEC-006, envois et paiements ([EPIC-006](archive/epics/EPIC-006-ecarts-envois-et-paiements/README.md)).
- Écarts 2, 4 et 5 de SPEC-007, participants, avec le désistement tardif et le remplaçant ([EPIC-007](archive/epics/EPIC-007-ecarts-participants/README.md)).
- Écarts 5 et 6 de SPEC-008, sécurité des comptes ([EPIC-008](archive/epics/EPIC-008-ecarts-comptes/README.md)).
- Écarts 1, 2 et 4 de SPEC-009, page publique ([EPIC-009](archive/epics/EPIC-009-ecarts-page-publique/README.md)).
- Écarts de SPEC-010, hors ligne, avec la resynchronisation ([EPIC-010](archive/epics/EPIC-010-ecarts-hors-ligne/README.md)).
- Tests de bout en bout des parcours : casting, trombinoscopes, envoi des documents, paiements, session hors ligne ([EPIC-011](archive/epics/EPIC-011-tests-e2e-des-parcours/README.md)).
- Refonte des comptes, lot 1 : un seul rôle global, quitter et transférer un jeu ([SPEC-011](specs/SPEC-011-un-compte-pour-tout-le-monde.md), [EPIC-012](archive/epics/EPIC-012-roles/README.md)).
- Refonte des comptes, lot 2 : inscription libre (fermée en production), confirmation de l'adresse, compte en libre-service, mot de passe oublié, invitation par la bonne adresse, plafond de stockage ([EPIC-013](archive/epics/EPIC-013-inscription-et-compte/README.md)). Corrige l'écart 1 de SPEC-008.
- Refonte des comptes, lot 3 : une note par jeu sur la fiche d'une personne ([EPIC-014](archive/epics/EPIC-014-notes-par-jeu/README.md)).
- Refonte des comptes, lot 4 : fiches rattachées au compte, espace « Je participe » (sessions, inscriptions, paiements, réponse et désistement depuis le compte), sélecteur d'espace ([EPIC-015](archive/epics/EPIC-015-je-participe/README.md)).
- Refonte des comptes, lot 5 : coordonnées et allergies tenues par la personne dans son compte, recopiées pour chaque équipe ([EPIC-016](archive/epics/EPIC-016-coordonnees-tenues-par-la-personne/README.md)). Termine l'écart 1 de SPEC-007.

## 1. Finir les écarts des specs de l'existant

Les écarts de SPEC-003 à SPEC-010 sont corrigés, sauf ceux traités plus loin, dans le chantier qui les réécrit :

- SPEC-009, écart 3 (sessions et lien d'inscription sur la page publique) : formulaire public des inscriptions (étape 4) ;
- SPEC-007, écart 3 (durée de conservation) : fiche [Photos et RGPD](todo/photos-et-rgpd.md) (étape 5).

## 2. Tests de bout en bout des parcours

Fait ([EPIC-011](archive/epics/EPIC-011-tests-e2e-des-parcours/README.md)) : ils protègent les gros chantiers qui suivent.

## 3. Refonte des comptes

La fiche [Un compte pour tout le monde](todo/comptes-participants.md), tranchée dans [SPEC-011](specs/SPEC-011-un-compte-pour-tout-le-monde.md) ; ses lots, dans l'ordre (les lots 1 à 5 sont faits) :

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
