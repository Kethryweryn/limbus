---
id: US-169
titre: Revenir sur mes réponses avec un lien qui reste valable
statut: à faire
epic: EPIC-047
regles: [R13, R15]
adr: [../../adr/ADR-0070-liens-personnels-durables.md]
---

# US-169 : Revenir sur mes réponses avec un lien qui reste valable

En tant que personne du vivier, je veux que mes anciens emails marchent toujours et voir le questionnaire à jour, afin de corriger mes réponses quand les choses évoluent.

## Critères d'acceptation

- [ ] Étant donné un email plus ancien, quand un nouvel email est parti, alors son lien marche encore.
- [ ] Étant donné que l'équipe m'envoie un nouveau lien à ma demande, alors les anciens cessent de marcher.
- [ ] Étant donné un questionnaire modifié depuis ma réponse, quand je reviens, alors mes réponses sont reprises et les nouvelles questions s'ajoutent.
- [ ] Étant donné une nouvelle question obligatoire, quand j'enregistre, alors elle est exigée ; tant que je ne reviens pas, mes réponses gardent leur version.

## Notes techniques

Table `RegistrationLink` (ADR-0070). `frozenFormVersionId` et `formForRegistration` dans `server/utils/publicRegistrations.ts`. Purge dans `server/utils/retention.ts`.

## Tests

Intégration : plusieurs liens, renouvellement, expiration, version du questionnaire. Playwright : retour sur ses réponses.
