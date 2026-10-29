---
id: US-018
titre: Modifications simultanées d’une session
statut: terminée
epic: EPIC-004
regles: [R11, R13]
adr: [ADR-0028]
---

# US-018 : Modifications simultanées d’une session

En tant qu'organisatrice, je veux être prévenue quand une autre a modifié la session pendant que je la modifiais, afin de ne pas écraser son travail sans le savoir.

## Critères d'acceptation

- [x] La page d'une session envoie la version lue quand elle enregistre l'équipe, le casting ou les responsables du déroulé.
- [x] Si la session a été modifiée entre-temps, l'enregistrement est refusé (409) avec le message « Cette session a été modifiée par quelqu'un d'autre : rechargez la page pour voir ses changements. » Les modifications restent à l'écran.
- [x] Enregistrer le déroulé change la version de la session ; enregistrer ensuite le casting depuis la même page fonctionne.
- [x] Le message de refus ne parle plus du mode hors ligne, pour toutes les ressources.

## Notes techniques

- Version = `Session.updatedAt` ([ADR-0028](../../adr/ADR-0028-version-d-une-session.md)). `PUT /api/sessions/:id/timeline` appelle `assertUnmodifiedSince` et met à jour `updatedAt` dans sa transaction ; il renvoie la nouvelle version.
- `pages/sessions/[id].vue` : `saveCast` et `saveTimeline` envoient `updatedAt` et gardent celui de la réponse.
- `server/utils/concurrency.ts` : message générique.

## Tests

- Intégration (`sessionLifecycle.test.ts`) : deux enregistrements avec la même version, le second refusé (409, sans parler du mode hors ligne), déroulé compris ; déroulé puis casting avec la version renvoyée, acceptés.
