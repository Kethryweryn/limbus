---
id: US-012
titre: Suivre et annuler les legs en attente
statut: à faire
epic: EPIC-002
regles: [R8]
adr: [ADR-0020, ADR-0025]
---

# US-012 : Suivre et annuler les legs en attente

En tant que propriétaire d'un jeu, je veux voir les legs que j'ai faits à des personnes qui n'ont pas encore de compte, afin de renvoyer ou d'annuler une invitation restée sans suite.

## Critères d'acceptation

- [ ] Sur la fiche de mon jeu, une liste « Legs en attente » montre, pour chaque legs sans compte :
  - l'email de la destinataire ;
  - la date du legs ;
  - la date d'expiration.
- [ ] Je peux annuler un legs en attente : l'invitation ne fonctionne plus, et la copie est supprimée avec ses fichiers (R8).
- [ ] Je peux renvoyer l'invitation d'un legs en attente. Le renvoi prolonge l'expiration de 14 jours et garde la copie telle qu'elle a été faite.
- [ ] Un legs expiré disparaît de la liste, et sa copie est supprimée quand la liste est lue ou qu'un nouveau legs est créé ([ADR-0020](../../adr/ADR-0020-echeances-evaluees-a-la-lecture.md)).
- [ ] Les legs déjà attribués n'apparaissent pas dans la liste : la copie appartient à la destinataire et je n'y ai plus accès.

## Notes techniques

- Routes :
  - `GET /api/games/:id/bequests` : legs en attente du jeu, avec nettoyage des expirés ;
  - `POST /api/games/:id/bequests/:invitationId/resend` ;
  - `DELETE /api/games/:id/bequests/:invitationId`.

  Toutes avec `requireGameOwner`. Les legs sont retrouvés par `Game.copiedFromGameId`.
- La suppression d'une copie en attente relève ses fichiers avec `collectUploadUrls`, puis appelle `deleteUnusedUploads`.

## Tests

- Intégration :
  - liste des legs en attente ;
  - annulation (copie et fichiers supprimés, invitation refusée ensuite) ;
  - renvoi (nouvelle expiration, même copie) ;
  - nettoyage d'un legs expiré à la lecture ;
  - un co-organisateur n'a accès à rien de cela ;
  - routes ajoutées à `isolation.test.ts`.
