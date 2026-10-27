---
id: US-002
titre: Note d'intention et champs standards du formulaire
statut: à faire
epic: EPIC-001
regles: [R8, R9, R14]
adr: [ADR-0019]
---

# US-002 : Note d'intention et champs standards du formulaire

En tant qu'organisatrice, je veux choisir les informations demandées aux inscrits de mon jeu, afin de ne collecter que ce dont j'ai besoin.

## Critères d'acceptation

- [ ] Chaque jeu a un formulaire d'inscription, réglable depuis l'onglet « Inscriptions ».
- [ ] Le formulaire affiche en ouverture la note d'intention du jeu, suivie d'une case « J'ai lu la note d'intention et j'y adhère », toujours obligatoire.
- [ ] Champs standards, chacun avec deux réglages, « demandé » et « obligatoire » : nom, prénom, nom Facebook, téléphone, contact d'urgence (nom et téléphone), allergies et intolérances. L'email est toujours demandé et obligatoire.
- [ ] Par défaut, sont demandés : nom, prénom, téléphone, contact d'urgence et allergies.
- [ ] Le champ allergies est accompagné d'une case de consentement explicite au traitement de ces données de santé, obligatoire si des allergies sont saisies (R14).
- [ ] Un aperçu montre le formulaire tel que l'inscrit le verra.
- [ ] Modifier le formulaire crée une nouvelle version ; une inscription garde la version qu'elle a remplie (R9).

## Notes techniques

- Modèle : `RegistrationForm` (un par jeu) et `RegistrationFormVersion` (numéro, réglages des champs standards en JSON validé par zod, date). Les réponses aux champs standards sont des colonnes de `Registration` ([ADR-0019](../../adr/ADR-0019-modele-des-inscriptions.md)).
- Les questions propres au jeu et les affinités s'ajouteront à la version dans les epics suivants.
- Routes : `GET/PUT /api/games/:id/registration-form`, avec `requireGameAccess`.

## Tests

- Unitaires : validation des réglages, construction du schéma de réponse à partir d'une version (champ obligatoire, consentement exigé avec les allergies).
- Intégration : une modification crée une version ; ajout à `isolation.test.ts`.
