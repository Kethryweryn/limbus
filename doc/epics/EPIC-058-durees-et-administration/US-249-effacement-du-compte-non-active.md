---
id: US-249
titre: Effacer un compte non activé avec sa dernière fiche
statut: terminée
epic: EPIC-058
regles: [R13, R14]
adr: [ADR-0090]
---

# US-249 : Effacer un compte non activé avec sa dernière fiche

En tant que personne inscrite à un jeu sans avoir activé de compte, je veux que rien ne reste sur moi quand plus aucune équipe ne suit ma fiche, afin que Limbus ne garde pas mon adresse sans raison.

## Critères d'acceptation

- [x] Étant donné une fiche au compte non activé, quand la dernière équipe qui la suit l'efface ou la retire de son dernier jeu, alors le compte est effacé aussitôt, avec la fiche.
- [x] Étant donné une fiche au compte non activé suivie par deux équipes, quand l'une l'efface, alors la fiche et le compte restent pour l'autre (R14).
- [x] Étant donné une fiche au compte non activé effacée par l'effacement automatique des fiches inactives, alors le compte part avec elle.
- [x] Étant donné une fiche réunie à une autre (preuve d'adresse, changement d'adresse d'un compte), alors le compte non activé de la fiche qui disparaît est effacé, s'il ne porte plus aucune fiche.
- [x] Étant donné une équipe qui corrige l'adresse d'une fiche qu'elle est seule à suivre, alors le compte non activé de l'ancienne adresse, sans plus aucune fiche, est effacé (revue de la PR #246).
- [x] Un compte activé n'est jamais effacé ainsi.
- [x] La politique de confidentialité dit : « Compte non activé : tant qu'une fiche participant porte son adresse ».

## Notes techniques

- `deleteFiche` (`server/utils/participantAccounts.ts`), appelée dans la transaction de chaque suppression de fiche : `participantPrivacy.ts` (effacement, donc aussi le retrait du dernier jeu et l'effacement automatique), `participantWrites.ts` (correction d'adresse), `emailProofs.ts` (réunion).
- `pages/confidentialite.vue`.
- Pas de changement de `TERMS_VERSION` : la durée devient plus courte, sans nouvelle donnée.

## Tests

- Actions (`tests/e2e/participantScreens.spec.ts`, « le compte non activé de la fiche part avec elle ») : la suppression depuis la fiche efface aussi le compte.
- Erreurs de saisie : sans objet, rien n'est saisi.
- Droits : une fiche suivie par une autre équipe garde son compte, jusqu'à ce que la dernière équipe l'efface (`preCreatedAccounts.test.ts`).
- Hors ligne : la suppression faite hors ligne depuis la liste efface le compte au retour du réseau (même test e2e).

Intégration : retrait du dernier jeu, correction d'adresse (`preCreatedAccounts.test.ts`), effacement automatique des fiches inactives (`retention.test.ts`), preuve d'adresse (`publicRegistrations.test.ts`), compte activé gardé.
