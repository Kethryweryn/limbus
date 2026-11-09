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
- [x] Un champ vide, et non seulement fait d'espaces, affiche aussi le message de Limbus, et non la bulle du navigateur ; il en va de même pour la quantité d'un objet et le jour d'un événement, dans tous ces formulaires comme dans ceux des lieux et des jeux.
- [x] Une photo de trombinoscope téléversée, dont l'adresse est relative, n'empêche plus d'enregistrer le personnage ; un lien externe refusé l'est par le serveur, avec son message.

## Notes techniques

Choix de l'utilisatrice le 2026-11-09 : un message partout plutôt qu'un bouton grisé. Le `:disabled` du bouton d'envoi est retiré de `CharacterForm`, `FactionForm`, `IntrigueForm`, `ItemForm`, `DocumentForm` et `TimelineEventForm` ; leur `validate()` affichait déjà les messages, que le bouton grisé rendait inatteignables. Revue de la PR #190 : les attributs `required`, `min` et `type="url"` de ces formulaires et de ceux des lieux et des jeux sont retirés, car le navigateur bloquait l'envoi avant Limbus ; `type="url"` refusait en plus l'adresse relative d'une photo téléversée.

## Tests

`tests/e2e/writingLists.spec.ts` : pour chaque liste, un nom vide puis un nom fait d'espaces affichent leur message, et le formulaire reste ouvert. `tests/e2e/writingSheets.spec.ts` : quantité 0, jour vide, lien sans `https://`, photo téléversée.
