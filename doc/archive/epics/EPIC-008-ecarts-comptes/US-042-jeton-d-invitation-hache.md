---
id: US-042
titre: Le jeton d'une invitation est gardé haché
statut: terminée
epic: EPIC-008
regles: []
adr: [ADR-0034]
---

# US-042 : Le jeton d'une invitation est gardé haché

En tant qu'administratrice, je veux qu'une copie de la base ne permette pas d'accepter les invitations en attente, comme pour les liens personnels des inscriptions.

## Critères d'acceptation

- [x] Une invitation à co-organiser ou un legs ne garde que l'empreinte SHA-256 de son jeton ; le jeton n'existe que dans le lien envoyé.
- [x] Ouvrir, accepter une invitation, ou créer un compte avec elle, retrouve l'invitation par l'empreinte du jeton du lien.
- [x] Renvoyer un legs envoie un nouveau lien : l'ancien ne marche plus dès que le nouvel email est parti.
- [x] Les invitations en attente au déploiement gardent leur lien : la migration remplace leur jeton par son empreinte.

## Notes techniques

- Colonne `GameInvitation.tokenHash` unique ; `token` devient facultative et n'est plus écrite ([ADR-0034](../../../adr/ADR-0034-jeton-d-invitation-hache.md)).
- `createInvitationToken` rend le jeton et son empreinte ; `getValidInvitation` cherche par l'empreinte.

## Tests

- Unitaires (`tests/server/invitations.test.ts`) : jeton et empreinte.
- Intégration (`gameBequests.test.ts`) : aucune invitation créée ne garde son jeton en clair ; le lien reçu par email ouvre l'invitation ; un legs renvoyé invalide l'ancien lien.
