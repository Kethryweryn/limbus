---
id: US-116
titre: Sessions : cast, déroulé, documents, paiements, présence
statut: terminée
epic: EPIC-031
regles: []
adr: [ADR-0057]
---

# US-116 : Sessions : cast, déroulé, documents, paiements, présence

En tant que développeuse, je veux que les écrans des sessions soient vérifiés.

## Critères d'acceptation

- [x] Pages et composants des sessions en TypeScript strict, couverts par la règle de lint : liste et page d'une session, formulaire, cast, déroulé, documents, paiements, présence, report, annulation, fiche allergies, test d'email, page publique de confirmation de présence.
- [x] Gros écrans découpés en sous-composants :
  - `SessionDocumentsManager` : `SessionDocumentList`, `SessionCharacterSheets`, état et actions partagés (`useSessionDocumentActions`) ;
  - `SessionPaymentsManager` : `SessionPaymentSettings`, `SessionPaymentTariffs`, `SessionPaymentSummary`, `SessionPaymentRow`, `SessionPaymentDepartures`, état et écritures partagés (`useSessionPaymentActions`) ;
  - `pages/sessions/index.vue` : `SessionCard`.
- [x] Code recopié mis en commun : fonctions des sessions (`utils/sessions.ts`), délai des boutons d'envoi (`coolDown`), écriture d'une ligne de paiement (une au lieu de huit).
- [x] Changements visibles, voulus :
  - après un enregistrement, la page d'une session garde ses liens de report et l'onglet Présence (la réponse du serveur ne les rendait pas) ;
  - les envois groupés de fiches et trombinoscopes partent un par un : un envoi en cours désactive les deux autres ;
  - les états de présence se décomptent dans un ordre fixe.
- [x] Code mort retiré : la distribution du cast dans `SessionForm`, remplacée par `SessionCastForm`.

## Tests

- `npm run typecheck`, `npm run lint`, `npm test`.
- Parcours Playwright de la CI : casting, trombinoscopes, envoi des documents, paiements, hors ligne.
