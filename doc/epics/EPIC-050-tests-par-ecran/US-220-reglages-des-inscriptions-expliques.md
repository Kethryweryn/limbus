---
id: US-220
titre: Lire le message de Limbus dans les réglages des inscriptions
statut: terminée
epic: EPIC-050
regles: []
adr: []
---

# US-220 : Lire le message de Limbus dans les réglages des inscriptions

En tant qu'organisatrice, je veux qu'un nombre ou une date refusés dans les réglages des inscriptions affichent le message de Limbus, afin de savoir quoi corriger au lieu d'une bulle du navigateur (défaut trouvé en écrivant les tests de l'US-203).

## Critères d'acceptation

- [x] Étant donné la fenêtre « Sélection » d'une session, quand le nombre de places choisies par organisatrice ou la taille de la liste d'attente est négatif, alors « Indiquez un nombre entre 0 et 1000. » s'affiche, et rien n'est enregistré.
- [x] Étant donné « Prolonger » sans date, alors un message demande de choisir une date.
- [x] Les formulaires des réglages du vivier, de l'invitation et de la réponse d'une personne ne laissent plus le navigateur bloquer l'envoi : leurs messages viennent de Limbus.

## Notes techniques

Même choix que l'US-204 (message de Limbus, pas la bulle du navigateur) : `novalidate` sur ces formulaires.

## Tests

`tests/e2e/registrationRules.spec.ts` : nombre négatif dans la fenêtre « Sélection », message de Limbus et rien d'enregistré.
