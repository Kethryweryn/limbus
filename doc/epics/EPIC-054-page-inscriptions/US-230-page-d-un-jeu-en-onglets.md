---
id: US-230
titre: La page Inscriptions d'un jeu en trois onglets, et le résumé des jeux
statut: à faire
epic: EPIC-054
regles: [R1, R3, R4, R5, R6, R7, R11, R13, R14]
adr: []
---

# US-230 : La page Inscriptions d'un jeu en trois onglets, et le résumé des jeux

En tant qu'organisatrice, je veux une page Inscriptions par jeu, en onglets Sessions, Vivier et Réglages, et un résumé de mes jeux, afin de ne plus faire défiler tous les jeux et toutes les sessions pour trouver ce que je cherche.

## Critères d'acceptation

- [ ] Étant donné plusieurs jeux et aucun jeu actif, quand j'ouvre Inscriptions, alors je vois une ligne par jeu, triée par titre, avec l'état du vivier et le nombre de personnes ; un clic ouvre la page du jeu ; un jeu sans vivier a « Créer le vivier » (R1).
- [ ] Étant donné un jeu actif, quand j'ouvre Inscriptions, alors j'arrive sur la page de ce jeu (R3).
- [ ] Étant donné la page d'un jeu, alors son en-tête donne le titre, l'état du vivier et un lien vers le résumé, et elle a les onglets Sessions, Vivier (avec le nombre de personnes) et Réglages ; un jeu sans vivier propose seulement « Créer le vivier » et « Formulaire » (R4).
- [ ] Étant donné l'onglet Vivier ouvert, quand je recharge la page ou reviens d'une fiche, alors l'onglet Vivier est rouvert ; sans onglet dans l'adresse, c'est Sessions (R5).
- [ ] Étant donné une action réussie ou refusée dans un onglet, alors son message s'affiche en haut de la page (R6).
- [ ] Étant donné l'onglet Sessions, alors il donne le rappel des décisions et des rejoueurs, puis les sessions à venir dans l'ordre des dates (R7).
- [ ] Étant donné l'onglet Vivier, alors il donne les invitations sans réponse et « Inviter », les personnes du vivier et leurs actions, puis les sorties du vivier repliées (R11).
- [ ] Étant donné l'onglet Réglages, alors il donne l'état, « Ouvrir » ou « Fermer », le lien de diffusion, le délai, l'équipe prévenue, « Réglages », « Formulaire » et « Supprimer le vivier » (R13).
- [ ] Étant donné les liens de la fiche de session et de l'email « cette personne est dans le vivier », alors ils mènent à la page du jeu, sur Réglages pour créer le vivier et sur Vivier sinon (R3).
- [ ] Étant donné le résumé ou la page d'un jeu déjà lus, quand le réseau manque, alors ils se relisent, onglets compris ; un jeu téléchargé garde sa page Inscriptions (R14).

## Notes techniques

- Nouvelle page `pages/registrations/[slug].vue` ; `pages/registrations/index.vue` devient le résumé. Le bloc `RegistrationPeriodsPanel` se répartit dans les onglets ; `RegistrationSelection` se sépare entre Sessions (sessions et tirages) et Vivier (personnes, sorties).
- Le plan de lecture hors ligne (`utils/offlinePlan.ts`) et le téléchargement d'un jeu suivent la nouvelle page.

## Tests

De bout en bout (Playwright), sur les quatre axes (ADR-0079) :

- Actions : chaque onglet, le lien vers le résumé, le clic sur un jeu, « Créer le vivier » depuis le résumé, l'onglet rouvert au retour.
- Erreurs de saisie : aucune saisie nouvelle ; les formulaires déplacés gardent leurs tests.
- Droits : co-organisatrice, organisatrice sans accès au jeu (refusée, et absente du résumé), participante.
- Hors ligne : résumé et page d'un jeu relus sans réseau ; jeu téléchargé.
