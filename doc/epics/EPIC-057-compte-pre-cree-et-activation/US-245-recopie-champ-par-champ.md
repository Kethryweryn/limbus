---
id: US-245
titre: Les coordonnées recopiées champ par champ
statut: à faire
epic: EPIC-057
regles: [R6, R12]
adr: [ADR-0089]
---

# US-245 : Les coordonnées recopiées champ par champ

En tant que participant, je veux que chaque champ que je remplis dans mon compte remplace celui de mes équipes, et seulement celui-là, afin que rien de ce qu'elles ont noté ne se perde tant que je n'ai pas répondu moi-même.

## Critères d'acceptation

- [ ] Étant donné un compte activé qui n'a rempli que son téléphone, alors toutes ses équipes voient ce téléphone, et chacune garde le contact d'urgence et les allergies qu'elle avait notés.
- [ ] Étant donné ce compte, quand une équipe modifie la fiche, alors :
  - le nom et le téléphone sont grisés, avec « Tenu par la personne depuis son compte » ;
  - les autres champs restent modifiables ;
  - le serveur refuse de changer un champ tenu, y compris depuis un assistant d'IA ou la file hors ligne.
- [ ] Étant donné une personne qui vide son téléphone dans son compte, alors chaque équipe le voit vide et peut le saisir de nouveau.
- [ ] Étant donné un compte activé, alors son nom est toujours tenu par la personne.
- [ ] Étant donné les comptes activés existants, après la migration, alors leurs champs remplis sont recopiés, et rien d'autre ne change.

## Notes techniques

- Recopie : `syncProfileToParticipants` (`server/utils/participantAccounts.ts`).
- Champs vidés à l'enregistrement : `server/api/account/profile.put.ts`.
- Réponse depuis le compte : `server/utils/publicRegistrations.ts`.
- Refus d'un champ tenu : `server/utils/participantWrites.ts` et les écritures d'inscription par l'équipe.
- Lecture : `server/utils/participantEmergency.ts`.
- Écran : `components/ParticipantForm.vue` (`heldFields`).
- Migration de données pour les comptes activés.

## Tests

- Actions (`tests/e2e/account.spec.ts`, `tests/e2e/participantScreens.spec.ts`) :
  - la personne remplit son téléphone : l'équipe le voit et garde ses allergies ;
  - la personne le vide : l'équipe le saisit.
- Erreurs de saisie : un champ tenu envoyé par l'équipe est refusé, avec un message, et rien n'est enregistré.
- Droits : une équipe ne voit que les valeurs de ses jeux pour les champs non tenus (`isolation.test.ts`).
- Hors ligne : une modification mise en file porte sur un champ que la personne a rempli entre-temps. Au retour du réseau, ce champ est refusé et les autres sont enregistrés.

Intégration : recopie à l'enregistrement, champ vidé, champ jamais rempli, réponse depuis le compte.
