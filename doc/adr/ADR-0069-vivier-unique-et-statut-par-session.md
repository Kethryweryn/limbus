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
- **Session ouverte** : `RegistrationPeriodSession` garde une ligne par session, avec `open`, `seats`, `selectionMode`, `organizerPicks`, les pondérations et `waitlistSize`. `Session.poolSeats` y est repris. Une session sans ligne n'est pas ouverte.
- **Tirage** : `RegistrationDraw` gagne `sessionId`. Un tirage porte sur une session, avec au plus un tirage actif par session. L'algorithme de `utils/registrationDraw.ts` ne change pas.
- **Réserve de personnage** : `SessionAssignment.reservedRegistrationId` ne change pas, l'attribution étant déjà liée à une session.
- **Inscrite validée** : se calcule à la lecture à partir de `SessionPayment`, de ses versements et des tarifs de la session. Rien n'est stocké.
- **Bascule** en deux migrations, pour respecter ADR-0024 :
  1. Une migration ajoute les tables et colonnes, puis recopie les données. Par jeu, le vivier gardé est la période permanente ouverte, sinon la plus ancienne. Pour une personne présente plusieurs fois, la ligne la plus récemment modifiée donne les réponses, et tous ses statuts par session sont repris. `rejected` devient `preregistered`.
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
- **Stocker « inscrite validée »** : le statut se désynchroniserait des paiements, corrigés à la main.
