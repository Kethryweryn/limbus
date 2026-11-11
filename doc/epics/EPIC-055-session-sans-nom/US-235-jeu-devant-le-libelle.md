---
id: US-235
titre: Le jeu devant le libellé, hors des pages du jeu
statut: terminée
epic: EPIC-055
regles: [R4]
adr: []
---

# US-235 : Le jeu devant le libellé, hors des pages du jeu

En tant que participante, je veux lire le jeu avec la session dans mes emails, mes PDF et « Je participe », afin de savoir de quel jeu parle « Session du 15 mai 2099 ».

## Critères d'acceptation

- [x] Étant donné un email, un PDF, « Je participe », le tableau de bord ou un document reçu, alors la session se lit « <jeu> — Session du <date> », sauf là où le titre du jeu est affiché juste à côté (R4).
- [x] Étant donné une page d'un jeu, alors la session se lit sans le jeu (R4).

## Notes techniques

- `withGame` (« Station Meridian — Session du 15 mai 2099 ») et `inGameSentence` (« la session du 15 mai 2099 de « Station Meridian » »), dans `utils/sessionLabels.ts`.
- Avec le jeu : l'objet et le texte des emails de fiche, de trombinoscope et de paiement, et leurs aperçus de test ; le sous-titre de la fiche personnage et des copies de trombinoscope. Déjà avec le jeu juste à côté, donc inchangés : « Je participe » (sessions rangées sous leur jeu), un document reçu, le tableau de bord, le PDF d'un document, la fiche allergies, les emails d'inscription et de présence.
- L'accès rapide de la page Timeline ne répète plus la date : le libellé la dit déjà.
- Les tests lisent l'objet décodé des emails (`subject`, `tests/integration/smtp.ts`).

## Tests

- Actions : l'email de paiement porte le jeu devant le libellé, dans son objet et son texte (`tests/e2e/sessionPayments.spec.ts`, `tests/integration/sessionPayments.test.ts`) ; `withGame` et `inGameSentence` (`tests/utils/sessionLabels.test.ts`).
- Erreurs de saisie : aucune saisie.
- Droits : inchangés ; rien de nouveau à protéger.
- Hors ligne : rien de nouveau ; les pages relues sans réseau gardent le libellé lu.
