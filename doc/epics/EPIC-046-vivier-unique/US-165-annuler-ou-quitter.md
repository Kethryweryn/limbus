---
id: US-165
titre: Annuler ma présence à une session, ou quitter le vivier
statut: à faire
epic: EPIC-046
regles: [R5, R19]
adr: [../../adr/ADR-0069-vivier-unique-et-statut-par-session.md, ../../adr/ADR-0070-liens-personnels-durables.md]
---

# US-165 : Annuler ma présence à une session, ou quitter le vivier

En tant que personne du vivier, je veux annuler une session sans perdre ma place dans le vivier, ou quitter le vivier, afin de garder la main sur ma participation.

## Critères d'acceptation

- [ ] Étant donné que je suis inscrite à une session, quand j'annule ma présence, alors je reste dans le vivier, le participant de session est retiré, le personnage libéré, et l'équipe prévenue.
- [ ] Étant donné que je quitte le vivier, alors toutes mes présences à venir sont annulées et mes liens ne marchent plus.
- [ ] Étant donné que j'ai quitté le vivier, quand je remplis de nouveau le questionnaire et confirme mon email, alors j'y reviens.
- [ ] Étant donné un paiement reçu, quand j'annule, alors il reste à traiter à la main par l'équipe.

## Notes techniques

Réutilise le désistement existant (SPEC-001, R22) à l'échelle de `RegistrationSession`. Boutons sur le lien personnel et dans « Je participe ».

## Tests

Intégration : annulation, sortie, retour, paiement. Playwright : `registration.spec.ts`, espace participant.
