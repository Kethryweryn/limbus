---
id: US-091
titre: Attribut d'équilibre des personnages et question d'équilibre
statut: terminée
epic: EPIC-022
regles: [R8, R17]
adr: [ADR-0048]
---

# US-091 : Attribut d'équilibre des personnages et question d'équilibre

En tant qu'organisatrice, je veux donner à mes PJ un attribut d'équilibre (par exemple le genre du personnage) et demander la préférence des inscrits, afin que le tirage respecte la répartition des rôles.

## Critères d'acceptation

- [x] Le jeu a un attribut d'équilibre facultatif : un nom et ses valeurs.
- [x] Chaque PJ peut recevoir une de ces valeurs.
- [x] L'éditeur du formulaire active la question d'équilibre, obligatoire ou non, si le jeu a un attribut.
- [x] La question propose les valeurs du jeu et « Peu importe » ; la réponse est visible dans le détail de l'inscription et dans l'export des données de la personne.

## Notes techniques

- `Game.balanceAttribute`, `Game.balanceValues`, `Character.balanceValue`, `Registration.balancePreference` ; `balance` dans la définition du formulaire.

## Tests

- Unitaires : définition normalisée, réponse validée.
- Intégration : réponse enregistrée par le formulaire public, valeur hors liste refusée.
