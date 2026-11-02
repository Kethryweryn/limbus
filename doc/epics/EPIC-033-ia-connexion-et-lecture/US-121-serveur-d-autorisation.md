---
id: US-121
titre: Serveur d'autorisation et page « Autoriser »
statut: terminée
epic: EPIC-033
regles: [R1, R2, R3, R4, R5, R6]
adr: [ADR-0058]
---

# US-121 : Serveur d'autorisation et page « Autoriser »

En tant qu'organisatrice, je veux autoriser mon assistant d'IA sur une page de Limbus, sans copier de secret, afin qu'il accède aux jeux que je choisis.

## Critères d'acceptation

- [x] **Découverte.** Sans jeton, `/mcp` répond 401 avec `WWW-Authenticate: Bearer resource_metadata=…`.
  - Les métadonnées de la ressource protégée (RFC 9728) et du serveur d'autorisation (RFC 8414) sont servies.
  - Elles annoncent PKCE S256, le client public (`none`), CIMD et `iss`.
- [x] **Inscription.** Un assistant s'inscrit par son document CIMD ou par inscription dynamique.
  - Le document CIMD n'est lu que sur un hôte public, en temps et en taille bornés.
  - L'inscription dynamique est limitée en débit. Un assistant inscrit qui n'a jamais servi est effacé au bout de 24 heures.
- [x] **Demande.** La demande d'autorisation exige :
  - une adresse de retour déclarée, identique au port près pour une adresse locale ;
  - PKCE S256 ;
  - la ressource de Limbus.

  Elle mène à la page « Autoriser », après la connexion si besoin.
- [x] **Page « Autoriser ».**
  - Elle affiche le nom de l'assistant et l'hôte de retour, avec un avertissement si l'adresse est locale.
  - Elle propose lecture seule ou lecture et écriture.
  - Elle liste les jeux à cocher : ceux de la personne, et les jeux partagés dont la propriétaire permet les assistants.
  - Elle ne s'affiche pas dans un cadre et n'est pas gardée en cache.
- [x] **Compte.** Seul un compte confirmé, actif et à jour de ses conditions peut autoriser.
- [x] **Jetons.**
  - Le code vaut 60 secondes, une seule fois.
  - Le point `token` vérifie PKCE, l'assistant, l'adresse de retour et la ressource. Il rend un jeton d'accès d'une heure et un jeton de rafraîchissement.
  - Le rafraîchissement renouvelle le jeton. Réutiliser un jeton déjà renouvelé fait tomber l'autorisation.
- [x] **Fin.** L'autorisation s'arrête :
  - quand elle est retirée ;
  - après 90 jours sans usage ;
  - quand les sessions du compte sont coupées (`revokeUserSessions`) ;
  - quand le compte est désactivé ou effacé.

## Notes techniques

- Tables `AiClient`, `AiAuthorizationRequest`, `AiAuthorization` et `AiToken`. Les codes et les jetons y sont gardés en empreinte SHA-256.
- Routes : `server/routes/oauth/*` et `server/routes/.well-known/*`.
- Page : `pages/autoriser/[id].vue`, avec l'API `api/oauth/requests/[id]` (lecture et décision), sous le contrôle d'origine des écritures (ADR-0053).
- La protection SSRF est commune avec `fetchPublicImage` (`server/utils/remoteImage.ts`).

## Tests

- Intégration :
  - parcours OAuth complet avec le client MCP officiel, en DCR et en CIMD ;
  - refus : PKCE, adresse de retour, ressource, code réutilisé ;
  - rafraîchissement et réutilisation, révocation, compte non confirmé.
- E2E : la page « Autoriser » (connexion, jeux, choix des droits).
