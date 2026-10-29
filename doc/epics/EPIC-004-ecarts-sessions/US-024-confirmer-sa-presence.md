---
id: US-024
titre: Confirmer sa présence à une session reportée
statut: à faire
epic: EPIC-004
regles: [R2]
adr: [ADR-0018, ADR-0020, ADR-0029]
---

# US-024 : Confirmer sa présence à une session reportée

En tant qu'organisatrice, je veux que chaque personne de l'équipe d'une session reportée confirme qu'elle viendra, afin de savoir sur qui compter à la nouvelle date.

## Critères d'acceptation

- [ ] Après un report, l'organisation choisit une date limite (7 jours par défaut) et envoie à chaque personne de l'équipe de la nouvelle session (participants, organisateurs, PNJ, cuisine) un email avec un lien personnel. L'email est proposé en aperçu avant l'envoi.
- [ ] Le lien ouvre une page sans connexion : la session, sa date, son lieu, et deux boutons « Je viens » et « Je ne viens pas ». La personne peut changer d'avis jusqu'à la date limite.
- [ ] La page de la session montre le suivi : en attente, confirmé, ne viendra pas, délai dépassé, place libérée. L'organisation relance une personne, prolonge son délai ou renvoie un lien (l'ancien cesse de marcher).
- [ ] Pour une personne qui ne viendra pas ou dont le délai est dépassé, « Libérer la place » la retire de l'équipe et du casting de la session ; son paiement éventuel apparaît dans les paiements à traiter.
- [ ] Rien ne change tout seul à la date limite : le délai dépassé est seulement signalé.
- [ ] Ces données sont incluses dans l'export de la personne et supprimées avec elle.

## Notes techniques

- Table `SessionAttendance` ([ADR-0029](../../adr/ADR-0029-cycle-de-vie-d-une-session.md)) ; jeton comme [ADR-0018](../../adr/ADR-0018-jetons-des-liens-personnels.md).
- Routes organisatrice sous `/api/sessions/:id/attendance` (envoi, relance, prolongation, libération) ; routes publiques `/api/public/attendance/:token` (lecture, réponse), limitées par IP ; page `/presence/[token]` sans référent ni cache.
- `exportParticipantData`, `isolation.test.ts`, verrou d'envoi de la session.

## Tests

- Unitaires : statut affiché (délai dépassé à la lecture).
- Intégration : envoi, réponse par le lien, jeton inconnu, changement d'avis, délai dépassé, prolongation, relance, libération, isolation, export.
