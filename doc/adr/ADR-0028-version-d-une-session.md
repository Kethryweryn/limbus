---
id: ADR-0028
titre: La date de modification de la session sert de version à son équipe, son casting et son déroulé
statut: accepté
date: 2026-10-29
liens: [../specs/SPEC-004-sessions.md, ../epics/EPIC-004-ecarts-sessions/US-018-modifications-simultanees-d-une-session.md]
---

# ADR-0028 : La date de modification de la session sert de version à son équipe, son casting et son déroulé

## Contexte

Deux organisatrices peuvent modifier en même temps l'équipe, le casting ou les responsables du déroulé d'une session. Chaque enregistrement remplace tout : le dernier écrase le premier sans prévenir ([SPEC-004](../specs/SPEC-004-sessions.md), écart 3). Le contrôle existant (`assertUnmodifiedSince`, en-tête `If-Unmodified-Since`) n'est appliqué que si la requête porte la date de la version lue, ce que la page d'une session ne fait pas. Les responsables du déroulé (`TimelineEventResponsible`) n'ont pas de date de modification.

## Décision

- La version d'une session est `Session.updatedAt`. Elle couvre ses champs, son équipe, son casting et les responsables de son déroulé.
- La page d'une session envoie toujours la version lue : `PUT /api/sessions/:id` et `PUT /api/sessions/:id/timeline` refusent l'enregistrement (409) si la session a changé depuis.
- Enregistrer le déroulé met à jour `Session.updatedAt`, dans la même transaction que le remplacement des responsables. Les deux routes renvoient la nouvelle version, que la page garde pour l'enregistrement suivant.
- Le message de refus ne parle plus du mode hors ligne : il demande de recharger la page. Les modifications restent à l'écran.

## Conséquences

- Enregistrer le casting puis le déroulé depuis la même page fonctionne : la page reprend la version renvoyée par chaque enregistrement.
- Une modification des paiements, des envois ou des trombinoscopes ne change pas la version : elle n'entre pas en conflit avec le casting.
- Le contrôle reste facultatif pour les autres clients (requête sans version) ; le rendre obligatoire relève de la fiche [Resynchronisation hors ligne](../todo/resynchronisation-hors-ligne.md).

## Options écartées

- **Une version par partie (équipe, casting, déroulé)** : plus fin, mais il faudrait une colonne ou une table par partie, pour un cas rare avec une seule équipe d'organisation.
- **Verrou d'édition** (« Alice modifie cette session ») : demande un état partagé et une expiration, sans empêcher le cas hors ligne.
