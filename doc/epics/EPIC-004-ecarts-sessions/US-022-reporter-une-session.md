---
id: US-022
titre: Reporter une session
statut: à faire
epic: EPIC-004
regles: [R2]
adr: [ADR-0029]
---

# US-022 : Reporter une session

En tant qu'organisatrice, je veux reporter une session sur une nouvelle date en gardant son équipe et son casting, afin de ne pas tout refaire.

## Critères d'acceptation

- [ ] Depuis une session prévue ou annulée, « Reporter » crée une nouvelle session : nom, date et lieu, pré-remplis depuis l'ancienne. On ne reporte pas vers une session existante (choix du 29 octobre 2026).
- [ ] L'équipe (avec ses rôles) et le casting (personnages, participants, notes et photos) sont recopiés sur la nouvelle session.
- [ ] L'ancienne session passe « Reportée » et indique vers quelle session ; la nouvelle indique d'où elle vient.
- [ ] Les photos recopiées restent disponibles même si l'une des deux sessions est supprimée.
- [ ] Le report propose ensuite d'envoyer les demandes de confirmation de présence (US-024).

## Notes techniques

- Route `POST /api/sessions/:id/postpone` (action, jamais mise en file hors ligne), dans une transaction ; contrôle d'accès au jeu de la session.
- `Session.postponedToSessionId` (self-relation, `SetNull`). Photos : `UploadedFile.sessionId` passe à `null` ([ADR-0029](../../adr/ADR-0029-cycle-de-vie-d-une-session.md)).
- Route ajoutée à `isolation.test.ts`.

## Tests

- Intégration : report vers une nouvelle session (équipe, casting, photos recopiés, ancienne session « Reportée » et liée) ; photo gardée après suppression de l'ancienne session ; refus d'une session déjà reportée ; isolation.
