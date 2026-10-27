---
id: US-002
titre: Note d'intention et champs standards du formulaire
statut: terminée
epic: EPIC-001
regles: [R8, R9, R14]
adr: [ADR-0019]
---

# US-002 : Note d'intention et champs standards du formulaire

En tant qu'organisatrice, je veux choisir les informations demandées aux inscrits de mon jeu, afin de ne collecter que ce dont j'ai besoin.

## Critères d'acceptation

- [x] Chaque jeu a un formulaire d'inscription, réglable depuis son bloc sur la page « Inscriptions » (bouton « Formulaire », [US-009](US-009-page-inscriptions.md)).
- [x] Le formulaire affiche en ouverture la note d'intention du jeu, suivie d'une case « J'ai lu la note d'intention et j'y adhère », toujours obligatoire.
- [x] Champs standards, chacun avec deux réglages, « demandé » et « obligatoire » : nom, prénom, nom Facebook, téléphone, contact d'urgence (nom et téléphone), allergies et intolérances. L'email est toujours demandé et obligatoire.
- [x] Par défaut, sont demandés : nom, prénom, téléphone, contact d'urgence et allergies ; tous obligatoires sauf les allergies. Un champ non demandé est toujours facultatif.
- [x] Le champ allergies est accompagné d'une case de consentement explicite au traitement de ces données de santé, obligatoire si des allergies sont saisies (R14).
- [x] Un aperçu montre le formulaire tel que l'inscrit le verra.
- [x] Modifier le formulaire crée une nouvelle version ; enregistrer sans changement n'en crée pas. Une inscription gardera la version qu'elle a remplie (R9) : le lien est posé par US-003 et US-004, qui créent les inscriptions.

## Notes techniques

- Modèle : `RegistrationForm` (un par jeu) et `RegistrationFormVersion` (numéro, réglages des champs standards en JSON validé par zod, date). Les réponses aux champs standards sont des colonnes de `Registration` ([ADR-0019](../../adr/ADR-0019-modele-des-inscriptions.md)).
- Les questions propres au jeu et les affinités s'ajouteront à la version dans les epics suivants.
- Routes : `GET/PUT /api/games/:id/registration-form`, avec `requireGameAccess`.

## Réalisation

- Migration `20261028120000_add_registration_forms` : tables `RegistrationForm` et `RegistrationFormVersion` (définition en JSONB, unicité `formId` + `number`).
- `utils/registrationForms.ts` : liste des champs standards, définition par défaut, normalisation (un champ non demandé n'est pas obligatoire) et comparaison, partagées entre le serveur et l'interface.
- `server/utils/registrationForms.ts` :
  - `getCurrentRegistrationForm` renvoie la version en vigueur, ou la définition par défaut ;
  - `saveRegistrationFormDefinition` crée une version seulement si la définition change ; deux enregistrements simultanés donnent un 409 ;
  - `registrationAnswerSchema` construit le schéma des réponses d'un inscrit à partir d'une version : champs obligatoires, email normalisé, adhésion obligatoire, consentement exigé avec des allergies, champs non demandés ignorés. Il servira à US-004.
- Routes : `GET/PUT /api/games/:id/registration-form`. Le GET renvoie aussi la note d'intention du jeu pour l'aperçu.
- Écran : `RegistrationFormEditor`, ouvert par le bouton « Formulaire » du bloc du jeu. Il montre les réglages, un aperçu fidèle et le numéro de version.

## Tests

- Unitaires (`tests/server/registrationForms.test.ts`) : normalisation et comparaison des définitions, validation, schéma des réponses (champs obligatoires, email, adhésion, consentement santé, champs non demandés, champs vides).
- Intégration (`tests/integration/registrationForms.test.ts`) : définition par défaut, versions créées et conservées, enregistrement identique sans nouvelle version, définition incomplète refusée, co-organisatrice, cascade à la suppression du jeu. `isolation.test.ts` couvre le GET et le PUT sur le jeu de Bob.
- Écran vérifié à la main en local : réglages par défaut, champ décoché qui devient facultatif, aperçu, version 1 enregistrée, « aucun changement » au second enregistrement.
