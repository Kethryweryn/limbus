---
id: EPIC-035
titre: Brancher une IA, lot 3 : sessions, casting et participants
statut: terminé
spec: ../../../specs/SPEC-014-api-pour-ia.md
date: 2026-11-03
---

# EPIC-035 : Brancher une IA, lot 3 : sessions, casting et participants

## Objectif

Lot 3 de [SPEC-014](../../../specs/SPEC-014-api-pour-ia.md) (R10 à R13). Avec une autorisation en lecture et écriture, l'assistant crée et prépare les sessions des jeux de son autorisation : détails, équipe, casting et déroulé. Il lance l'assistant de casting, et crée ou modifie les fiches participant.

## Décisions

2026-11-03, choix de l'utilisatrice :

- l'assistant ajoute des personnes à l'équipe, change leur rôle et en retire, comme l'interface. Une personne retirée perd son personnage dans la session ; son suivi de paiement ne change pas ;
- il ne change jamais le statut d'une session : une session qu'il crée est prévue, et il ne l'annule, ne la reporte, ne la termine ni ne la supprime ;
- au casting, il attribue les personnages, écrit la note de chaque ligne et pose ou retire le cadenas. Il ne touche pas aux réservations d'un personnage pour une personne retenue, qui viennent avec les inscriptions (lot 4) ;
- il crée une fiche participant dans un jeu, change son nom et sa note d'organisation, et peut ajouter à un autre jeu de l'autorisation une personne déjà présente dans un jeu de l'autorisation. Il ne la retire jamais d'un jeu.

Rappels de SPEC-014 : il ne rend rien public (visibilité de la session sur la page publique), ne pose aucune photo et n'envoie aucun email. Il ne lit ni n'écrit les coordonnées d'une fiche.

Choix techniques :

- Les écritures de l'interface passent dans des fonctions serveur (`server/utils/sessionWrites.ts`, `server/utils/participantWrites.ts`) que les routes et les outils appellent toutes deux (R12). Les routes ne changent pas de comportement.
- Comme au lot 2, un outil de modification ne reçoit que ce qui change et le complète avec la fiche actuelle : une ligne de cast, un événement du déroulé ou un champ omis reste tel quel. La photo d'une ligne de cast est retirée quand la personne change, comme quand l'interface applique une proposition de l'assistant de casting.
- La version lue (`updatedAt`) est obligatoire pour modifier. Le déroulé et le casting font partie de la version de la session ([ADR-0028](../../../adr/ADR-0028-version-d-une-session.md)).

## US

| US | Titre | Statut |
|---|---|---|
| [US-127](US-127-sessions-et-equipe.md) | L'assistant crée une session et compose son équipe | terminée |
| [US-128](US-128-casting-et-deroule.md) | L'assistant prépare le casting et le déroulé d'une session | terminée |
| [US-129](US-129-fiches-participant.md) | L'assistant crée et modifie les fiches participant | terminée |

## Suivi

- 2026-11-03 : déployé (PR #118). La revue a corrigé un défaut de l'interface : une orga retirée de l'équipe restait responsable d'événements du déroulé ; une migration a nettoyé ces lignes.
- Epic archivé.
