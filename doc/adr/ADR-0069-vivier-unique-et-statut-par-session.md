---
id: ADR-0069
titre: Vivier unique par jeu et statut d'inscription par session
statut: proposé
date: 2026-11-06
liens: [../specs/SPEC-018-vivier-permanent.md, ADR-0019-modele-des-inscriptions.md, ADR-0021-inscription-et-participation-de-session.md, ADR-0024-migrations-compatibles-avec-le-build-en-service.md, ADR-0046-formulaire-public-des-inscriptions.md, ADR-0047-selection-des-inscriptions.md, ADR-0048-tirage-au-sort.md]
---

# ADR-0069 : Vivier unique par jeu et statut d'inscription par session

## Contexte

[SPEC-018](../specs/SPEC-018-vivier-permanent.md) ne garde qu'un vivier par jeu, et une personne peut avancer sur plusieurs sessions en parallèle. Or `Registration` ne porte qu'un statut et qu'une session (ADR-0047 : « une personne du vivier ne joue qu'une session à la fois »), et les disponibilités et la liste d'attente vivent dans deux tables à part.

## Décision

- **Vivier** : `RegistrationPeriod` reste la table, avec une contrainte unique sur `gameId`. Les colonnes `scope`, `entryMode`, `closesAt`, `selectionMode` et les réglages du tirage en sortent. L'interface et le nouveau code disent « vivier ».
- **Personne du vivier** : `Registration` garde ses réponses, ses coordonnées et ses affinités, avec une ligne par personne et par vivier. Ses statuts se réduisent à `invited`, `received` (intéressée) et `withdrawn` (sortie du vivier).
- **Statut par session** : une nouvelle table `RegistrationSession` (inscription, session, unique par couple) porte le statut `preregistered`, `unavailable`, `waitlisted`, `retained`, `confirmed` ou `cancelled`, ainsi que la position en liste d'attente, les dates de demande, de relance, de réponse, d'échéance, de confirmation et d'annulation, l'autrice de la décision, ce qui a été annoncé, et le repère de réponses modifiées. Elle remplace `RegistrationAvailability`, `RegistrationWaitlistEntry` et les colonnes de décision de `Registration`.
- **Session ouverte** : `RegistrationPeriodSession` garde une ligne par session, avec `open`, `seats`, `selectionMode`, `organizerPicks`, les pondérations et `waitlistSize`. `Session.poolSeats` y est repris. Une session sans ligne, ou avec `open` à faux, n'est pas proposée au vivier. Le casting se fait sur toute session qui a une ligne.
- **Tirage** : `RegistrationDraw` gagne `sessionId`. Un tirage porte sur une session, avec au plus un tirage actif par session. L'algorithme de `utils/registrationDraw.ts` ne change pas.
- **Réserve de personnage** : `SessionAssignment.reservedRegistrationId` ne change pas, l'attribution étant déjà liée à une session.
- **Inscrite validée** : se calcule à la lecture : une ligne `confirmed`, et un versement reçu sur la session ou reporté vers elle, ou rien à payer (place offerte, session sans tarif). Rien n'est stocké. Un remboursement ou un transfert passe la ligne à `cancelled`, le calcul n'a donc pas à les traiter. Un report crée ou reprend la ligne `confirmed` de la session d'arrivée.
- **Bascule** en deux migrations, pour respecter ADR-0024 :
  1. Une migration ajoute les tables et colonnes, puis recopie les données :
     - **Vivier** : par jeu, on garde la période permanente ouverte, sinon la plus ancienne, avec son lien de diffusion. Il est ouvert si une période du jeu l'était.
     - **Sessions** : une ligne pour chaque session d'une période et chaque session non close qui était proposée par la période permanente. Ses places viennent de la période, sinon de `poolSeats`, sinon du nombre de PJ. `open` n'est vrai que pour une session datée et à venir.
     - **Personnes** : pour une personne présente plusieurs fois, la ligne la plus récemment modifiée est gardée. Les affinités de cette ligne restent ; celles des autres lignes disparaissent avec leurs réponses. Listes d'attente, réserves de personnage et statuts par session sont rattachés à la ligne gardée.
     - **Statuts** : `retained`, `waitlisted` et `confirmed` donnent la même valeur sur la session concernée, annonce comprise. `received` et `rejected` donnent `preregistered` sur chaque session de ses disponibilités, ou sur l'unique session de sa période. `withdrawn` avec une session donne `cancelled`. `invited` avec une session redevient une invitation au vivier, sans ligne. Sur `Registration`, le statut devient `invited` pour une invitation restée sans réponse, `withdrawn` si toutes les lignes reprises de la personne l'étaient, et `received` sinon.
     - **Le reste** : les demandes (`RegistrationRequest`) et les tirages passent au vivier gardé. Les anciens tirages restent au journal, sans session et non annulables.
     US-160, US-161 et US-171 sont livrées dans une même PR, avec cette migration : aucun déploiement ne fait cohabiter deux sources du statut. Une écriture faite par l'ancien build pendant le déploiement n'est pas recopiée, ce qui est accepté tant que la production n'a que des données de test.
  2. Une fois tout le code passé au nouveau modèle, une migration retire l'ancien, avec le commentaire `-- deploiement-incompatible`.
- **Remplacement** : à la livraison d'EPIC-048, ADR-0047 passe à « remplacé par ADR-0069 ». ADR-0046 et ADR-0048 gardent ce qui n'est pas contredit ici, et le disent en tête.

## Conséquences

- Compter les places, calculer les alertes, lire « Je participe » et les fiches allergies se fait à partir de `RegistrationSession`. Toutes les fonctions de `server/utils/registration*.ts`, les outils `server/mcp/registration*.ts`, `gameCopy`, la confidentialité, les tests et `prisma/seed/` sont concernés.
- Les noms de tables « Period » ne correspondent plus au vocabulaire. C'est assumé pour limiter le risque de la migration.
- Les liens de diffusion des périodes absorbées cessent de marcher. Seules des données de test sont concernées aujourd'hui.

## Options écartées

- **Une inscription par session** : il faudrait copier réponses et affinités à chaque session, c'est ce que le vivier veut éviter.
- **Garder les tables de disponibilités et de liste d'attente et ajouter un statut** : le statut d'une personne pour une session se lirait à trois endroits, qui peuvent se contredire.
- **Renommer les tables en `Pool`** : renommer est refusé par la CI sans raison forte (ADR-0024), pour un gain de lecture seulement.
- **Une entité « place » à part** : proposée par l'utilisatrice, à condition qu'elle simplifie. Une ligne `RegistrationSession` est déjà la place d'une personne sur une session. Un transfert annule une ligne et en crée une pour la remplaçante, un report fait de même sur la session d'arrivée, et `SessionPayment` garde les liens de transfert et de report. Une entité de plus devrait rester synchronisée avec cette ligne et n'ajouterait aucune information.
- **Stocker « inscrite validée »** : le statut se désynchroniserait des paiements, corrigés à la main.
