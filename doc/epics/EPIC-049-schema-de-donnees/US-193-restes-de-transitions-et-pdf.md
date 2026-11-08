---
id: US-193
titre: Retirer les colonnes inutiles et garder le PDF du trombinoscope en binaire
statut: à faire
epic: EPIC-049
regles: []
adr: []
---

# US-193 : Retirer les colonnes inutiles et garder le PDF du trombinoscope en binaire

En tant que mainteneuse de Limbus, je veux retirer les colonnes qui ne servent plus et garder le PDF du trombinoscope en binaire, afin d'alléger la base et de n'avoir qu'une façon de stocker un PDF.

## Critères d'acceptation

- [ ] `Participant.notes` et `GameInvitation.token` sont retirées.
- [ ] `Document.audience` et `Document.characterId` sont retirées, une fois le build qui les écrit remplacé.
- [ ] Le PDF du trombinoscope est écrit dans une colonne `Bytes`, remplie depuis l'existant ; l'ancienne colonne base64 est retirée au déploiement suivant.
- [ ] Les PDF générés restent en base ([ADR-0044](../../adr/ADR-0044-copies-des-envois.md)).

## Notes techniques

Suppressions : migrations marquées incompatibles, en deux déploiements pour le PDF (nouvelle colonne écrite à côté de l'ancienne, puis retrait), comme pour ADR-0072.

## Tests

Intégration : trombinoscopes (génération, envoi, lecture dans « Je participe ») ; Playwright des trombinoscopes.
