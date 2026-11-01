---
id: ADR-0054
titre: Photos des participants, information sans accord préalable, purge à l'échéance et refus bloquant
statut: accepté
date: 2026-11-01
liens: [../specs/SPEC-012-photos-des-participants.md, ADR-0044-copies-des-envois.md, ADR-0042-coordonnees-du-compte.md]
---

# ADR-0054 : Photos des participants, information sans accord préalable, purge à l'échéance et refus bloquant

## Contexte

[SPEC-012](../specs/SPEC-012-photos-des-participants.md). Les photos des personnes sont gardées sans échéance (R-08) et sans information (R-09). L'utilisatrice choisit :

- une information, plutôt qu'un accord préalable ;
- une durée réglable par jeu ;
- un retrait depuis le compte, qui bloque les photos suivantes.

## Décision

- **Texte d'information** : une fonction partagée, `photoInformation({ retentionMonths, contactEmail })` dans `utils/photoInformation.ts`. Elle sert dans les emails comme dans les pages, pour que le texte reste le même partout. Le contact est `Game.contactEmail`, à défaut l'email du compte propriétaire du jeu.
- **Purge** : `purgeExpiredPhotos(now)` (`server/utils/photoRetention.ts`), sans tâche planifiée. Comme `purgeExpiredCopies` (ADR-0044), elle est appelée à chaque connexion et avant chaque envoi. Pour chaque session datée dont l'échéance (`date` + `photoRetentionMonths` mois) est passée, et qui garde des photos ou des trombinoscopes :
  - les `SessionAssignment.photoUrl` passent à null ;
  - les `SessionTrombinoscope` sont supprimés ;
  - les fichiers qui ne servent plus sont effacés par `deleteUnusedUploads`.
- **Refus** : `Participant.photoRefusedAt`.
  - `POST /api/me/photo-refusal` (`{ refused }`) agit sur toutes les fiches du compte (ADR-0041). Un refus efface les photos, puis refait les trombinoscopes déjà générés des sessions touchées, sans faire échouer la réponse.
  - `POST /api/participants/:id/photo-refusal` sert à l'équipe, sur une fiche d'un de ses jeux. Elle ne peut pas lever le refus d'une fiche rattachée à un compte.
  - Le PUT de la session refuse une photo pour une fiche à « photo refusée ». `buildTrombinoscopeRows` ignore la photo du cast d'une telle fiche.

## Conséquences

- Une photo déjà téléchargée par un joueur sort de la portée de Limbus : l'information dit à quoi elle sert.
- Une session sans date garde ses photos : l'équipe la date, ou les retire à la main.

## Options écartées

- **Accord préalable** : écarté par l'utilisatrice ; à reconsidérer après l'avis d'un juriste.
- **Tâche planifiée** : Limbus n'en a pas, et la purge à la connexion suffit pour une échéance en mois.
- **Retrait sans blocage** : l'équipe pourrait remettre la photo par inadvertance, ce qui viderait le retrait de son sens.
