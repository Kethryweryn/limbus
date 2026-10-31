---
id: US-085
titre: Confirmer son email, puis suivre son inscription
statut: terminée
epic: EPIC-020
regles: [R11, R12, R13, R16]
adr: [ADR-0018, ADR-0046]
---

# US-085 : Confirmer son email, puis suivre son inscription

En tant que personne inscrite par le formulaire, je veux confirmer mon adresse par le lien reçu, puis modifier ou retirer mon inscription par ce même lien.

## Critères d'acceptation

- [x] L'email reçu contient un lien qui, ouvert, confirme l'adresse : l'inscription est alors reçue, et le lien devient le lien personnel.
- [x] La personne est rapprochée de sa fiche par son email ; sinon une fiche est créée dans le jeu, rattachée à son compte s'il existe.
- [x] Une inscription déjà reçue, ou désistée, repart à « reçue » avec les nouvelles réponses ; à un autre statut, elle ne change pas et seul le lien est renouvelé.
- [x] Par son lien personnel, la personne modifie son inscription reçue jusqu'à la clôture, et la retire à tout moment.
- [x] Une demande non confirmée sous 7 jours est supprimée.

## Notes techniques

- `RegistrationRequest` ; confirmation par `POST /api/public/registrations/:token/confirm`, jamais au simple affichage.

## Tests

- Intégration : confirmation, rapprochement de fiche, inscription qui repart, lien renouvelé, modification et retrait, purge.
