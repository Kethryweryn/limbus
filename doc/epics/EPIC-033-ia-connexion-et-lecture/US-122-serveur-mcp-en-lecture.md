---
id: US-122
titre: Serveur MCP et outils de lecture
statut: terminée
epic: EPIC-033
regles: [R4, R5, R7, R8, R9, R12, R14, R15]
adr: [ADR-0058]
---

# US-122 : Serveur MCP et outils de lecture

En tant qu'organisatrice, je veux que mon assistant lise mes jeux, afin qu'il m'aide à les écrire et à préparer mes sessions.

## Critères d'acceptation

- [x] `/mcp` sert le protocole MCP du 28 juillet 2026, sans état. Il n'accepte que le jeton Bearer, jamais le cookie.
- [x] Outils de lecture, déclarés en lecture seule :
  - les jeux ;
  - le contenu d'un jeu : personnages, factions, intrigues, objets, documents (texte), lieux, chronologie et relations, d'abord en résumé paginé, puis fiche par fiche ;
  - les sessions : détails, équipe, casting, déroulé ;
  - les participants : nom et notes d'organisation du jeu ;
  - les périodes d'inscription, le formulaire, la sélection et le journal des tirages.
- [x] Jamais rendus :
  - coordonnées, allergies, paiements et fichiers ;
  - texte libre écrit par un participant.
- [x] D'une inscription, l'assistant voit :
  - les réponses fermées ;
  - les affinités rattachées, comme un lien vers la personne ;
  - les affinités marquées « personne du jeu ne correspond ».
- [x] Seuls les jeux de l'autorisation sont visibles. Un jeu partagé ne l'est que si sa propriétaire permet les assistants.
- [x] Les appels sont limités en débit par autorisation.

## Notes techniques

- `server/routes/mcp.ts` :
  - la passerelle Bearer pose le compte (`event.context.authUser`) et l'autorisation (`event.context.aiAuthorization`) sur l'événement h3 ;
  - un serveur MCP est créé par requête, et ses outils reçoivent cet événement.
- `server/utils/gameAccess.ts` restreint `accessibleGameWhere` et ses appelants aux jeux de l'autorisation.
- `server/mcp/` : un fichier par domaine d'outils, avec des projections explicites. Aucun objet Prisma n'est rendu tel quel.

## Tests

- Unitaires : les projections, et leurs champs exclus.
- Intégration :
  - chaque outil ;
  - le refus hors des jeux de l'autorisation ;
  - un jeu partagé, avec et sans le réglage de la propriétaire ;
  - `isolation.test.ts`.
