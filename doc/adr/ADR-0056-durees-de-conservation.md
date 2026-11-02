---
id: ADR-0056
titre: Comptes inactifs et fiches sans compte effacés à la connexion, en tâche de fond
statut: accepté
date: 2026-11-02
liens: [../specs/SPEC-013-pages-legales-et-conservation.md, ADR-0043-effacement-du-compte.md, ADR-0044-copies-des-envois.md, ADR-0054-photos-des-participants.md]
---

# ADR-0056 : Comptes inactifs et fiches sans compte effacés à la connexion, en tâche de fond

## Contexte

[SPEC-013](../specs/SPEC-013-pages-legales-et-conservation.md), règle L6. Les durées choisies sont :

- 24 mois sans activité pour un compte, avec un avertissement à 23 mois ;
- 3 ans pour une fiche sans compte.

Limbus n'a pas de tâche planifiée : les autres purges passent à la connexion (ADR-0044, ADR-0054).

## Décision

- **Activité d'un compte** : `User.lastSeenAt`.
  - Il est mis à jour à la connexion, puis par `loadAuthUser` quand il date de plus d'un jour, sans attendre la réponse. Une mise à jour efface `inactivityWarnedAt`.
  - La migration le crée à la date du déploiement pour les comptes existants : personne n'est effacé à cause d'un passé qu'on ne connaît pas.
- **Purge** : `purgeRetention(now)` (`server/utils/retention.ts`), lancée après chaque connexion réussie sans être attendue. Une erreur est journalisée, jamais renvoyée. Une seule tourne à la fois ; une demande faite pendant un passage en relance un juste après. Elle fait trois choses :
  1. Elle avertit par email les comptes confirmés, non désactivés, inactifs depuis 23 mois et pas encore avertis (`inactivityWarnedAt`).
  2. Elle efface par `deleteOwnAccount` les comptes inactifs depuis 24 mois et avertis depuis 25 jours au moins. Un refus (jeux possédés, dernière administratrice) est signalé une fois aux administratrices (`inactivityReportedAt`), et le compte est gardé.
  3. Elle efface par `eraseParticipant`, 50 au plus par passage, les fiches sans compte dont aucune activité n'est récente : ajout à un jeu, modification, inscription, ou session où elles ont un rôle ou un personnage, datée ou à défaut créée.
- Les durées viennent de `RETENTION` (`utils/legal.ts`), que la politique de confidentialité affiche.

## Conséquences

- Un compte n'est effacé que s'il a été averti, et au moins 25 jours avant. Sans SMTP, l'avertissement ne part pas : le compte n'est pas marqué averti et reste gardé.
- Une fiche liée à un jeu encore actif mais sans rien de récent à son nom est effacée : c'est voulu, l'équipe peut la recréer.

## Options écartées

- **Tâche planifiée (cron)** : Limbus n'en a pas, et une échéance en mois ou en années n'en demande pas.
- **Désactiver au lieu d'effacer** : les données resteraient, ce que la durée annoncée exclut.
