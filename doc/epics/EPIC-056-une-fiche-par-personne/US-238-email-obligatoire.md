---
id: US-238
titre: L'email obligatoire sur une fiche
statut: à faire
epic: EPIC-056
regles: [R3]
adr: [ADR-0086]
---

# US-238 : L'email obligatoire sur une fiche

En tant qu'organisatrice, je veux qu'une fiche ait toujours une adresse, afin qu'elle appartienne à la personne qu'elle décrit.

## Critères d'acceptation

- [ ] Étant donné le formulaire de fiche, quand j'enregistre sans email, alors l'enregistrement est refusé avec « L'adresse email est obligatoire », et rien n'est enregistré ; de même depuis un assistant d'IA.
- [ ] Étant donné une fiche existante sans email, alors la page Participants la signale (« Sans email »), et un filtre les liste.
- [ ] Étant donné une fiche sans email, quand je modifie autre chose, alors l'enregistrement demande une adresse.
- [ ] Une inscription par lien personnel ou par formulaire public ne change pas : elle porte déjà une adresse.

## Notes techniques

Schémas zod de création et de modification (`server/utils/schemas.ts`), outils `creer_participant` et `modifier_participant` ; `components/ParticipantForm.vue`, `pages/participants/index.vue`. La colonne reste facultative en base tant que des fiches sans email existent.

## Tests

- Actions : filtre « Sans email », ajout d'une adresse à une fiche signalée.
- Erreurs de saisie : création et modification sans email refusées, message attendu, rien d'enregistré.
- Droits : inchangés ; le filtre ne montre que les fiches des jeux visibles.
- Hors ligne : une modification sans email est refusée avant la mise en file, avec le message.
