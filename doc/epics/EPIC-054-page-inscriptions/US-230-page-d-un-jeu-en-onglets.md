---
id: US-230
titre: La page Inscriptions d'un jeu en trois onglets, et le résumé des jeux
statut: terminée
epic: EPIC-054
regles: [R1, R3, R4, R5, R6, R7, R11, R13, R14]
adr: []
---

# US-230 : La page Inscriptions d'un jeu en trois onglets, et le résumé des jeux

En tant qu'organisatrice, je veux une page Inscriptions par jeu, en onglets Sessions, Vivier et Réglages, et un résumé de mes jeux, afin de ne plus faire défiler tous les jeux et toutes les sessions pour trouver ce que je cherche.

## Critères d'acceptation

- [x] Étant donné plusieurs jeux et aucun jeu actif, quand j'ouvre Inscriptions, alors je vois une ligne par jeu, triée par titre, avec l'état du vivier et le nombre de personnes ; un clic ouvre la page du jeu ; un jeu sans vivier a « Créer le vivier » (R1).
- [x] Étant donné un jeu actif, quand j'ouvre Inscriptions, alors j'arrive sur la page de ce jeu (R3).
- [x] Étant donné la page d'un jeu, alors son en-tête donne le titre, l'état du vivier et, sans jeu actif, un lien vers le résumé, et elle a les onglets Sessions, Vivier (avec le nombre de personnes) et Réglages ; un jeu sans vivier propose seulement « Créer le vivier » et « Formulaire » (R4).
- [x] Étant donné l'onglet Vivier ouvert, quand je recharge la page ou reviens d'une fiche, alors l'onglet Vivier est rouvert ; sans onglet dans l'adresse, c'est Sessions (R5).
- [x] Étant donné une action réussie ou refusée dans un onglet, alors son message s'affiche en haut de la page (R6).
- [x] Étant donné l'onglet Sessions, alors il donne le rappel des décisions et des rejoueurs, puis les sessions prévues dans l'ordre des dates, celles sans date en dernier (R7).
- [x] Étant donné l'onglet Vivier, alors il donne les invitations sans réponse et « Inviter », les personnes du vivier et leurs actions, puis les sorties du vivier repliées (R11).
- [x] Étant donné l'onglet Réglages, alors il donne l'état, « Ouvrir » ou « Fermer », le lien de diffusion, le délai, l'équipe prévenue, « Réglages », « Formulaire » et « Supprimer le vivier » (R13).
- [x] Étant donné les liens de la fiche de session et de l'email « cette personne est dans le vivier », alors ils mènent à la page du jeu, sur l'onglet Vivier sauf pour créer le vivier (R3).
- [x] Étant donné le résumé ou la page d'un jeu déjà lus, quand le réseau manque, alors ils se relisent, onglets compris ; un jeu téléchargé garde sa page Inscriptions (R14).

## Notes techniques

- `pages/registrations/index.vue` : le résumé ; avec un jeu actif, il ouvre la page du jeu une fois la liste des jeux lue (le jeu actif ne garde que son identifiant).
- `pages/registrations/[slug].vue` : la page d'un jeu, qui lit les mêmes listes que le résumé (jeux, viviers) ; elle se relit donc hors ligne, et un jeu téléchargé la garde sans changer le plan de lecture.
- `RegistrationPeriodsPanel` porte les messages et les onglets (`?onglet=vivier|reglages`, `REGISTRATION_TABS`) ; `RegistrationPeriodCard` devient l'onglet Réglages ; `RegistrationSelection` reçoit `view` (sessions ou vivier) et reste monté d'un onglet à l'autre, pour une seule lecture de la sélection. Ses messages passent par ceux du bloc, en haut de la page.
- Liens : la fiche de session mène à la page du jeu (Réglages pour ouvrir le vivier), l'email à l'équipe à son onglet Vivier.

## Tests

De bout en bout (`tests/e2e/registrationPage.spec.ts`), sur les quatre axes (ADR-0079) :

- Actions : « le résumé donne l’état et le vivier de chaque jeu ; un jeu sans vivier propose de le créer », « chaque onglet a sa part, l’onglet ouvert reste dans l’adresse et le lien ramène au résumé », « avec un jeu actif, Inscriptions mène à sa page, sans lien vers le résumé », « la fiche de session mène à la page du jeu ».
- Erreurs de saisie : aucune saisie nouvelle ; les formulaires déplacés gardent leurs tests (`registrationRules.spec.ts`, `registrationForm.spec.ts`), passés aux onglets.
- Droits : « une co-organisatrice a le jeu ; une organisatrice sans accès et une participante ne l’ont pas ».
- Hors ligne : « hors ligne, le résumé et la page du jeu se relisent, onglets compris ».

Intégration : l'email à l'équipe donne le lien de l'onglet Vivier du jeu (`formRegistrations.test.ts`).
