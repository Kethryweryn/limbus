---
id: US-064
titre: Une invitation n'est acceptée que par l'adresse invitée
statut: terminée
epic: EPIC-013
regles: [R8]
adr: [ADR-0039]
---

# US-064 : Une invitation n'est acceptée que par l'adresse invitée

En tant que propriétaire, je veux que seule la personne invitée rejoigne mon jeu, même si le lien circule.

## Critères d'acceptation

- [x] Seul le compte dont l'email est celui de l'invitation l'accepte ; un autre compte connecté voit « Cette invitation a été envoyée à une autre adresse : demandez une nouvelle invitation », sans bouton pour accepter. Même règle pour un legs.
- [x] Créer son compte depuis une invitation se fait avec l'adresse invitée, qui n'est pas modifiable ; le lien reçu prouve l'adresse, le compte est confirmé d'emblée. Cela marche même inscription libre fermée.

## Notes techniques

- `acceptInvitationForUser` compare l'email du compte et celui de l'invitation ; `POST /api/auth/register` prend l'adresse de l'invitation.
- Corrige l'écart 1 de [SPEC-008](../../../specs/SPEC-008-comptes-et-partage.md).

## Tests

- Intégration : un autre compte est refusé (invitation et legs), la bonne adresse accepte, l'inscription par invitation ignore une autre adresse.
