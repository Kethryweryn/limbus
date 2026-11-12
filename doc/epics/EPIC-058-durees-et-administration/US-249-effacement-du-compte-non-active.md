---
id: US-249
titre: Effacer un compte non activé avec sa dernière fiche
statut: à faire
epic: EPIC-058
regles: [R13, R14]
adr: [ADR-0090]
---

# US-249 : Effacer un compte non activé avec sa dernière fiche

En tant que personne inscrite à un jeu sans avoir activé de compte, je veux que rien ne reste sur moi quand plus aucune équipe ne suit ma fiche, afin que Limbus ne garde pas mon adresse sans raison.

## Critères d'acceptation

- [ ] Étant donné une fiche au compte non activé, quand la dernière équipe qui la suit l'efface ou la retire de son dernier jeu, alors le compte est effacé aussitôt, avec la fiche.
- [ ] Étant donné une fiche au compte non activé suivie par deux équipes, quand l'une l'efface, alors la fiche et le compte restent pour l'autre (R14).
- [ ] Étant donné une fiche au compte non activé effacée par l'effacement automatique des fiches inactives, alors le compte part avec elle.
- [ ] Étant donné une fiche réunie à une autre (preuve d'adresse, changement d'adresse d'un compte), alors le compte non activé de la fiche qui disparaît est effacé, s'il ne porte plus aucune fiche.
- [ ] Un compte activé n'est jamais effacé ainsi.
- [ ] La politique de confidentialité dit : « Compte non activé : tant qu'une fiche participant porte son adresse ».

## Notes techniques

- Une fonction commune, appelée dans la transaction de chaque suppression de fiche : `participantPrivacy.ts`, `participantWrites.ts`, `emailProofs.ts`, `retention.ts`.
- `pages/confidentialite.vue`.
- Pas de changement de `TERMS_VERSION` : la durée devient plus courte, sans nouvelle donnée.

## Tests

- Actions (`tests/e2e/participantScreens.spec.ts`) : supprimer la fiche d'une personne au compte non activé efface aussi son compte.
- Erreurs de saisie : sans objet, rien n'est saisi.
- Droits : une fiche suivie par une autre équipe garde son compte (intégration).
- Hors ligne : une suppression faite hors ligne efface le compte au retour du réseau.

Intégration : chaque chemin de suppression, et le compte activé gardé.
