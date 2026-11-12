---
id: US-247
titre: Une ligne au bas des emails des équipes
statut: à faire
epic: EPIC-057
regles: [R10]
adr: [ADR-0088]
---

# US-247 : Une ligne au bas des emails des équipes

En tant que participant, je veux que les emails des équipes me disent où retrouver tout cela dans Limbus, afin d'activer mon compte ou d'ouvrir « Je participe » sans le chercher.

## Critères d'acceptation

- [ ] Étant donné une personne au compte non activé, quand une équipe lui écrit, alors l'email se termine par une ligne qui l'invite à retrouver tout cela dans son compte Limbus, avec un lien vers « Activer mon compte ». Les emails concernés :
  - invitation et lien personnel ;
  - décisions et rappels d'inscription, réponses enregistrées ;
  - documents et fiche personnage, trombinoscope ;
  - paiement ;
  - annulation et report d'une session.
- [ ] Étant donné une personne au compte activé, alors la ligne l'invite à retrouver tout cela dans son espace « Je participe », avec un lien vers cet espace.
- [ ] Le lien ne contient ni adresse ni jeton.
- [ ] Les emails de test, envoyés à l'équipe, et la demande de confirmation d'un formulaire public n'ont pas de ligne.

## Notes techniques

- La ligne est rendue par `participantAccountFooter`, dans `server/utils/email.ts` ou `participantAccounts.ts`.
- Elle est appelée par `registrations.ts`, `publicRegistrations.ts`, `documents.ts`, `sessionPayments.ts`, `sessionLifecycle.ts` et `attendance.ts`.
- Un envoi groupé lit l'état des comptes en une seule requête.

## Tests

- Actions (`tests/e2e/registrationActions.spec.ts`, `tests/e2e/sessionPayments.spec.ts`) : un email d'invitation et un email de paiement, lus dans la boîte de test, portent la ligne de chaque cas, et son lien ouvre la bonne page.
- Erreurs de saisie : sans objet, rien n'est saisi.
- Droits : la ligne ne dit rien d'une autre équipe, et le lien ne porte pas l'adresse.
- Hors ligne : sans objet. Un envoi d'emails est une action, jamais mise en file.

Unitaires : texte de la ligne pour chaque état du compte.
