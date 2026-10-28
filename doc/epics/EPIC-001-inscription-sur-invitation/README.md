---
id: EPIC-001
titre: Période d'inscription et mode invitation
statut: en cours
spec: ../../specs/SPEC-001-inscriptions.md
date: 2026-10-27
adr: [ADR-0018, ADR-0019, ADR-0020, ADR-0021]
---

# EPIC-001 : Période d'inscription et mode invitation

## Objectif

Organiser une session sur invitation de bout en bout :

1. L'organisateur ouvre une période d'inscription pour une ou plusieurs sessions et invite des participants.
2. Chaque personne reçoit un lien personnel. Elle y lit la note d'intention, remplit ses informations d'organisation (contact, contact d'urgence, allergies) et accepte ou décline.
3. Les personnes qui acceptent rejoignent la session et le circuit de paiement. La cuisine reçoit la fiche allergies.

Le formulaire public, le tirage au sort et le casting viennent dans les epics suivants ; le modèle de données les prévoit dès maintenant (plusieurs sessions, modes de sélection, versions du formulaire).

Règles couvertes : R1 à R3, R5, R6, R8 (note d'intention et champs standards), R12 à R16, R20, R22, R33 de [SPEC-001](../../specs/SPEC-001-inscriptions.md).

## US

| US | Titre | Statut |
|---|---|---|
| [US-001](US-001-creer-une-periode-d-inscription.md) | Créer et paramétrer une période d'inscription | terminée |
| [US-002](US-002-champs-standards-du-formulaire.md) | Note d'intention et champs standards du formulaire | terminée |
| [US-003](US-003-inviter-des-participants.md) | Inviter des participants | terminée |
| [US-004](US-004-repondre-a-une-invitation.md) | Répondre à une invitation par son lien personnel | terminée |
| [US-005](US-005-suivre-les-inscriptions.md) | Suivre et gérer les inscriptions | à faire |
| [US-006](US-006-desistement.md) | Désistement d'une personne confirmée | à faire |
| [US-007](US-007-inscrits-dans-les-paiements.md) | Inscrits confirmés dans le tableau des paiements | à faire |
| [US-008](US-008-fiche-allergies.md) | Fiche allergies de la session | à faire |
| [US-009](US-009-page-inscriptions.md) | Page Inscriptions dans le menu Organisation | terminée |

Ordre conseillé : US-001 → US-009 → US-002 → US-003 → US-004, puis US-005 à US-008 dans n'importe quel ordre. Chaque US fait l'objet d'une PR ([ADR-0017](../../adr/ADR-0017-branches-et-pull-requests.md)).

## Définition de terminé

- Toutes les US terminées ; `npm run lint`, `npm run typecheck`, `npm test` et la CI passent.
- Toutes les nouvelles routes d'organisation figurent dans `tests/integration/isolation.test.ts`, et les routes publiques ont leurs tests d'abus (jeton invalide, débit).
- `eraseParticipant` et `exportParticipantData` couvrent les inscriptions (`tests/integration/privacy.test.ts`).
- Un test Playwright couvre le parcours complet : invitation → réponse par le lien → présence dans la session et les paiements.
- SPEC-001 est à jour, et les ADR de l'epic sont passés de `proposé` à `accepté`, ou remplacés.
