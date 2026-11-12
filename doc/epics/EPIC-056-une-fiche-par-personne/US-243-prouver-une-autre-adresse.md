---
id: US-243
titre: Prouver une autre adresse donnée en réponse, puis réunir les deux fiches
statut: terminée
epic: EPIC-056
regles: [R4, R8]
adr: [ADR-0086, ADR-0087]
---

# US-243 : Prouver une autre adresse donnée en réponse, puis réunir les deux fiches

En tant que participant, je veux que l'adresse que je donne en répondant à une invitation soit reconnue comme la mienne une fois prouvée, afin d'avoir une seule fiche, même si une autre fiche portait déjà cette adresse.

Choix de l'utilisatrice, le 2026-11-11 : un lien envoyé à l'autre adresse prouve qu'elle est à la personne, puis les deux fiches sont réunies ; en attendant, la réponse est enregistrée et la fiche comme l'inscription gardent l'adresse d'origine ; après la preuve, tout passe sur la fiche de l'adresse prouvée.

## Critères d'acceptation

- [x] Étant donné une réponse par le lien personnel qui donne une autre adresse, connue de Limbus ou non (revue de la PR #236 : rien ne révèle si une adresse a une fiche), alors la réponse est enregistrée, la fiche et l'inscription gardent leur adresse, un email part à l'autre adresse avec un lien de preuve, et la page dit à la personne de cliquer sur ce lien.
- [x] Étant donné le lien de preuve ouvert, alors tout ce que tient la fiche d'origine (jeux, notes, noms, inscriptions, sessions, paiements…) passe sur la fiche de l'adresse prouvée (`limbus_move_participant`), la fiche d'origine disparaît, et les inscriptions déplacées prennent l'adresse prouvée.
- [x] Le lien de preuve ne sert qu'une fois et expire ; un lien inconnu, déjà utilisé ou expiré répond pareil.
- [x] Le lien de preuve ne montre rien de l'autre fiche (ni nom, ni jeux) ; l'email ne dit pas quelles équipes la suivent.
- [x] Une réponse faite connectée au compte (« Je participe ») porte l'adresse du compte, déjà confirmée : elle est adoptée aussitôt, et la fiche rejoint celle de cette adresse s'il y en a une.
- [x] Une réponse corrigée dans l'heure ne renvoie pas le lien.

## Notes techniques

[ADR-0087](../../adr/ADR-0087-preuve-d-une-autre-adresse.md) : table `ParticipantEmailProof` (migration `20261204090000_preuve_d_adresse`), jeton à usage unique dont seule l'empreinte est gardée, 7 jours (choix de l'utilisatrice), purgé par le nettoyage (`retention.ts`). `server/utils/emailProofs.ts` (`requestEmailProof`, `confirmEmailProof`) ; route publique `POST /api/public/email-proofs/[token]`, limitée en débit ; page `pages/inscription/adresse/[token].vue`, qui attend le clic. La confirmation de la réponse, avec le lien personnel, part à l'adresse gardée, jamais à l'adresse à prouver. Politique de confidentialité : la demande et sa durée (`RETENTION.addressProofDays`).

## Tests

- Actions : `tests/e2e/registration.spec.ts` (« prouve par le lien reçu ») : réponse avec l'adresse d'une autre fiche, message, lien de preuve, clic, fiches réunies ; `tests/integration/publicRegistrations.test.ts` (« prouver une autre adresse ») : rien ne change avant la preuve, seul l'email de preuve part à l'autre adresse, réunion sur la fiche de l'adresse prouvée, inscription à la bonne adresse.
- Erreurs de saisie : lien déjà utilisé, inconnu ou expiré refusé avec le même message, rien ne change.
- Droits : la page et l'email ne montrent rien de l'autre fiche (nom, jeux, équipes).
- Hors ligne : la preuve demande le réseau ; sans réseau, la page le dit et le clic se réessaie.
