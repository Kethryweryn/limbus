---
id: US-210
titre: Lire en français les refus du serveur
statut: terminée
epic: EPIC-050
regles: []
adr: []
---

# US-210 : Lire en français les refus du serveur

En tant que personne qui utilise Limbus, je veux que les refus affichés par un formulaire soient en français et compréhensibles, afin de savoir quoi corriger (défaut trouvé en écrivant les tests de l'US-199 : « Too many recipients » s'affichait dans la fenêtre d'un email de test).

## Critères d'acceptation

- [x] Étant donné un formulaire refusé par le serveur, alors le détail affiché est en français : « Le nom est obligatoire », « Email invalide », « Dix adresses au plus »…, et non « Name is required », « Invalid email » ou « Too many recipients ».
- [x] Les messages par défaut de la validation (type de valeur, valeur hors liste…) sont eux aussi en français.
- [x] Un lien refusé dit ce qu'il attend : « Le lien doit commencer par https:// (ou http://) ».
- [x] Les refus du téléversement d'une photo sont en français.

## Notes techniques

`server/utils/schemas.ts` : `z.config(z.locales.fr())` pour les messages par défaut de zod ; `requiredText` et `requiredId` prennent un libellé français (« Le nom ») et reprennent la forme de `frenchText`, qu'ils remplacent ; les messages restés en anglais sont traduits. `server/api/uploads/session-assignment-photos*.ts`, `server/utils/auth.ts`. « Invalid request body » devient « Requête invalide » (`utils/apiErrors.ts` le remplace déjà par le détail de la validation).

## Tests

`tests/e2e/sessionDocuments.spec.ts` : plus de 10 adresses de test refusées avec « Dix adresses au plus ». `tests/utils/apiErrors.test.ts`.
