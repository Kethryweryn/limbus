---
id: US-030
titre: Renvoyer la version à jour d'un document, d'une fiche ou d'un trombinoscope
statut: à faire
epic: EPIC-006
regles: [R12]
adr: [ADR-0031]
---

# US-030 : Renvoyer la version à jour d'un document, d'une fiche ou d'un trombinoscope

En tant qu'organisatrice, je veux renvoyer la version corrigée d'un document, d'une fiche ou d'un trombinoscope, à une personne ou à toutes celles dont la version est dépassée.

## Critères d'acceptation

- [ ] Chaque envoi garde l'empreinte de la version envoyée ([ADR-0031](../../adr/ADR-0031-version-d-un-envoi.md)) ; le tableau des documents signale « version dépassée » pour une personne qui a reçu une version plus ancienne.
- [ ] Un bouton « Renvoyer » sur chaque envoi déjà fait renvoie la version actuelle à cette personne.
- [ ] Un bouton « Renvoyer la version à jour » par document, pour les fiches et pour les trombinoscopes, renvoie aux seules personnes dont la version est dépassée.
- [ ] L'email renvoyé a un objet préfixé « Mise à jour : » et dit que cette version remplace la précédente.
- [ ] Un renvoi met à jour la date et l'empreinte de l'envoi. Un trombinoscope périmé n'est pas renvoyé : il faut d'abord le générer à nouveau.
- [ ] Les renvois suivent les mêmes règles que les envois : un seul à la fois par session, limite de fréquence, échecs listés.

## Notes techniques

- Colonne `SessionDocumentDelivery.contentHash String?` : ajout seul ([ADR-0024](../../adr/ADR-0024-migrations-compatibles-avec-le-build-en-service.md)).
- Route `POST /api/sessions/:id/documents/resend` (type, document, personne facultative), schéma zod, verrou d'envoi et limite de fréquence ; ajoutée à `isolation.test.ts`.

## Tests

- Unitaires : empreintes d'un document et d'une fiche.
- Intégration (`sessionDocuments.test.ts`) : version dépassée après modification, renvoi groupé aux seules personnes concernées, renvoi à une personne, objet « Mise à jour : ».
