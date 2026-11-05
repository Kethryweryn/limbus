---
id: US-145
titre: Demander une relecture à mon assistant d'IA
statut: terminée
epic: EPIC-042
regles: [R12]
adr: [ADR-0062, ADR-0058]
---

# US-145 : Demander une relecture à mon assistant d'IA

En tant qu'organisatrice, je veux une consigne « Relire le questionnaire » dans mon assistant d'IA, afin d'obtenir un avis plus large que les règles de mots, question par question.

## Critères d'acceptation

- [x] Le serveur MCP propose la consigne `relire_questionnaire`, avec l'argument `jeuId`.
- [x] Elle refuse un jeu hors de l'autorisation de l'assistant.
- [x] Elle rend les questions propres au jeu et leurs options, les signalements de US-144, les règles étayées avec leurs sources, et la demande : pour chaque question, le défaut, la règle et une réécriture proposée, dans la conversation.
- [x] Elle ne contient aucune réponse ni donnée de participant. Elle n'écrit rien, et rien n'est noté au journal.

## Notes techniques

- `server/mcp/prompts.ts`, par `server.registerPrompt`, avec le texte du message (`questionnaireReviewPrompt`). `safeErrorMessage` (`server/mcp/tools.ts`) ne montre pas le détail d'une erreur inattendue.

## Tests

- Unitaires : le message contient questions, options, signalements et sources.
- Intégration : la consigne est listée, lue pour un jeu autorisé (témoin positif), refusée pour un autre jeu, et sans écriture au journal.
