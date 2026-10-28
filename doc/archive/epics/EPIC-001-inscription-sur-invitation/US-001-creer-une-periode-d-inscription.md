---
id: US-001
titre: Créer et paramétrer une période d'inscription
statut: terminée
epic: EPIC-001
regles: [R1, R2, R3, R5, R6, R20]
adr: [ADR-0019, ADR-0020]
---

# US-001 : Créer et paramétrer une période d'inscription

En tant qu'organisatrice d'un jeu, je veux ouvrir une période d'inscription pour une ou plusieurs de ses sessions, afin d'y recruter les PJ.

## Critères d'acceptation

- [x] Sur la page du jeu, une section « Inscriptions » liste les périodes d'inscription du jeu (nom, état, sessions et places, délai, clôture) et permet d'en créer une.
- [x] Une période d'inscription porte :
  - un nom ;
  - une ou plusieurs sessions du jeu ;
  - le mode d'entrée (seul « invitation » est proposé dans cet epic) ;
  - une date de clôture facultative ;
  - un délai de réponse en jours (7 par défaut, de 1 à 90) ;
  - un nombre de places par session.
- [x] Étant donné une session déjà rattachée à une autre période d'inscription, quand je l'ajoute, alors l'enregistrement est refusé (409) avec un message qui nomme la session et la période (R1). Le formulaire grise ces sessions. Deux enregistrements simultanés sont départagés par la contrainte d'unicité.
- [x] Le modèle prévoit la portée « tout le jeu » de l'inscription permanente (R1, R30), mais l'interface de cet epic ne propose que la portée « sessions précises ». L'inscription permanente, qui est en mode formulaire, arrive avec EPIC-002.
- [x] Étant donné une session d'un autre jeu, quand je l'envoie à l'API, alors la requête est refusée (400 ou 403).
- [x] Le nombre de places proposé par défaut est le nombre de personnages PJ du jeu ; je peux le modifier pour chaque session (R5).
- [x] Une période d'inscription a un état : `brouillon`, `ouverte` ou `clôturée`. Elle est clôturée à la main ou par sa date de clôture, évaluée à la lecture (ADR-0020). Rouvrir une période dont la date est passée retire cette date, après confirmation.
- [x] Je peux supprimer une période d'inscription ; supprimer une session ou le jeu retire le rattachement en cascade.
- [x] Un co-organisateur du jeu a les mêmes droits ; un organisateur sans accès au jeu n'atteint rien.

Reporté aux US qui créent les inscriptions :

- le nombre d'inscrits par statut dans la liste (US-003, US-005) ;
- l'interdiction de supprimer une période qui a des inscriptions, au profit de sa clôture (faite par US-003) ;
- le refus des modifications par les inscrits après la clôture (R6, R13 : US-004).

> Depuis [US-009](US-009-page-inscriptions.md), cette section n'est plus sur la fiche du jeu, qui sert à l'écriture : elle est sur la page « Inscriptions » du menu Organisation (R33).

Après la revue de code du 2026-10-28 :

- Une modification qui omet l'état, la date de clôture ou le délai les conserve (elle ne les remet plus à leur valeur par défaut) ; `closesAt: null` retire la date.
- Ouvrir une période dont la date de clôture est passée est refusé avec une explication.
- Une session annulée ou terminée ne peut pas être ajoutée à une période.
- Le nombre de places est vérifié dans le formulaire (0 à 1000), et les messages de validation du serveur sont en français.
- La page Inscriptions charge toutes les périodes et leurs inscriptions en une requête ; le filtre par jeu respecte la case « Afficher les jeux archivés ».

## Réalisation

- Modèle : `RegistrationPeriod` et `RegistrationPeriodSession`, migration `20261028100000_add_registration_periods`. `publicId` est déjà généré pour le futur lien de diffusion (R32).
- Constantes dans `utils/domain.ts` ; état effectif calculé par `effectivePeriodState` (`utils/registrationPeriods.ts`), partagé entre le serveur et l'interface.
- Routes :
  - `GET/POST /api/registration-periods` ; la liste se filtre par `?gameId=` ;
  - `GET/PUT/DELETE /api/registration-periods/:id` ;
  - `GET /api/games/:id/registration-context` (sessions du jeu avec leur période, nombre de PJ).
- Contrôles serveur dans `server/utils/registrationPeriods.ts` : sessions du même jeu, session libre, places par défaut.
- Écrans : `RegistrationPeriodsPanel` sur la page du jeu, `RegistrationPeriodForm` en modale.

## Tests

- Unitaires : `tests/utils/registrationPeriods.test.ts` (état effectif), `tests/server/registrationPeriods.test.ts` (schéma, sessions et places, conflit d'unicité).
- Intégration : `tests/integration/registrationPeriods.test.ts` (création, places par défaut, conflit et concurrence, modification, clôture par date, contexte, cascades). `isolation.test.ts` couvre les routes de période et le contexte du jeu : lecture, liste, modification, suppression, création dans le jeu de Bob, sessions de Bob.
