---
id: US-024
titre: Confirmer sa présence à une session reportée
statut: terminée
epic: EPIC-004
regles: [R2]
adr: [ADR-0018, ADR-0020, ADR-0029]
---

# US-024 : Confirmer sa présence à une session reportée

En tant qu'organisatrice, je veux que chaque personne de l'équipe d'une session reportée confirme qu'elle viendra, afin de savoir sur qui compter à la nouvelle date.

## Critères d'acceptation

- [x] Après un report, l'onglet « Présence » de la nouvelle session s'ouvre. L'organisation choisit une date limite (7 jours par défaut) et envoie à chaque personne de l'équipe (participants, organisateurs, PNJ, cuisine) un email avec un lien personnel, une seule fois par personne. L'email est proposé en aperçu avant l'envoi. Une personne sans email est listée, sans envoi ; un échec d'envoi n'arrête pas les autres.
- [x] Le lien ouvre une page sans connexion : la session, sa date, son lieu, et deux boutons « Je viens » et « Je ne viens pas ». La personne peut changer d'avis jusqu'à la date limite.
- [x] La page de la session montre le suivi : en attente, confirmé, ne viendra pas, délai dépassé, place libérée. L'organisation relance une personne, prolonge son délai ou renvoie un lien (l'ancien cesse de marcher).
- [x] Pour une personne qui ne viendra pas ou dont le délai est dépassé, « Libérer la place » la retire de l'équipe, du casting et du déroulé de la session ; son paiement éventuel apparaît dans les paiements à traiter. Les trombinoscopes déjà générés sont régénérés, comme après un désistement.
- [x] Une personne ajoutée à l'équipe après l'envoi, ou revenue après une place libérée, est comptée parmi les personnes à solliciter, et reçoit un nouveau lien au prochain envoi.
- [x] Rien ne change tout seul à la date limite : le délai dépassé est seulement signalé.
- [x] Ces données sont incluses dans l'export de la personne et supprimées avec elle.

## Notes techniques

- Table `SessionAttendance` ([ADR-0029](../../../adr/ADR-0029-cycle-de-vie-d-une-session.md)) ; jeton comme [ADR-0018](../../../adr/ADR-0018-jetons-des-liens-personnels.md).
- Routes organisatrice sous `/api/sessions/:id/attendance` (envoi, relance, prolongation, libération) ; routes publiques `/api/public/attendance/:token` (lecture, réponse), limitées par IP ; page `/presence/[token]` sans référent ni cache.
- `exportParticipantData`, `isolation.test.ts`, verrou d'envoi de la session.

## Tests

- Unitaires (`tests/utils/attendance.test.ts`) : statut affiché (délai dépassé à la lecture), réponse possible, libération possible, texte de l'email.
- Intégration (`sessionAttendance.test.ts`) : envoi à toute l'équipe (une fois par personne, sans email signalé), refus hors report, réponse et changement d'avis par le lien, jeton inconnu, délai dépassé, prolongation, rappel sans lien, nouveau lien (l'ancien invalidé), libération (équipe, casting, lien, trombinoscopes régénérés), personnes ajoutées ou revenues sollicitées au prochain envoi, export.
- Isolation (`isolation.test.ts`) : les six routes de l'organisation refusées sur une session de Bob, avec témoin.
