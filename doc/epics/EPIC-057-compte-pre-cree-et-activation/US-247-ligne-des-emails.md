---
id: US-247
titre: Une ligne au bas des emails des équipes
statut: terminée
epic: EPIC-057
regles: [R10]
adr: [ADR-0088]
---

# US-247 : Une ligne au bas des emails des équipes

En tant que participant, je veux que les emails des équipes me disent où retrouver tout cela dans Limbus, afin d'activer mon compte ou d'ouvrir « Je participe » sans le chercher.

## Critères d'acceptation

- [x] Étant donné une personne au compte non activé, quand une équipe lui écrit, alors l'email se termine par une ligne qui l'invite à retrouver tout cela dans son compte Limbus, avec un lien vers « Activer mon compte ». Les emails concernés :
  - invitation et lien personnel ;
  - décisions et rappels d'inscription, réponses enregistrées ;
  - documents et fiche personnage, trombinoscope ;
  - paiement ;
  - annulation et report d'une session.
- [x] Étant donné une personne au compte activé, alors la ligne l'invite à retrouver tout cela dans son espace « Je participe », avec un lien vers cet espace.
- [x] Le lien ne contient ni adresse ni jeton.
- [x] Les emails de test, envoyés à l'équipe, et la demande de confirmation d'un formulaire public n'ont pas de ligne.

## Notes techniques

- La ligne est rendue par `participantAccountFooter` (`server/utils/email.ts`) et ajoutée par le transport d'emails à tout message marqué `accountFooter`, en texte et en HTML : un seul endroit pour tous les envois.
- Les envois marqués : invitation, nouveau lien, rappel et annonce de sélection (`registrations.ts`, `registrationSelection.ts`), demande de disponibilité (`availabilityRequests.ts`), réponses enregistrées (`publicRegistrations.ts`), documents, fiches et trombinoscopes (`documents.ts`, `sendToEach`), paiement (`sessionPayments.ts`), annulation (`sessionLifecycle.ts`), report et présence (`attendance.ts`).
- L'état du compte se lit par adresse, au moment de chaque envoi, sur l'index unique de l'adresse : une requête par email, sans la charger d'avance pour un envoi groupé.

## Tests

- Actions (`tests/e2e/sessionPayments.spec.ts`) : l'email de paiement d'une personne sans compte activé porte la ligne, et son lien ouvre « Activer mon compte ».
- Erreurs de saisie : sans objet, rien n'est saisi.
- Droits : la ligne ne porte ni l'adresse ni un jeton, et ne dit rien d'une autre équipe (`tests/server/accountFooter.test.ts`).
- Hors ligne : sans objet. Un envoi d'emails est une action, jamais mise en file.

Intégration (`registrations.test.ts`) : invitation d'une personne sans compte et d'une nouvelle personne (compte pré-créé), puis d'une personne au compte activé. Unitaires (`accountFooter.test.ts`) : texte de la ligne pour chaque état du compte.
