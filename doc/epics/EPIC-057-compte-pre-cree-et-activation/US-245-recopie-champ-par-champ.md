---
id: US-245
titre: Les coordonnées recopiées champ par champ
statut: terminée
epic: EPIC-057
regles: [R6, R12]
adr: [ADR-0089]
---

# US-245 : Les coordonnées recopiées champ par champ

En tant que participant, je veux que chaque champ que je remplis dans mon compte remplace celui de mes équipes, et seulement celui-là, afin que rien de ce qu'elles ont noté ne se perde tant que je n'ai pas répondu moi-même.

## Critères d'acceptation

- [x] Étant donné un compte activé qui n'a rempli que son téléphone, alors toutes ses équipes voient ce téléphone, et chacune garde le contact d'urgence et les allergies qu'elle avait notés.
- [x] Étant donné ce compte, quand une équipe modifie la fiche, alors :
  - le nom et le téléphone, s'ils sont remplis dans le compte, sont grisés, avec « Tenu par la personne depuis son compte » ;
  - les autres champs restent modifiables ;
  - le serveur refuse de changer un champ tenu, y compris depuis un assistant d'IA ou la file hors ligne.
- [x] Étant donné une adresse au compte activé, quand l'équipe y crée une fiche sous un autre nom, alors la fiche porte le nom du compte, et l'écran le dit (revue de la PR #242).
- [x] Étant donné une personne qui vide son téléphone dans son compte, alors chaque équipe le voit vide et peut le saisir de nouveau.
- [x] Étant donné un compte activé, alors son nom est toujours tenu par la personne.
- [x] Étant donné les comptes activés existants, après la migration, alors leurs champs remplis, nom compris, sont recopiés sur les fiches et les inscriptions, et rien d'autre ne change.

## Notes techniques

- Recopie : `syncProfileToParticipants` (`server/utils/participantAccounts.ts`).
- Champs vidés à l'enregistrement : `server/api/account/profile.put.ts`.
- Réponse depuis le compte : `server/utils/publicRegistrations.ts`.
- Refus d'un champ tenu : `server/utils/participantWrites.ts`. L'équipe n'écrit pas les coordonnées d'une inscription.
- Lecture : `server/utils/participantEmergency.ts`.
- Écran : `components/ParticipantForm.vue` (`heldFields`).
- Migration de données pour les comptes activés.

## Tests

- Actions (`tests/e2e/participantScreens.spec.ts`, « champ par champ ») : la personne remplit son téléphone, l'équipe le voit grisé ; la personne le vide, l'équipe le saisit. « coordonnées d'une personne qui a un compte » : nom et téléphone remplis, grisés. « la fiche créée à l'adresse d'un compte activé » : le nom du compte, et le message qui le dit.
- Erreurs de saisie : un nom ou un téléphone tenus, envoyés autrement par l'équipe, sont refusés avec « Le nom est tenu par la personne depuis son compte. » ou « Le téléphone est tenu… », rien n'est enregistré (`profile.test.ts`). L'écran grise ces champs : l'erreur ne vient que d'un assistant d'IA ou d'une file hors ligne.
- Droits : une équipe ne lit que la liste des champs tenus (`heldFields`), jamais d'autres valeurs du compte ; ses valeurs des champs non tenus restent à ses jeux (`profile.test.ts`, revue de la PR #237).
- Hors ligne : une modification mise en file pendant que la personne remplit son téléphone ne l'écrase pas au retour du réseau (même test e2e) : la recopie change la version de la fiche, la file reçoit un conflit.

Intégration (`profile.test.ts`) : recopie du seul téléphone avec les allergies de l'équipe gardées, téléphone vidé puis ressaisi par l'équipe, nom d'un compte activé recopié, contact d'urgence de la fiche lu dans le compte. Unitaires (`tests/server/profileFields.test.ts`) : champs tenus et champs vidés.

La migration ne recopie que le nom et le téléphone de chaque jeu : les inscriptions d'un compte qui a enregistré ses coordonnées les ont déjà reçues (ADR-0042), et le nom d'une inscription est celui que la personne y a donné.
