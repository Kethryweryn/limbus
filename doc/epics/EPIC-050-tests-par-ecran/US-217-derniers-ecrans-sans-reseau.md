---
id: US-217
titre: Savoir qu’une action ou une page demande le réseau, sur les derniers écrans
statut: terminée
epic: EPIC-050
regles: []
adr: []
---

# US-217 : Savoir qu’une action ou une page demande le réseau, sur les derniers écrans

En tant que personne qui utilise Limbus sans réseau, je veux que « Je participe », un document reçu, la page « Autoriser » d'un assistant d'IA et les réglages des assistants disent que le réseau manque, afin de ne pas lire « Décision impossible » ou « Impossible de charger » sans savoir pourquoi (défaut trouvé en écrivant les tests de l'US-202).

## Critères d'acceptation

- [x] Étant donné la page « Autoriser » sans réseau, quand la personne choisit « Autoriser » ou « Refuser », alors le message dit « Pas de réseau : cette action demande une connexion. Réessayez quand le réseau revient. », et rien n'est enregistré.
- [x] Étant donné une page qui se charge sans réseau et sans copie sur l'appareil (« Je participe », un document reçu, « Autoriser », un document ou un événement de la timeline), alors elle dit qu'elle demande une connexion, ou qu'elle n'a pas été consultée avec le réseau sur cet appareil.
- [x] Étant donné les assistants du compte ou du partage d'un jeu, une action refusée faute de réseau le dit de la même façon.
- [x] Les écrans de connexion, d'acceptation des conditions et de confirmation de l'adresse disent aussi l'absence de réseau.

## Notes techniques

Suite de l'US-214, même choix de l'utilisatrice (« Message clair », 2026-11-10). Les derniers appels à `serverMessage` dans les pages et composants passent à `apiErrorMessage` (action) ou `loadErrorMessage` (chargement). Revue de la PR #197 : `useApiAction` ne met plus jamais en file une action, même sur une route qui le permet ; avant, le réglage des assistants d'un jeu, refusé à l'écran hors ligne, partait quand même au retour du réseau.

## Tests

`tests/e2e/participantSpace.spec.ts` : « Autoriser », réglage des assistants d'un jeu, retrait d'un assistant, document et événement jamais lus, conditions et lien de confirmation, sans réseau. `tests/utils/apiErrors.test.ts` couvre `apiErrorMessage` et `loadErrorMessage`, désormais seuls utilisés par les écrans.
