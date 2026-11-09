---
id: US-204
titre: Savoir quel champ obligatoire manque
statut: terminée
epic: EPIC-050
regles: []
adr: []
---

# US-204 : Savoir quel champ obligatoire manque

En tant qu'organisatrice, je veux qu'un formulaire auquel il manque un champ obligatoire me dise lequel, afin de ne pas rester devant un bouton grisé sans explication (défaut trouvé en écrivant les tests de l'US-198).

## Critères d'acceptation

- [x] Étant donné un formulaire de personnage, groupe, intrigue, objet, document ou événement, quand le nom (ou le titre) est vide, alors « Créer » et « Enregistrer » restent actifs, et un clic affiche « Le nom est requis. » (« Le titre est requis. ») sous le champ, sans rien enregistrer.
- [x] Il en va de même pour les autres champs obligatoires : le jeu, le corps ou le lien d'un document, le jour et l'heure d'un événement.
- [x] Les formulaires des lieux et des jeux, qui le faisaient déjà, ne changent pas.

## Notes techniques

Choix de l'utilisatrice le 2026-11-09 : un message partout plutôt qu'un bouton grisé. Le `:disabled` du bouton d'envoi est retiré de `CharacterForm`, `FactionForm`, `IntrigueForm`, `ItemForm`, `DocumentForm` et `TimelineEventForm` ; leur `validate()` affichait déjà les messages, que le bouton grisé rendait inatteignables.

## Tests

`tests/e2e/writingLists.spec.ts` : pour chaque liste, un nom fait d'espaces affiche son message, et le formulaire reste ouvert.
