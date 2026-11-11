---
id: US-243
titre: Prouver une autre adresse donnée en réponse, puis réunir les deux fiches
statut: à faire
epic: EPIC-056
regles: [R4, R8]
adr: [ADR-0086]
---

# US-243 : Prouver une autre adresse donnée en réponse, puis réunir les deux fiches

En tant que participant, je veux que l'adresse que je donne en répondant à une invitation soit reconnue comme la mienne une fois prouvée, afin d'avoir une seule fiche, même si une autre fiche portait déjà cette adresse.

Choix de l'utilisatrice, le 2026-11-11 : un lien envoyé à l'autre adresse prouve qu'elle est à la personne, puis les deux fiches sont réunies ; en attendant, la réponse est enregistrée et la fiche comme l'inscription gardent l'adresse d'origine ; après la preuve, tout passe sur la fiche de l'adresse prouvée.

## Critères d'acceptation

- [ ] Étant donné une réponse par le lien personnel qui donne l'adresse d'une autre fiche, alors la réponse est enregistrée, la fiche et l'inscription gardent leur adresse, un email part à l'autre adresse avec un lien de preuve, et la page dit à la personne de cliquer sur ce lien.
- [ ] Étant donné le lien de preuve ouvert, alors tout ce que tient la fiche d'origine (jeux, notes, noms, inscriptions, sessions, paiements…) passe sur la fiche de l'adresse prouvée (`limbus_move_participant`), la fiche d'origine disparaît, et les inscriptions déplacées prennent l'adresse prouvée.
- [ ] Le lien de preuve ne sert qu'une fois et expire ; un lien inconnu, déjà utilisé ou expiré répond pareil.
- [ ] Le lien de preuve ne montre rien de l'autre fiche (ni nom, ni jeux) ; l'email ne dit pas quelles équipes la suivent.
- [ ] Une réponse faite connectée au compte (« Je participe ») suit la même règle.

## Notes techniques

Jeton à usage unique (comme les liens de confirmation, ADR-0018), haché en base, durée de vie à fixer dans l'ADR de cette US. Route publique de preuve, limitée en débit. Politique de confidentialité : l'email de preuve est un nouvel envoi.

## Tests

À écrire avec l'implémentation, sur les quatre axes (ADR-0079) : actions (réponse, email, preuve, fusion), erreurs de saisie (lien invalide ou expiré), droits (rien de l'autre fiche n'est montré), hors ligne (la réponse est une action en ligne ; la page le dit sans réseau).
