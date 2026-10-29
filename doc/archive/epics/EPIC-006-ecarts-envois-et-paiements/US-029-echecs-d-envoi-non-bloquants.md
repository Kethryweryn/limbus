---
id: US-029
titre: Un échec d'envoi n'arrête pas les autres
statut: terminée
epic: EPIC-006
regles: [R13]
adr: []
---

# US-029 : Un échec d'envoi n'arrête pas les autres

En tant qu'organisatrice, je veux qu'un échec d'envoi à une personne n'empêche pas les autres de recevoir leurs documents, et savoir qui n'a rien reçu.

## Critères d'acceptation

- [x] Les envois de documents, de fiches, de trombinoscopes et de fiches avec trombinoscopes continuent après un échec à une personne.
- [x] La réponse liste les personnes qui n'ont rien reçu, et l'interface les affiche avec le nombre d'emails partis.
- [x] Si aucun email n'est parti à cause d'échecs, l'envoi est en erreur (502), comme pour les paiements.
- [x] Un serveur d'envoi désactivé ou mal configuré refuse l'envoi avant le premier email.

## Notes techniques

- Une seule connexion SMTP par envoi (`openEmailTransport`), comme `sendSessionPaymentEmails`, dans `server/utils/documents.ts`.
- Un PDF impossible à produire pour une personne compte comme un échec pour elle.

## Tests

- Intégration (`sessionDocuments.test.ts`) : une adresse refusée par le serveur SMTP de test, les autres reçoivent, la personne est listée.
