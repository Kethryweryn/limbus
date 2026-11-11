---
id: US-238
titre: L'email obligatoire sur une fiche
statut: terminée
epic: EPIC-056
regles: [R3]
adr: [ADR-0086]
---

# US-238 : L'email obligatoire sur une fiche

En tant qu'organisatrice, je veux qu'une fiche ait toujours une adresse, afin qu'elle appartienne à la personne qu'elle décrit.

## Critères d'acceptation

- [x] Étant donné le formulaire de fiche, quand j'enregistre sans email, alors l'enregistrement est refusé avec « L'adresse email est obligatoire », et rien n'est enregistré ; de même depuis un assistant d'IA.
- [x] Étant donné une fiche existante sans email, alors la page Participants la signale (« Sans email »), et une case « Sans email » les liste.
- [x] Étant donné une fiche sans email, quand je modifie autre chose, alors l'enregistrement demande une adresse.
- [x] Une inscription par lien personnel ou par formulaire public ne change pas : elle porte déjà une adresse.

## Notes techniques

Schémas zod de création et de modification (`server/utils/schemas.ts`), outils `creer_participant` et `modifier_participant` ; `components/ParticipantForm.vue`, `pages/participants/index.vue`. La colonne reste facultative en base tant que des fiches sans email existent.

## Tests

- Actions : `tests/e2e/participantScreens.spec.ts` (« email obligatoire ») : mention et case « Sans email », fiche complétée par une adresse.
- Erreurs de saisie : création sans adresse (« liste : … création refusée ») et modification d'une fiche sans adresse refusées avec « L’adresse email est obligatoire. », rien d'enregistré ; `creer_participant` sans adresse refusé (`tests/integration/aiAssistants.test.ts`).
- Droits : la case ne liste que les fiches des jeux visibles (fiche d'une autre équipe absente).
- Hors ligne : la modification sans adresse, ou d'une adresse mal formée, est refusée avant la mise en file, rien n'attend le réseau (revue de la PR #231).
- Une adresse mal formée d'avant la vérification est signalée « Email invalide » et comptée dans la case (revue de la PR #231).
