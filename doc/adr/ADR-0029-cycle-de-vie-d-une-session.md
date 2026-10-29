---
id: ADR-0029
titre: Cycle de vie d'une session : report lié, présence par lien personnel, remboursements suivis par paiement
statut: accepté
date: 2026-10-29
liens: [../specs/SPEC-004-sessions.md, ../todo/cycle-de-vie-d-une-session.md, ADR-0008, ADR-0018, ADR-0020, ADR-0024]
---

# ADR-0029 : Cycle de vie d'une session : report lié, présence par lien personnel, remboursements suivis par paiement

## Contexte

Une session peut être annulée, reportée ou « désannulée ». Il faut alors rembourser ou reporter les paiements, reprendre l'équipe et le casting sur la nouvelle date, et faire confirmer sa présence à chacun ([fiche](../todo/cycle-de-vie-d-une-session.md), décisions du 29 octobre 2026). Les participants n'ont pas de compte.

## Décision

- **Report** : reporter une session crée une nouvelle session du même jeu ; on ne reporte pas vers une session existante (choix de l'utilisatrice). L'ancienne passe au statut « Reportée » et pointe vers la nouvelle (`Session.postponedToSessionId`, `SetNull` si la nouvelle est supprimée). L'équipe et le casting sont recopiés, notes et photos comprises.
- **Photos recopiées** : une photo d'attribution sert alors à deux sessions. Son fichier (`UploadedFile`) est rattaché au jeu (`sessionId` à `null`) au lieu de la session d'origine, pour que supprimer l'une des deux sessions ne le supprime pas ([ADR-0008](ADR-0008-fichiers-televerses.md)). `deleteUnusedUploads` l'efface quand plus rien ne l'utilise.
- **Présence** : une table `SessionAttendance` (session, participant, statut, empreinte du jeton, date limite, dates d'envoi, de relance et de réponse), une ligne par personne de l'équipe de la nouvelle session. Statuts : en attente, confirmé, ne viendra pas, place libérée. Le lien personnel suit [ADR-0018](ADR-0018-jetons-des-liens-personnels.md) : 32 octets aléatoires, seul le SHA-256 est stocké, page `/presence/<jeton>` sans référent ni cache. Le délai dépassé est évalué à la lecture ([ADR-0020](ADR-0020-echeances-evaluees-a-la-lecture.md)) : rien ne change tout seul.
- **Remboursements** : trois colonnes de `SessionPayment` : `refundStatus` (à rembourser, remboursé, reporté), `refundedAt` et `carriedOverToSessionId`. Reporter un paiement crée ou complète le paiement de la personne sur la nouvelle session, avec la date de paiement d'origine.
- **Données personnelles** : `SessionAttendance` et les nouvelles colonnes de paiement entrent dans `exportParticipantData` et sont supprimées avec le participant (`eraseParticipant`, cascade).
- **Migrations** : uniquement des ajouts de colonnes facultatives et d'une table ([ADR-0024](ADR-0024-migrations-compatibles-avec-le-build-en-service.md)).

## Conséquences

- Les liens de confirmation ne peuvent pas être réaffichés : pour en redonner un, l'organisation renvoie la demande, ce qui crée un nouveau jeton.
- Une session reportée garde son équipe, son casting et ses paiements tels qu'ils étaient, pour l'historique et les remboursements.
- Une photo partagée entre sessions devient un fichier du jeu : elle n'est plus supprimée avec la session d'origine.

## Options écartées

- **Déplacer la session** (changer sa date) au lieu d'en créer une nouvelle : on perd la trace de la date annulée et des remboursements qui s'y rattachent.
- **Copier les fichiers photo** pour la nouvelle session : double l'espace disque et les données personnelles à effacer.
- **Confirmation saisie par l'organisation** : écartée par l'utilisatrice au profit du lien personnel.
- **Libérer la place automatiquement** à la date limite : écarté au profit de la décision de l'organisation, comme pour les inscriptions.
