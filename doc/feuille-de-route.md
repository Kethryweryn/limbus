---
titre: Feuille de route
date: 2026-10-29
statut: en cours
---

# Feuille de route

L'ordre dans lequel on mène les chantiers, et pourquoi. Chaque étape suit le cycle habituel ([README](README.md)) : fiche, spec, epic et US. On met ce document à jour quand une étape se termine, ou quand l'ordre change.

Le principe : rien n'est encore réellement utilisé en production, donc la sécurité n'est pas prioritaire. On finit d'abord ce qui existe, puis on construit les grosses fonctionnalités, qui ont le plus de valeur pour un GN, et on pose les fondations de sécurité et d'exploitation. Ce document ordonne les chantiers ; il ne fixe ni la date ni les conditions de l'ouverture de Limbus, que décide l'utilisatrice.

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
- Refonte des comptes, lot 6 : télécharger ses données et effacer son compte (fiches comprises), équipes prévenues ([EPIC-017](archive/epics/EPIC-017-export-et-effacement/README.md)).
- Refonte des comptes, lot 7 : une copie de chaque envoi, lue dans « Je participe » jusqu'au lendemain de la session, puis la version actuelle ([EPIC-018](archive/epics/EPIC-018-documents-dans-le-compte/README.md)).
- Suite des inscriptions, lot 2 (première moitié) : questions propres au jeu et affinités dans le formulaire ([EPIC-019](archive/epics/EPIC-019-formulaire-complet/README.md)).
- Suite des inscriptions, lot 2 (seconde moitié) : formulaire public, lien de diffusion, inscription permanente et page publique qui montre sessions et inscription ([EPIC-020](archive/epics/EPIC-020-formulaire-public/README.md)). Corrige l'écart 3 de SPEC-009.
- Suite des inscriptions, lot 3 (première moitié) : sélection à la main, annonce des résultats, liste d'attente par session, confirmation de sa place, vivier de l'inscription permanente ([EPIC-021](archive/epics/EPIC-021-selection-a-la-main/README.md)).
- Suite des inscriptions, lot 3 (seconde moitié) : tirage au sort reproductible, mode mixte, priorité aux non retenus, équilibre selon un attribut des personnages, journal des tirages ([EPIC-022](archive/epics/EPIC-022-tirage-au-sort/README.md)).
- Suite des inscriptions, lot 4 : affinités rattachées aux personnes du jeu avec suggestions, alertes « ne pas croiser » et repères « veut jouer avec » dans la sélection ([EPIC-023](archive/epics/EPIC-023-affinites/README.md)).
- Suite des inscriptions, lot 5 : relations orientées entre personnages, visibles au choix dans la fiche envoyée ; questionnaire relié aux personnages, factions et intrigues ; relations refusées en cases ([EPIC-024](archive/epics/EPIC-024-relations-et-questionnaire/README.md)).
- Suite des inscriptions, lot 6 : assistant de casting dans le cast de la session, avec notes tirées du questionnaire, interdits, cadenas et réservation pour les personnes retenues ([EPIC-025](archive/epics/EPIC-025-assistant-de-casting/README.md)). SPEC-001 terminée.

## 1. Finir les écarts des specs de l'existant

Les écarts de SPEC-003 à SPEC-010 sont corrigés, sauf ceux traités plus loin, dans le chantier qui les réécrit :

- SPEC-009, écart 3 (sessions et lien d'inscription sur la page publique) : formulaire public des inscriptions (étape 4) ;
- SPEC-007, écart 3 (durée de conservation) : celle des photos est fixée ([SPEC-012](specs/SPEC-012-photos-des-participants.md)) ; celle des comptes et des fiches sans compte aussi ([SPEC-013](specs/SPEC-013-pages-legales-et-conservation.md), EPIC-030).

## 2. Tests de bout en bout des parcours

Fait ([EPIC-011](archive/epics/EPIC-011-tests-e2e-des-parcours/README.md)) : ils protègent les gros chantiers qui suivent.

## 3. Refonte des comptes

La fiche [Un compte pour tout le monde](archive/todo/comptes-participants.md), tranchée dans [SPEC-011](specs/SPEC-011-un-compte-pour-tout-le-monde.md) ; ses lots, dans l'ordre (les sept lots sont faits) :

1. un seul rôle global (administrateur oui ou non), les droits venant des jeux ;
2. inscription libre et compte en libre-service ;
3. notes d'organisation propres à chaque équipe ;
4. compte participant et bascule entre « J'organise » et « Je participe » ;
5. coordonnées tenues par la personne ;
6. export et effacement depuis le compte ;
7. documents et trombinoscopes dans le compte.

Elle passe avant la suite des inscriptions : le formulaire public devra rattacher une personne à son compte.

Fusionner, c'est mettre en production : l'inscription libre (lot 2) reste fermée en production tant que l'utilisatrice ne décide pas de l'ouvrir. Les conditions d'utilisation et la politique de confidentialité que demande la fiche sont à l'étape 5. L'effacement depuis le compte (lot 6) prévoit la durée de conservation, tranchée à l'étape 5, sans la figer.

## 4. Suite des inscriptions et du casting

Les lots 2 à 6 de [SPEC-001](specs/SPEC-001-inscriptions.md), un epic chacun (le lot 2 en deux) :

1. formulaire complet, formulaire public, inscription permanente et lien de diffusion, avec l'écart 3 de SPEC-009 (fait) ;
2. sélection : retenus, liste d'attente, tirage au sort, mode mixte et pondérations (fait) ;
3. affinités (fait) ;
4. relations entre personnages et questionnaire relié aux rôles (fait) ;
5. assistant de casting (fait).

Puis la [qualité du questionnaire de casting](specs/SPEC-015-qualite-du-questionnaire.md), en trois lots, faits : repères sur les liens ([EPIC-037](archive/epics/EPIC-037-qualite-du-questionnaire-liens/README.md)), repères sur les réponses ([EPIC-039](archive/epics/EPIC-039-qualite-du-questionnaire-reponses/README.md)), estimation générale ([EPIC-040](archive/epics/EPIC-040-qualite-du-questionnaire-estimation/README.md)). Ensuite, l'[aide à la conception du questionnaire](specs/SPEC-016-conception-du-questionnaire.md), en trois lots, faits : essai par l'équipe ([EPIC-038](archive/epics/EPIC-038-essai-du-questionnaire/README.md)), prévision ([EPIC-041](archive/epics/EPIC-041-prevision-du-questionnaire/README.md)), relecture et mélange des options ([EPIC-042](archive/epics/EPIC-042-relecture-et-melange-du-questionnaire/README.md)).

## 5. Fondations de sécurité et d'exploitation

L'inscription libre peut faire venir des personnes inconnues, avec leurs données. Ces chantiers en posent les fondations, sans décider de son ouverture :

1. [Photos et RGPD](archive/todo/photos-et-rgpd.md) : information des personnes et durée de conservation. Fait ([SPEC-012](specs/SPEC-012-photos-des-participants.md), [EPIC-028](archive/epics/EPIC-028-photos-des-participants/README.md)) : information sans accord préalable, choix de l'utilisatrice, à revoir après l'avis d'un juriste.
2. [Durcissement web](todo/durcissement-web.md) : CSP, origine des écritures, cookie. Fait ([EPIC-027](archive/epics/EPIC-027-durcissement-web/README.md)), la CSP en mode rapport ; reste à la rendre bloquante après une semaine de rapports.
3. [Supervision](todo/supervision.md) : être alerté quand le site tombe. Fait : page de santé ([EPIC-026](archive/epics/EPIC-026-supervision/README.md)) et sondes Better Stack ; les journaux structurés attendront un besoin.
4. Conditions d'utilisation et politique de confidentialité ([fiche des comptes](archive/todo/comptes-participants.md), [SPEC-013](specs/SPEC-013-pages-legales-et-conservation.md)). Pages, acceptation et durées de conservation faites ([EPIC-029](archive/epics/EPIC-029-pages-legales/README.md), [EPIC-030](archive/epics/EPIC-030-durees-de-conservation/README.md)). L'inscription libre s'ouvre par un réglage du serveur (`SIGNUP_OPEN=1`), quand l'utilisatrice le décide.

## 6. Nouveautés

La page « Nouveautés » et le numéro de déploiement ([SPEC-017](specs/SPEC-017-nouveautes.md)), en un lot, fait ([EPIC-043](archive/epics/EPIC-043-nouveautes/README.md)).

## Sans dépendance forte

- [Jeux de test à jour](archive/todo/jeux-de-test.md) : trois jeux rechargeables, pour essayer tout ce qui existe. Fait ([EPIC-044](archive/epics/EPIC-044-jeux-de-test/README.md)).
- [Retours du cahier de tests](archive/todo/retours-du-cahier-de-tests.md) : les défauts signalés pendant les essais. Fait ([EPIC-045](archive/epics/EPIC-045-retours-du-cahier-de-tests/README.md)).
- [Un seul mode d'inscription, le vivier permanent](archive/todo/vivier-permanent.md) : retour A4-4 du cahier de tests. Fait ([SPEC-018](specs/SPEC-018-vivier-permanent.md)), en trois lots ([EPIC-046](archive/epics/EPIC-046-vivier-unique/README.md), [EPIC-047](archive/epics/EPIC-047-demande-de-disponibilites/README.md), [EPIC-048](archive/epics/EPIC-048-casting-depuis-le-vivier/README.md)).
- [Revue du schéma de données](archive/todo/schema-de-donnees.md) : index, valeurs et règles tenues par la base, dates avec fuseau. Fait ([EPIC-049](archive/epics/EPIC-049-schema-de-donnees/README.md)).
- [Plusieurs tests de bout en bout par écran](archive/todo/tests-par-ecran.md) : chaque écran testé sur quatre axes. Fait ([EPIC-050](archive/epics/EPIC-050-tests-par-ecran/README.md)) ; depuis, tout développement ajoute ses tests ([ADR-0079](adr/ADR-0079-tests-de-chaque-developpement.md)).
- [Gérer depuis son compte les données gardées pour le hors ligne](archive/todo/cache-hors-ligne-dans-le-compte.md) : télécharger un jeu ou ses sessions à venir, voir la place prise, effacer, désactiver sur un appareil. Fait ([SPEC-019](specs/SPEC-019-hors-ligne-dans-le-compte.md)), en trois lots ([EPIC-051](archive/epics/EPIC-051-gerer-le-hors-ligne/README.md), [EPIC-052](archive/epics/EPIC-052-telecharger-un-jeu/README.md), [EPIC-053](archive/epics/EPIC-053-telecharger-ses-sessions/README.md)).
- [Revoir la page Inscriptions](archive/todo/page-inscriptions.md) : retour D1-1 du cahier de tests ; un résumé des jeux, puis une page par jeu en onglets. Fait ([SPEC-020](specs/SPEC-020-page-inscriptions.md)), en un lot ([EPIC-054](archive/epics/EPIC-054-page-inscriptions/README.md)).
- [Une session sans nom](archive/todo/session-sans-nom.md) : retour D2-1 du cahier de tests ; une session se lit par sa date. Fait ([SPEC-021](specs/SPEC-021-session-sans-nom.md)), en un lot ([EPIC-055](archive/epics/EPIC-055-session-sans-nom/README.md)).
- [Un compte pour chaque participant](archive/todo/compte-pour-chaque-participant.md) : chaque fiche appartient à la personne. Spécifié ([SPEC-022](specs/SPEC-022-compte-pour-chaque-participant.md)), en trois lots ; lot 1 terminé ([EPIC-056](archive/epics/EPIC-056-une-fiche-par-personne/README.md)), lots 2 et 3 à découper.
- [API pour une IA](archive/todo/api-pour-ia.md) : après la refonte des comptes, dont dépendent ses droits. Spécifiée ([SPEC-014](specs/SPEC-014-api-pour-ia.md)), en quatre lots.
- [Interface en TypeScript](archive/todo/interface-en-typescript.md) : fait en une passe à part ([EPIC-031](archive/epics/EPIC-031-interface-en-typescript/README.md)) ; toute l'interface est en TypeScript strict, et la règle de lint couvre tous les `.vue`.

## Exploitation

- Anciennes sauvegardes non chiffrées sur Dedibackup, à supprimer seulement avec son accord.
