---
id: ADR-0058
titre: Serveur MCP et serveur d'autorisation OAuth pour brancher une IA
statut: accepté
date: 2026-11-02
liens: [../specs/SPEC-014-api-pour-ia.md, ../revues/2026-11-02-api-pour-ia.md, ADR-0038-un-seul-role-global.md, ADR-0053-durcissement-web.md]
---

# ADR-0058 : Serveur MCP et serveur d'autorisation OAuth pour brancher une IA

## Contexte

[SPEC-014](../specs/SPEC-014-api-pour-ia.md) (R1) : Limbus sert un serveur MCP protégé par OAuth 2.1 et en est lui-même le serveur d'autorisation. Avant de coder le lot 1, l'utilisatrice a demandé deux essais du serveur d'autorisation :

- un serveur écrit pour Limbus ;
- un serveur fondé sur `oidc-provider`, bibliothèque Node certifiée OpenID.

Elle tranche sur cette comparaison.

### Les essais

Faits le 2 novembre 2026, hors du dépôt. Chacun a un « Limbus » réduit : deux comptes, trois jeux, et un cookie de connexion qui porte l'identifiant et la version de session, comme le JWT actuel. Les deux partagent le même serveur MCP et la même page de consentement. Ils tournent sous h3 v1, la version de Nitro.

Un client de test se branche sur chacun. Il utilise le kit MCP officiel (`@modelcontextprotocol/client` 2.4.0, spécification du 28 juillet 2026) et fait tout le parcours, une fois avec inscription dynamique (DCR), une fois avec document de métadonnées (CIMD) :

- découverte des métadonnées ;
- inscription ;
- consentement ;
- code avec PKCE ;
- validation de `iss` ;
- appel des outils.

Il vérifie 17 points :

- 401 et `resource_metadata` sans jeton ;
- CIMD et `iss` annoncés ;
- seuls les jeux cochés visibles ;
- écriture permise sur un jeu coché, refusée sur un jeu non coché ou d'un autre compte ;
- jeton de rafraîchissement renouvelé, et sa réutilisation qui fait tomber l'autorisation ;
- `revokeUserSessions` qui coupe le jeton d'accès et le rafraîchissement ;
- jeton inconnu refusé.

**Résultat : les deux essais passent les 17 vérifications, en DCR comme en CIMD.**

| | Essai A : écrit pour Limbus | Essai B : `oidc-provider` 9.13.3 |
|---|---|---|
| Code de l'essai | 218 lignes | 122 lignes |
| Dépendances ajoutées | aucune (`node:crypto`) | `oidc-provider`, Koa et `jose` : 34 paquets, 2,7 Mo |
| Stockage en production | quatre tables Prisma : assistants inscrits, codes, autorisations, jetons (empreintes) | un adaptateur Prisma pour les objets de la bibliothèque (session, interaction, grant, code, jetons, assistants), plus la table Limbus des autorisations (jeux cochés, droits, version de session) |
| CIMD | écrit dans l'essai | fonction expérimentale (brouillon 02), à confirmer par `ack` ; peut changer avec une version mineure |
| Protection SSRF à la lecture d'un document CIMD | à écrire, sur le modèle de `fetchPublicImage` | intégrée : refuse les adresses privées et locales (il a fallu la désactiver pour l'essai local) |
| PKCE, `iss` (RFC 9207), ressource (RFC 8707), renouvellement du rafraîchissement | écrits dans l'essai (une centaine de lignes) | fournis et éprouvés |
| Détection de réutilisation d'un rafraîchissement | écrite (l'autorisation entière tombe) | fournie |
| Frictions d'intégration | aucune : routes Nitro ordinaires | voir ci-dessous |
| Messages d'erreur | en français, dans le style de Limbus | page anglaise par défaut (`renderError` à réécrire) |
| Secrets à gérer | aucun nouveau (les jetons sont aléatoires, gardés en empreinte) | clés de cookies et jeu de clés de signature (`jwks`), même pour des jetons opaques |
| Responsabilité de sécurité | la nôtre, sur une petite surface | portée par une bibliothèque certifiée, très suivie (auteur de `jose`) |

Les frictions de l'essai B :

- les métadonnées sont servies seulement en OpenID Connect (`/.well-known/openid-configuration`), et il a fallu une route vers l'emplacement RFC 8414 ;
- une portée demandée doit être déclarée deux fois, comme portée « OpenID » et comme portée de ressource, sinon le consentement tourne en boucle ;
- la bibliothèque tient ses propres sessions et cookies d'interaction, à côté du cookie Limbus ;
- Koa est monté comme intergiciel Node dans Nitro ;
- la bibliothèque fait bien plus que ce qu'il faut : OpenID Connect, jetons d'identité, CIBA, appareil, mTLS… Tout doit être désactivé ou ignoré.

### Ce que les deux essais ont en commun

- **Serveur MCP** : `@modelcontextprotocol/server` 2.4.0, sans état (`createMcpHandler`, un serveur par requête), monté sur une route Nitro par conversion en `Request` standard.
- **Passerelle Bearer** : `requireBearerAuth` vérifie la ressource (`expectedResource`) et l'expiration, puis passe l'autorisation vérifiée aux outils (`ctx.http.authInfo`).
- **Jetons opaques** : leur empreinte est en base. La vérification relit l'autorisation à chaque appel, ce qui permet le retrait immédiat et le contrôle de `sessionVersion` (SPEC-014, R6).
- Le cookie de connexion n'est jamais accepté sur `/mcp`.

## Décision

**A, le serveur écrit pour Limbus** : choix de l'utilisatrice le 2 novembre 2026, sur la recommandation de cet ADR.

- Le besoin est étroit :
  - un seul type d'autorisation (code avec PKCE, puis rafraîchissement) ;
  - des assistants qui sont tous des clients publics ;
  - pas d'OpenID Connect ni de jeton signé.

  L'essai A le couvre en un peu plus de 200 lignes, sans dépendance ni secret nouveau, dans des routes Nitro et des tables Prisma comme le reste.
- La partie la plus mouvante, CIMD, est expérimentale dans `oidc-provider` et peut changer d'une version mineure à l'autre. Dans A, on la suit au rythme de la spécification MCP.
- Le risque de A, du code de sécurité écrit par nous, est réduit par :
  - les tests d'intégration du parcours complet, repris de l'essai ;
  - les tests d'isolation ;
  - la protection SSRF reprise de `fetchPublicImage` ;
  - la liste des exigences de la spécification MCP et d'OAuth 2.1, citée dans le code.

Les choix communs ci-dessus s'appliquent.

## Conséquences


- tables Prisma pour les assistants, les codes (60 secondes), les autorisations (SPEC-014, R4 à R6) et les jetons, gardés en empreinte : accès une heure, rafraîchissement renouvelé à chaque usage ;
- points d'accès sous `/oauth/` :
  - `register` (DCR, dépréciée). Claude passe par CIMD dès qu'il est annoncé, mais Mistral Work et les assistants sans CIMD en ont encore besoin. Elle est limitée en débit par adresse IP, et un assistant inscrit qui n'a jamais servi est effacé au bout de 24 heures ;
  - `authorize` (page de consentement Limbus) ;
  - `token` (format `application/x-www-form-urlencoded`, réponse en moins de 10 secondes) ;
- métadonnées RFC 8414 et RFC 9728 ;
- lecture des documents CIMD avec la même protection que `fetchPublicImage` (hôte public, délai, taille), et cache court ;
- limites de débit (SPEC-014, R14), fixées au lot 1 :
  - serveur MCP : 120 appels par minute et par autorisation ;
  - point `token` : 60 appels par minute et par adresse ;
  - inscription dynamique : 20 par heure et par adresse ;
- tests d'intégration du parcours OAuth complet, avec le client MCP officiel ;
- toute évolution de la spécification MCP (par exemple `iss` qui deviendra obligatoire) est à reporter à la main.


## Options écartées

- **`oidc-provider` (essai B)** : il passe les mêmes vérifications. Il est écarté pour sa fonction CIMD expérimentale, ses frictions d'intégration et ses 34 paquets. Il demanderait aussi un adaptateur de stockage, des clés de chiffrement et des pages d'erreur en anglais à refaire.

- **Better Auth (greffons `mcp()` et `cimd()`)** : en version bêta, et il remplacerait toute l'authentification de Limbus (JWT, `sessionVersion`, règles ADR-0039 et ADR-0042).
- **Fournisseur d'identité externe (Auth0, Keycloak…)** : un service ou un serveur de plus pour un seul usage, avec les comptes à synchroniser.
- **Kit MCP v1 (`@modelcontextprotocol/sdk`) et ses aides de serveur d'autorisation** : gelées dans `server-legacy`, déconseillées par le kit v2.
