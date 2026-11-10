---
id: US-206
titre: Voir le refus du serveur dans le formulaire d'un personnage ou d'un jeu
statut: terminée
epic: EPIC-050
regles: [R15]
adr: []
---

# US-206 : Voir le refus du serveur dans le formulaire d'un personnage ou d'un jeu

En tant qu'organisatrice, je veux que le formulaire d'un personnage ou d'un jeu, ouvert depuis la liste, me dise pourquoi le serveur refuse mon enregistrement, afin de ne pas rester devant un formulaire qui ne se ferme pas (défaut trouvé en écrivant les tests de l'US-198).

## Critères d'acceptation

- [x] Étant donné la liste des jeux, quand j'enregistre un lien de teaser sans `https://`, alors le formulaire reste ouvert et affiche le refus du serveur, et rien n'est enregistré.
- [x] Il en va de même pour le formulaire d'un personnage ouvert depuis la liste des personnages.

## Notes techniques

`pages/characters/index.vue` et `pages/games/index.vue` attrapaient l'erreur de l'enregistrement pour l'écrire dans la console : le formulaire, qui affiche l'erreur que l'enregistrement lui renvoie, ne la recevait pas. Les autres listes la laissaient déjà remonter.

## Tests

`tests/e2e/games.spec.ts` : un lien de teaser sans `https://` est refusé, avec son message.
