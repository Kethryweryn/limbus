---
titre: Brancher une IA sur Limbus, état de l'art
date: 2026-11-02
origine: ../todo/api-pour-ia.md
statut: à trier
---

# Brancher une IA sur Limbus : état de l'art

Étude demandée le 2 novembre 2026 pour trancher la fiche [API pour une IA](../todo/api-pour-ia.md). Elle fait le point sur les protocoles, l'authentification, la sécurité et les données personnelles, puis en tire les conséquences pour Limbus. Elle ne décide rien : les choix restent à faire avec l'utilisatrice (section 7).

Les sources sont en fin de document. Ce qui ne vient que d'une source secondaire (blog, comparatif) est signalé comme tel.

## Résumé

1. **MCP est devenu le standard.** Claude, ChatGPT et Mistral se branchent sur un serveur MCP distant. La version stable du 28 juillet 2026 rend le protocole sans état, ce qui convient au serveur unique de Limbus.
2. **L'authentification attendue est OAuth 2.1, avec Limbus comme serveur d'autorisation.** La spécification et Claude ne laissent pas de place à un jeton personnel par utilisatrice : Claude n'accepte une clé fixe que par organisation, en bêta. L'inscription des clients se fait de préférence par document de métadonnées (CIMD) ; l'inscription dynamique (DCR) reste acceptée mais est dépréciée.
3. **Le risque principal est l'injection d'instructions.** Une IA qui lit des textes écrits par d'autres (réponses aux formulaires d'inscription, contenu d'un co-organisateur), voit des données privées et peut écrire quelque chose de visible à l'extérieur réunit les trois conditions d'une fuite. Aucune parade complète n'est connue : on la limite en restreignant ce que l'IA peut lire et faire.
4. **Les données des participants ne devraient pas sortir au départ.** Les envoyer à un fournisseur d'IA crée un nouveau destinataire, choisi par l'équipe. Les allergies, données de santé, en sont exclues dans tous les cas.
5. **Pour Limbus, le travail porte surtout sur l'authentification.** Les outils réutilisent les fonctions serveur existantes. Il faut un serveur d'autorisation OAuth, une limite de débit par compte plutôt que par adresse IP, la révocation par `revokeUserSessions` et un journal des actions de l'IA.

## 1. Le paysage en novembre 2026

### Le protocole MCP

Le Model Context Protocol décrit comment un assistant découvre et appelle les outils d'un service. Sa version stable du 28 juillet 2026 change surtout :

- **Sans état** : plus de poignée de main `initialize` ni d'identifiant de session. Chaque requête porte sa version, l'identité du client et ses capacités. N'importe quelle instance du serveur peut répondre.
- **Transport** : Streamable HTTP, une simple route HTTPS (`/mcp` le plus souvent). L'ancien transport HTTP + SSE est déprécié, avec un an de transition.
- **Demandes à l'utilisateur** : la demande d'information en cours d'appel (« élicitation ») passe désormais par des allers-retours. Le serveur répond « il me faut ceci », le client rappelle avec la réponse. Cela pourrait servir à demander une confirmation, mais cela dépend du client.
- **Extensions** : les tâches longues (Tasks), les interfaces intégrées (MCP Apps), et l'autorisation gérée par l'entreprise (Enterprise Managed Authorization) deviennent des extensions facultatives.
- **Dépréciations** : Roots, Sampling et Logging ; douze mois de préavis minimum pour toute dépréciation.

Le kit de développement officiel en TypeScript est passé en version 2 (`@modelcontextprotocol/server`), avec une vérification du jeton Bearer indépendante d'Express. Côté Nuxt, le module `@nuxtjs/mcp-toolkit` découvre les outils rangés dans `server/mcp/` et sert la route `/mcp`. Sa documentation ne décrit pas d'authentification : il faudrait l'ajouter soi-même.

### Les assistants qui s'y branchent

| Assistant | Serveur MCP distant | Authentification | Remarques |
|---|---|---|---|
| Claude (web, bureau, mobile, Claude Code, Cowork) | oui, « connecteur personnalisé » | OAuth avec CIMD ou DCR ; clé fixe par organisation en bêta seulement | Retour de connexion à `https://claude.ai/api/mcp/auth_callback` ; Claude Code utilise une adresse locale. Requêtes venues de `160.79.104.0/21`. |
| ChatGPT | oui, en mode développeur | OAuth, ou sans authentification | Un outil qui n'est pas marqué en lecture seule demande une confirmation. Les plans qui permettent l'écriture diffèrent selon les sources (non vérifié). |
| Mistral (Le Chat, Work) | oui, réservé à l'administrateur de l'espace | OAuth 2.1 avec DCR, ou jeton Bearer / Basic | Fournisseur européen. |
| Gemini | pas confirmé | — | Aucune source sûre sur les connecteurs MCP distants. |

Claude, ChatGPT et Mistral appellent le serveur depuis leurs propres machines, pas depuis l'appareil de l'organisatrice.

### MCP ou API REST ?

Les deux ne s'opposent pas. Une règle revient souvent : si c'est le code qui décide quel appel faire, on utilise une API ; si c'est le modèle, on utilise MCP. En pratique, un serveur MCP enveloppe souvent des fonctions existantes : authentification, droits et limites restent au même endroit. Une API REST documentée par OpenAPI sert plutôt aux scripts et aux intégrations écrites à la main. Les agents MCP gèrent mal les gros volumes et la pagination : il vaut mieux des outils qui rendent peu de données, déjà filtrées.

Exemple : Atlassian expose son serveur MCP avec OAuth 2.1 comme voie principale. Un jeton d'API reste possible si l'administrateur l'active, mais avec moins d'outils.

## 2. Authentification

### Ce qu'exige la spécification MCP

Pour un serveur MCP distant protégé, la spécification du 28 juillet 2026 demande :

- **OAuth 2.1** pour le serveur d'autorisation, qui peut être l'application elle-même ;
- **métadonnées de la ressource protégée** (RFC 9728) : un document `/.well-known/oauth-protected-resource` qui désigne le serveur d'autorisation. Sans jeton, le serveur MCP répond 401 avec un en-tête `WWW-Authenticate` qui pointe vers ce document ;
- **métadonnées du serveur d'autorisation** (RFC 8414 ou OpenID Connect Discovery) ;
- **PKCE S256** sur chaque demande d'autorisation ;
- **jetons destinés à ce serveur seulement** : le client désigne la ressource (RFC 8707), et le serveur MCP refuse un jeton émis pour un autre. Il ne transmet jamais un jeton reçu à un autre service ;
- **jeton dans l'en-tête `Authorization: Bearer` de chaque requête**, jamais dans l'URL ;
- **paramètre `iss`** dans la réponse d'autorisation (RFC 9207) : recommandé, il deviendra obligatoire ;
- **inscription des clients** : de préférence par Client ID Metadata Document (CIMD). L'identifiant du client est alors l'URL HTTPS d'un document qu'il publie, que le serveur d'autorisation va lire. L'inscription dynamique (DCR, RFC 7591) est dépréciée mais toujours acceptée ;
- **portées minimales** : le minimum dans `scopes_supported`, puis une demande de portée supplémentaire (403 `insufficient_scope`) quand un outil en a besoin ;
- **jetons de rafraîchissement renouvelés à chaque usage** pour les clients publics, ce que sont les clients inscrits par CIMD ou DCR.

### Ce qu'attend Claude en plus

- Un **401** pour lancer la connexion : Claude ignore un `WWW-Authenticate` sur un 200.
- Claude n'utilise que le **premier** serveur d'autorisation listé.
- Pour CIMD, le serveur d'autorisation doit annoncer `client_id_metadata_document_supported: true` **et** `none` dans `token_endpoint_auth_methods_supported`. Sinon, Claude passe par DCR, qui inscrit un nouveau client à chaque connexion.
- Les points d'accès OAuth doivent répondre en moins de 10 secondes (30 pour le rafraîchissement). Le point `/token` doit lire le format `application/x-www-form-urlencoded`.
- La page de consentement doit afficher clairement l'hôte de l'adresse de retour.
- Pas d'accès machine à machine (`client_credentials`) : il y a toujours une personne qui consent.
- Une **clé fixe** (`static_headers`) existe en bêta, mais elle est saisie par le propriétaire d'une organisation et partagée par tous ses membres. Elle ne peut pas identifier une organisatrice : ce n'est pas l'équivalent d'un jeton personnel.

### Comment le faire en Node

| Voie | Pour | Contre |
|---|---|---|
| Serveur d'autorisation écrit pour Limbus, sur les comptes et le JWT actuels | Peu de code (code d'autorisation + PKCE, jeton, rafraîchissement, CIMD, page de consentement) ; s'appuie sur `requireUser`, `sessionVersion` et les règles existantes | Du code de sécurité à écrire et à tester soi-même |
| `oidc-provider` (bibliothèque Node certifiée OpenID) | Mûr, complet, éprouvé | Lourd à brancher sur les comptes existants ; CIMD à vérifier |
| Better Auth, greffons `mcp()` et `cimd()` | Suit la spécification du 28 juillet 2026, CIMD compris | Version bêta ; remplacerait toute l'authentification de Limbus |
| Kit officiel (`requireBearerAuth`) | Vérifie le jeton côté serveur MCP | Ne fournit pas le serveur d'autorisation |

## 3. Sécurité

### Les attaques décrites par la spécification

La page « Security Best Practices » de MCP décrit :

- **le délégué abusé (confused deputy)**, qui concerne un serveur MCP relais vers un service tiers. Limbus est son propre serveur d'autorisation, donc ce cas ne s'applique pas directement. Sa parade vaut quand même : un consentement par client, une page de consentement qui nomme le client, ses droits et son adresse de retour, une protection CSRF, une interdiction d'affichage dans un cadre (`frame-ancestors`), une comparaison exacte des adresses de retour et un `state` à usage unique ;
- **le relais de jeton**, interdit ;
- **le vol de session** : on n'authentifie jamais par un identifiant de session MCP. La version sans état règle la question ;
- **les portées trop larges**, à limiter.

### L'injection d'instructions

Une IA suit parfois des instructions cachées dans ce qu'elle lit. Simon Willison nomme « trifecta fatale » la réunion de trois conditions :
- l'accès à des données privées ;
- la lecture de textes écrits par un tiers ;
- un moyen de faire sortir l'information.

En mai 2025, Invariant Labs a montré l'attaque sur le serveur MCP de GitHub : un ticket piégé dans un dépôt public a amené l'agent à publier le contenu de dépôts privés. Aucun outil n'avait de défaut, et il n'existe pas de parade complète.

Dans Limbus, les trois conditions peuvent être réunies :
- **textes de tiers** : les réponses aux formulaires d'inscription, écrites par des inconnus via le lien de diffusion, et le contenu écrit par une co-organisatrice ;
- **données privées** : les fiches des participants, les intrigues secrètes ;
- **moyens de sortie** : l'envoi d'emails, la page publique d'un jeu, le legs d'un jeu à une autre équipe, et même un texte visible des joueurs.

La seule défense solide est de casser la trifecta. On peut exclure des outils de l'IA les réponses aux formulaires et les données des participants, ou exclure tout ce qui publie ou envoie.

### Les indications des outils

Un outil MCP peut se déclarer en lecture seule (`readOnlyHint`), destructeur (`destructiveHint`), idempotent ou ouvert sur l'extérieur. Ce ne sont que des indications : le client décide d'en tenir compte. ChatGPT demande une confirmation pour tout outil qui ne se dit pas en lecture seule, et la plupart des clients en demandent une avant un outil destructeur. Elles aident l'organisatrice, mais ne protègent rien : la sécurité doit rester dans les portées et les contrôles du serveur.

### Référentiels

L'OWASP prépare un « MCP Top 10 », encore en bêta, en version 2025. Les comptes de failles MCP signalées en 2026 ne viennent que de sources secondaires, non vérifiées.

## 4. Données personnelles

- La CNIL et le Conseil de l'IA et du numérique ont publié le 20 juillet 2026 une note sur l'IA agentique. Elle est exploratoire, sans valeur contraignante, et insiste sur le risque de perdre le contrôle de ses données. La CNIL n'a pas de recommandation propre à l'envoi de données vers un fournisseur d'IA ; ses recommandations sur les systèmes d'IA visent surtout leur entraînement.
- Dans Limbus, chaque équipe est responsable des données de ses joueurs, et Limbus est son sous-traitant ([SPEC-013](../specs/SPEC-013-pages-legales-et-conservation.md)). Une organisatrice qui branche une IA crée elle-même un nouveau destinataire, le fournisseur de l'IA, qui est souvent hors de l'Union. C'est à elle d'en avoir la base légale et d'en informer ses joueurs. Limbus devrait au moins le dire dans sa politique de confidentialité et ne rien exposer par défaut.
- Les allergies sont des données de santé (article 9 du RGPD) : à exclure dans tous les cas.

## 5. Conséquences pour Limbus

Ce que l'étude change à la fiche, d'après le code actuel :

- **Route** : un serveur MCP sur `/mcp`, en dehors de `/api/`. Le contrôle d'origine des écritures (`server/middleware/origin.ts`, ADR-0053) ne s'y applique pas et ne doit pas s'y appliquer : un assistant n'envoie ni `Origin` ni `Sec-Fetch-Site`. En contrepartie, `/mcp` n'accepte **que** le jeton Bearer, jamais le cookie de connexion. Sinon, n'importe quel site pourrait y écrire au nom de l'organisatrice connectée.
- **Droits** : le jeton doit mener au même compte que le cookie, pour que `requireGameAccess`, `gameScopedWhere`, la validation zod et `assertGameUploads` s'appliquent sans exception. Les outils appellent les fonctions serveur déjà là (`server/utils/sheetReads.ts`…), pas l'API HTTP.
- **Révocation** : un jeton porte la `sessionVersion` du compte, comme le JWT actuel. `revokeUserSessions` le coupe alors aussi : changement de mot de passe, déconnexion partout, compte désactivé. Une révocation propre à chaque assistant connecté s'y ajoute, depuis le compte.
- **Limite de débit** : `assertRateLimit` compte par adresse IP. Toutes les requêtes de Claude viennent de la même plage d'adresses, donc la limite doit compter par compte et par client connecté.
- **Journal** : Limbus n'a pas de journal des actions. Il en faut un pour l'IA (qui, quel assistant, quel outil, quand, quel élément), qui entre aussi dans l'export et l'effacement du compte (ADR-0043).
- **Hors ligne** : sans objet, l'IA n'est jamais hors ligne. Mais une écriture de l'IA modifie `updatedAt` : une modification hors ligne faite en même temps tombera en conflit, comme avec une co-organisatrice (ADR-0036).
- **Tests** : la route et chaque outil entrent dans `tests/integration/isolation.test.ts`. Un jeton d'Alice n'atteint rien du jeu de Bob.
- **Sans état** : convient au processus unique de Limbus, sans stockage de session à ajouter.

## 6. Options

| | A. MCP + OAuth (Limbus serveur d'autorisation) | B. MCP + jeton personnel | C. API REST + OpenAPI + jeton personnel |
|---|---|---|---|
| Claude web et bureau | oui | non : la clé fixe est partagée par une organisation, et en bêta | non |
| Claude Code, Mistral | oui | oui | à brancher à la main |
| ChatGPT | oui | non documenté | non |
| Copier un secret | non | oui | oui |
| Conforme à la spécification MCP | oui | hors spécification pour un serveur distant | sans objet |
| Travail | serveur d'autorisation, consentement, CIMD et DCR, rafraîchissement | gestion des jetons dans le compte | documentation OpenAPI de 212 routes, jetons |

**Recommandation de l'étude : A, en lecture seule d'abord.** C'est la seule voie qui marche dans Claude et ChatGPT sans copier de secret, et celle que la spécification prévoit. Le serveur d'autorisation peut rester petit si Limbus l'écrit sur ses comptes actuels. Il serait limité à :
- un seul type d'autorisation : code d'autorisation avec PKCE, plus le rafraîchissement ;
- l'inscription des clients par CIMD, avec DCR tant que Claude et Mistral en ont besoin ;
- la page de consentement.

À trancher dans un ADR, avec la comparaison de `oidc-provider`. B pourrait s'ajouter plus tard pour les scripts. C n'a d'intérêt que pour une intégration écrite à la main, et rien n'en demande aujourd'hui.

## 7. Points à trancher avec l'utilisatrice

Ils remplacent ceux de la fiche :

1. **Protocole et authentification** : MCP + OAuth (A), jeton personnel (B), ou les deux ?
2. **Serveur d'autorisation** : écrit pour Limbus, ou bibliothèque (`oidc-provider`) ? À décider dans un ADR après un essai.
3. **Droits** : lecture seule au départ, puis écriture du contenu d'un jeu demandée à part ? L'organisatrice choisit-elle les jeux accessibles à l'IA à la connexion, ou l'IA voit-elle tous ses jeux ?
4. **Ce que l'IA ne lit pas** : données des participants et réponses aux formulaires (texte de tiers et données personnelles) exclues ? Le casting a besoin au moins des noms : faut-il les exposer, et à partir de quel lot ?
5. **Ce que l'IA ne fait jamais** : envoyer un email, publier la page publique, léguer ou supprimer un jeu, partager un jeu, toucher aux paiements ?
6. **Confirmation** : une écriture de l'IA s'applique-t-elle directement (avec le journal et l'historique), ou attend-elle une validation dans Limbus ?
7. **Assistants visés** : Claude d'abord ? Faut-il tester aussi ChatGPT et Mistral ?
8. **Politique de confidentialité** : ajouter que l'organisatrice peut connecter un assistant d'IA, qu'elle en devient responsable vis-à-vis de ses joueurs, et ce que Limbus lui transmet.

## Sources

Spécification et documentation officielles :

- [Spécification MCP du 28 juillet 2026, annonce](https://blog.modelcontextprotocol.io/posts/2026-07-28/) et [publication](https://github.com/modelcontextprotocol/specification/releases/tag/2026-07-28)
- [Autorisation, spécification du 28 juillet 2026](https://modelcontextprotocol.io/specification/2026-07-28/basic/authorization)
- [Security Best Practices, spécification du 25 novembre 2025](https://modelcontextprotocol.io/specification/2025-11-25/basic/security_best_practices)
- [Journal des changements du 25 novembre 2025](https://modelcontextprotocol.io/specification/2025-11-25/changelog)
- [Claude : authentification des connecteurs](https://claude.com/docs/connectors/building/authentication)
- [OpenAI : ajouter un serveur MCP](https://developers.openai.com/api/docs/guides/custom-mcp-server.md)
- [Mistral : connecteurs MCP](https://docs.mistral.ai/le-chat/knowledge-integrations/connectors/mcp-connectors)
- [Atlassian Rovo MCP : OAuth 2.1](https://support.atlassian.com/atlassian-rovo-mcp-server/docs/configuring-oauth-2-1) et [jetons d'API](https://support.atlassian.com/atlassian-rovo-mcp-server/docs/configuring-authentication-via-api-token)
- [Nuxt MCP Toolkit](https://mcp-toolkit.nuxt.dev/getting-started/configuration) et [ses indications d'outils](https://mcp-toolkit.nuxt.dev/tools/annotations)
- [Better Auth : greffon MCP](https://better-auth.com/docs/beta/plugins/mcp) et [CIMD](https://better-auth.com/docs/beta/plugins/cimd)
- [OWASP MCP Top 10](https://owasp.org/projects/mcp-top-10)
- [CNIL : recommandations IA et RGPD](https://www.cnil.fr/fr/ia-et-rgpd-la-cnil-publie-ses-nouvelles-recommandations) ; note CNIL et Conseil de l'IA et du numérique sur l'IA agentique (20 juillet 2026), connue par [Norton Rose Fulbright](https://connections.nortonrosefulbright.com/post/102nq72/the-french-national-data-protection-authority-and-the-ai-and-digital-council-publ)

Analyses et sources secondaires :

- [Simon Willison : GitHub MCP exploited](https://simonwillison.net/2025/May/26/github-mcp-exploited) ; [DevClass](https://www.devclass.com/ai-ml/2025/05/27/researchers-warn-of-prompt-injection-vulnerability-in-github-mcp-with-no-obvious-fix/1623458)
- [WorkOS : risques de sécurité MCP](https://workos.com/blog/mcp-security-risks-best-practices)
- [MCP vs API, Tinybird](https://www.tinybird.co/blog/md/mcp-vs-apis-when-to-use-which-for-ai-agent-development)
- [Comparatif des clients MCP 2026, Drio](https://www.getdrio.com/blog/mcp-client-comparison) (Gemini)
- [Outreach : indications d'outils](https://developers.outreach.io/mcp-server/tool-annotations) ; [Appwrite, ticket 86](https://github.com/appwrite/mcp/issues/86)
- [Kit TypeScript MCP 2.0.0](https://newreleases.io/project/github/modelcontextprotocol/typescript-sdk/release/@modelcontextprotocol%2Fserver@2.0.0)
