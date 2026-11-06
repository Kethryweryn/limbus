---
id: ADR-0069
titre: Vivier unique par jeu et statut d'inscription par session
statut: accepté
date: 2026-11-06
liens: [../specs/SPEC-018-vivier-permanent.md, ADR-0019-modele-des-inscriptions.md, ADR-0021-inscription-et-participation-de-session.md, ADR-0024-migrations-compatibles-avec-le-build-en-service.md, ADR-0046-formulaire-public-des-inscriptions.md, ADR-0047-selection-des-inscriptions.md, ADR-0048-tirage-au-sort.md]
---

# ADR-0069 : Vivier unique par jeu et statut d'inscription par session

## Contexte

[SPEC-018](../specs/SPEC-018-vivier-permanent.md) ne garde qu'un vivier par jeu, et une personne peut avancer sur plusieurs sessions en parallèle. Or `Registration` ne porte qu'un statut et qu'une session (ADR-0047 : « une personne du vivier ne joue qu'une session à la fois »), et les disponibilités et la liste d'attente vivent dans deux tables à part.

## Décision

- **Vivier** : `RegistrationPeriod` reste la table, avec une contrainte unique sur `gameId`. Les colonnes `scope`, `entryMode`, `closesAt`, `selectionMode` et les réglages du tirage en sortent. L'interface et le nouveau code disent « vivier ».
- **Personne du vivier** : `Registration` garde ses réponses, ses coordonnées et ses affinités, avec une ligne par personne et par vivier. Ses statuts se réduisent à `invited`, `received` (intéressée) et `withdrawn` (sortie du vivier). `invitedSessionId` garde la session visée par une invitation sans réponse (R4).
- **Statut par session** : une nouvelle table `RegistrationSession` (inscription, session, unique par couple) porte le statut `preregistered`, `unavailable`, `waitlisted`, `retained`, `confirmed`, `transferred` ou `cancelled`, la dernière réponse de la personne (`answer` : `available`, `unavailable` ou vide, à laquelle elle revient si elle sort du cast sans annonce, R28), ainsi que la position en liste d'attente, les dates de demande, de relance, de réponse, d'échéance, de confirmation et d'annulation, l'autrice de la décision, ce qui a été annoncé, et le repère de réponses modifiées. Elle remplace `RegistrationAvailability`, `RegistrationWaitlistEntry` et les colonnes de décision de `Registration`.
- **Session ouverte** : `RegistrationPeriodSession` garde une ligne par session, avec `open`, `selectionMode`, `organizerPicks`, les pondérations et `waitlistSize`. Elle est proposée au vivier si `open` est vrai et si, à la lecture, elle est datée, à venir, ni annulée ni terminée. Le casting se fait sur toute session qui a une ligne.
- **Places** : se calculent à la lecture, avec `countPlayableCharacters`. `RegistrationPeriodSession.seats` et `Session.poolSeats` disparaissent, ainsi que l'outil `regler_places_vivier`.
- **Personnes hors vivier** : un PNJ, l'équipe cuisine ou une organisatrice restent dans `SessionParticipant` et le tableau des paiements, sans `Registration` ni ligne de statut. Un joueur ne peut plus être créé sans `Registration`.
- **Tirage** : `RegistrationDraw` gagne `sessionId`. Un tirage porte sur une session, avec au plus un tirage actif par session. L'algorithme de `utils/registrationDraw.ts` ne change pas.
- **Réserve de personnage** : `SessionAssignment.reservedRegistrationId` ne change pas, l'attribution étant déjà liée à une session.
- **Inscrite validée** : se calcule à la lecture : une ligne `confirmed`, et `hasPaidSomething` vrai (versement reçu, reporté, ou case « payé » en mode simple), ou rien à payer selon le tableau des paiements (place offerte, aucun tarif pour elle dans une session à tarifs). Rien n'est stocké. Un remboursement ou un remplacement passe la ligne à `cancelled`, le calcul n'a donc pas à les traiter.
- **Report** : recopier l'équipe recopie aussi les lignes `retained` et `confirmed` vers la nouvelle session, et passe celles de l'ancienne à `transferred`. Un refus de présence passe les deux à `cancelled`.
- **Bascule** en deux migrations, pour respecter ADR-0024 :
  1. Une migration ajoute les tables et colonnes, puis recopie les données :
     - **Vivier** : par jeu, on garde la période permanente ouverte, sinon la plus ancienne, avec son lien de diffusion. Il est ouvert si une période du jeu l'était.
     - **Sessions** : une ligne pour chaque session d'une période et chaque session non close qui était proposée par la période permanente. `open` n'est vrai que pour une session datée et à venir.
     - **Personnes** : pour une personne présente plusieurs fois, la ligne la plus récemment modifiée parmi celles qui ont répondu est gardée. Les affinités de cette ligne restent ; celles des autres lignes disparaissent avec leurs réponses. Listes d'attente, réserves de personnage et statuts par session sont rattachés à la ligne gardée.
     - **Statuts** : `retained`, `waitlisted` et `confirmed` donnent la même valeur sur la session concernée, annonce comprise. `received` et `rejected` donnent `preregistered` sur chaque session de ses disponibilités, ou sur l'unique session de sa période. `withdrawn` avec une session donne `cancelled`. `invited` avec une session reste une invitation pour cette session, sans ligne. Sur `Registration`, le statut devient `invited` pour une invitation restée sans réponse, `withdrawn` si toutes les lignes reprises de la personne l'étaient, et `received` sinon.
     - **Le reste** : les demandes (`RegistrationRequest`) et les tirages passent au vivier gardé. Les anciens tirages restent au journal, sans session et non annulables.
     US-160, US-161 et US-171 sont livrées dans une même PR, avec cette migration : aucun déploiement ne fait cohabiter deux sources du statut. Une écriture faite par l'ancien build pendant le déploiement n'est pas recopiée, ce qui est accepté tant que la production n'a que des données de test. La migration s'exécute en une seule transaction : une erreur ne laisse pas la base à moitié convertie.
  2. Une fois tout le code passé au nouveau modèle, une migration retire l'ancien, avec le commentaire `-- deploiement-incompatible`.
- **Remplacement** : ADR-0047 est remplacé par celui-ci. ADR-0046 et ADR-0048 gardent ce qui n'est pas contredit ici, et le disent en tête.

## Conséquences

- Compter les places, calculer les alertes, lire « Je participe » et les fiches allergies se fait à partir de `RegistrationSession`. Toutes les fonctions de `server/utils/registration*.ts`, les outils `server/mcp/registration*.ts`, `gameCopy`, la confidentialité, les tests et `prisma/seed/` sont concernés.
- Les joueurs déjà au cast sans `Registration` restent tels quels après la bascule : ils ne viennent que de données de test, que le rechargement remplace.
- Une session peut être en surnombre après la suppression d'un personnage : l'écran le signale.
- Les noms de tables « Period » ne correspondent plus au vocabulaire. C'est assumé pour limiter le risque de la migration.
- La date de demande de disponibilités et de relance est sur `RegistrationPeriodSession.lastRequestedAt`, non sur la ligne : une personne sans réponse n'a pas de ligne `RegistrationSession` (US-166).
- La seconde migration est livrée (`20261113090000_retire_ancien_vivier`) : l'ancien modèle n'existe plus, ni `RegistrationPeriod.name`, puisqu'un vivier n'a plus de nom.
- L'export d'une personne suit `visibleLineStatus` : une décision pas encore annoncée n'y figure pas, comme sur sa page. L'export demandé à l'équipe garde tout. Choix de l'utilisatrice à la revue.
- Les liens de diffusion des périodes absorbées cessent de marcher. Seules des données de test sont concernées aujourd'hui.

## Options écartées

- **Une inscription par session** : il faudrait copier réponses et affinités à chaque session, c'est ce que le vivier veut éviter.
- **Garder les tables de disponibilités et de liste d'attente et ajouter un statut** : le statut d'une personne pour une session se lirait à trois endroits, qui peuvent se contredire.
- **Renommer les tables en `Pool`** : renommer est refusé par la CI sans raison forte (ADR-0024), pour un gain de lecture seulement.
- **Une entité « place » à part** : proposée par l'utilisatrice, à condition qu'elle simplifie. Une ligne `RegistrationSession` est déjà la place d'une personne sur une session. Un remplacement annule une ligne, la remplaçante du vivier a déjà la sienne, un report passe l'ancienne à `transferred`, et `SessionPayment` garde les liens de transfert et de report. Une entité de plus devrait rester synchronisée avec cette ligne et n'ajouterait aucune information.
- **Stocker « inscrite validée »** : le statut se désynchroniserait des paiements, corrigés à la main.
