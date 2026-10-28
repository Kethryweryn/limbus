---
id: US-012
titre: Suivre et annuler les legs en attente
statut: terminée
epic: EPIC-002
regles: [R8]
adr: [ADR-0020, ADR-0025]
---

# US-012 : Suivre et annuler les legs en attente

En tant que propriétaire d'un jeu, je veux voir les legs que j'ai faits à des personnes qui n'ont pas encore de compte, afin de renvoyer ou d'annuler une invitation restée sans suite.

## Critères d'acceptation

- [x] Sur la fiche de mon jeu (fenêtre « Léguer une copie »), une liste « Legs en attente » montre, pour chaque legs sans compte :
  - l'email de la destinataire ;
  - la date du legs ;
  - la date d'expiration.
- [x] Je peux annuler un legs en attente : l'invitation ne fonctionne plus, et la copie est supprimée avec ses fichiers (R8).
- [x] Je peux renvoyer l'invitation d'un legs en attente. Le renvoi prolonge l'expiration de 14 jours et garde la copie telle qu'elle a été faite.
- [x] Un legs expiré disparaît de la liste, et sa copie est supprimée quand la liste est lue ou qu'un nouveau legs est créé ([ADR-0020](../../../adr/ADR-0020-echeances-evaluees-a-la-lecture.md)).
- [x] Les legs déjà attribués n'apparaissent pas dans la liste : la copie appartient à la destinataire et je n'y ai plus accès.

## Réalisation

- La liste « Legs en attente » est dans la fenêtre « Léguer une copie » de la fiche du jeu, sous le formulaire : c'est là que la propriétaire lègue, et la liste se met à jour après un legs, un renvoi ou une annulation.
- Comme le legs lui-même, ces routes sont réservées à la propriétaire, y compris en mode administrateur (R1) : `requireBequestOwner` (`server/utils/bequests.ts`) vérifie que le jeu appartient à la personne connectée.
- Le renvoi garde le même lien : l'ancien email reste valable, avec la nouvelle date. Si l'email ne part pas, l'expiration ne change pas (502).
- Le nettoyage (`purgeExpiredBequests`) supprime aussi une copie en attente qui n'a plus aucune invitation en cours, quelle qu'en soit la raison.
  Une copie qui n’a encore aucune invitation n’est supprimée qu’après une heure : son legs est peut-être en train de se faire.
- Une annulation sur une copie attribuée entre-temps répond 409 et ne touche à rien : la suppression reste conditionnelle à `bequestPending`.
- Hors ligne, l’annulation n’est pas mise en file : un DELETE sur une sous-route (legs, partages, invitations) est une action, comme un POST.

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
  - routes ajoutées à `isolation.test.ts` ;
  - un renvoi qui ne part pas laisse l'expiration inchangée ;
  - un legs n'est pas atteint depuis un autre jeu de la même propriétaire.
