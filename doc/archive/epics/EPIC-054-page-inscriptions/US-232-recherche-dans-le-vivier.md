---
id: US-232
titre: Rechercher et filtrer dans le vivier
statut: terminée
epic: EPIC-054
regles: [R12]
adr: []
---

# US-232 : Rechercher et filtrer dans le vivier

En tant qu'organisatrice, je veux rechercher une personne du vivier par son nom et filtrer par vœu de session, afin de la retrouver vite dans un grand vivier.

## Critères d'acceptation

- [x] Étant donné un vivier, quand je tape un nom ou un email, en minuscules ou sans accents, alors seules les personnes et invitations qui correspondent restent, avec « n sur N » (R12).
- [x] Étant donné le filtre « Vœu de session », quand je choisis une session, alors seules les personnes qui l'ont demandée restent ; il se combine avec la recherche (R12).
- [x] Étant donné une recherche sans résultat, alors la liste le dit et propose d'effacer la recherche (R12).

## Notes techniques

- Dans `RegistrationSelection` (vue Vivier), sur la liste déjà lue : `normalizeName` (`utils/affinityMatching.ts`) pour le nom et l'email ; le vœu est une ligne de la session qui n'est ni « pas disponible » ni annulée. La recherche filtre aussi `RegistrationInvitationList`, désormais rendue dans cette vue ; le filtre par vœu ne vaut que pour les personnes du vivier. Une session filtrée qui quitte la liste remet le filtre sur toutes les personnes. `normalizeName` défait aussi les ligatures (œ, æ), ce qui vaut pour les affinités.
- Rien dans l'adresse.

## Tests

De bout en bout (`tests/e2e/registrationSearch.spec.ts`), sur les quatre axes (ADR-0079) :

- Actions : « la recherche trouve par nom sans accents ni majuscules, et par email ; elle filtre aussi les invitations », « le filtre par vœu garde les personnes qui ont demandé la session, et se combine avec la recherche ».
- Erreurs de saisie : « une recherche sans résultat le dit et s’efface ».
- Droits : ceux de la page (US-230), inchangés ; non rejoués ici.
- Hors ligne : « hors ligne, la recherche et le filtre marchent sur le vivier relu ».
