---
id: US-135
titre: Essayer le questionnaire comme un joueur
statut: terminée
epic: EPIC-038
regles: [R1, R2, R3]
adr: [ADR-0062, ADR-0051]
---

# US-135 : Essayer le questionnaire comme un joueur

En tant qu'organisatrice, je veux répondre à mon questionnaire comme un joueur et voir quels personnages ressortent, afin de vérifier mes questions et mes liens avant d'ouvrir les inscriptions.

## Critères d'acceptation

- [x] Dans l'éditeur du formulaire d'inscription, un bouton « Essayer le questionnaire » ouvre une fenêtre avec les questions propres au jeu, hors texte libre, telles qu'un joueur les voit.
- [x] L'essai porte sur les questions et les liens en cours dans l'éditeur, même pas encore enregistrés.
- [x] À chaque réponse, les personnages PJ sont reclassés par note, calculée comme dans l'assistant de casting (1 point direct, ½ par la faction ou l'intrigue, une échelle à proportion).
- [x] Chaque personnage montre le détail de sa note : les réponses qui y contribuent et leurs points.
- [x] Les ex æquo sont signalés. Les personnages qu'aucune réponse donnée ne rejoint sont regroupés à part.
- [x] Fermer la fenêtre ne laisse rien : aucune inscription, aucune réponse, aucun repère changé.
- [x] Sans question reliée, la fenêtre le dit et renvoie aux liens.

## Notes techniques

- `components/RegistrationFormTrial.vue` (`UModal`, contenu dans `#body`), monté à l'ouverture depuis `components/RegistrationFormEditor.vue`. Il reçoit les questions et les liens de l'éditeur ; une question pas encore enregistrée y a un identifiant provisoire.
- Les personnages PJ, avec leurs factions et intrigues, viennent de la route de l'encadré (`GET /api/games/:id/registration-form-quality`, US-133), qui les rend en plus des repères. L'encadré les passe à l'éditeur : l'essai ne relit pas la route.
- Notes : `trialRanking` (`utils/questionnaireTrial.ts`) sur `castingScore` (`utils/castingAssistant.ts`), dans le navigateur. Aucune route d'écriture.
- Les champs de réponse réutilisent le rendu des questions du formulaire public (`components/RegistrationExtraFields.vue`).

## Tests

- Unitaires : classement et ex æquo à partir de réponses données, personnage non rejoint, lien par faction.
- Intégration : la route de l'encadré rend les personnages PJ avec leurs factions et intrigues ; `isolation.test.ts` couvre déjà la route (US-133).
- Bout en bout : ouvrir l'essai, répondre, voir le personnage relié passer en tête avec le détail de sa note, fermer sans qu'aucune inscription n'apparaisse.
