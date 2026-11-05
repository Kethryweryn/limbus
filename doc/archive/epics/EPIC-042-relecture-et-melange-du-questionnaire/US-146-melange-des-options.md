---
id: US-146
titre: Mélanger l'ordre des options d'une question
statut: terminée
epic: EPIC-042
regles: [R1, R13]
adr: [ADR-0062]
---

# US-146 : Mélanger l'ordre des options d'une question

En tant qu'organisatrice, je veux mélanger l'ordre des options d'une question qui n'a pas d'ordre naturel, afin que la place d'une option ne pèse pas sur les réponses.

## Critères d'acceptation

- [x] Une question à choix unique ou multiples a une case « Mélanger les options », décochée par défaut.
- [x] Cochée, ses options s'affichent dans un ordre tiré au hasard à chaque affichage : formulaire de la personne, essai et aperçu de l'éditeur. L'ordre ne change pas pendant que la personne répond.
- [x] Le rendu serveur garde l'ordre saisi ; le tirage se fait après le montage. Corriger une option dans l'éditeur ne bouge pas les autres dans l'aperçu.
- [x] Changer le réglage crée une version du formulaire. Un formulaire déjà enregistré, sans ce réglage, n'en crée pas de nouvelle.
- [x] Les réponses restent enregistrées par le texte de l'option.
- [x] `lire_formulaire_inscription` rend le réglage. `modifier_formulaire_inscription` le change ; absent pour une question existante, il reste tel quel.
- [x] Le réglage est sans effet sur les prévisions : l'empreinte de la simulation ne change pas.

## Notes techniques

- `shuffleOptions` dans `registrationFormDefinitionSchema` et `normalizeRegistrationFormDefinition` ; `shuffledOptions` et `optionsInDrawnOrder` (`utils/registrationForms.ts`) ; affichage dans `components/RegistrationExtraFields.vue`.

## Tests

- Unitaires : `shuffledOptions` garde les mêmes options et suit le générateur ; normalisation (faux par défaut, sans effet sur une échelle ou un texte) ; pas de nouvelle version sans changement.
- Intégration : le réglage est enregistré, crée une version, et passe par les outils MCP.
- Bout en bout : l'aperçu, l'essai et le formulaire réel montrent les options cochées dans un ordre tiré au hasard et le gardent après une réponse ; le formulaire réel s'hydrate sans erreur, et la réponse suit le texte de l'option. S'y ajoute le test du message d'échec du calcul de la prévision (limite connue d'EPIC-041), avec un Web Worker simulé qui échoue.
