---
titre: API pour qu'une IA organise un jeu au nom d'une organisatrice
statut: archivée
spec: ../../specs/SPEC-014-api-pour-ia.md
revue: ../../revues/2026-11-02-api-pour-ia.md
date: 2026-10-29
---

# API pour qu'une IA organise un jeu au nom d'une organisatrice

## Besoin

Une organisatrice veut pouvoir confier à une IA (Claude ou un autre assistant) une partie du travail sur son jeu : créer ou relire des personnages, relier intrigues et factions, préparer le casting d'une session, vérifier la cohérence de la chronologie… Aujourd'hui, l'API de Limbus est pensée pour l'interface web : authentification par cookie, routes nombreuses et peu décrites, aucune documentation exploitable par une machine. Une IA ne peut donc pas s'y brancher simplement, ni en toute sécurité.

## Proposition

Exposer les fonctionnalités de Limbus à une IA, après connexion de l'organisatrice, avec exactement ses droits : l'IA ne voit et ne modifie que les jeux auxquels l'organisatrice a accès, comme dans l'interface.

Pistes, à départager :

- **Serveur MCP** (Model Context Protocol), le standard actuel pour brancher un assistant sur un outil : Limbus décrit des outils (« lister les personnages », « créer une intrigue »…) qu'un client MCP comme Claude découvre et appelle. L'organisatrice autorise l'accès par OAuth, sans donner son mot de passe à l'IA.
- **API REST documentée** (OpenAPI), avec des jetons d'accès personnels créés et révoqués par l'organisatrice. Utilisable par n'importe quel outil, mais l'IA doit être configurée à la main.

Dans les deux cas :

- l'accès est révocable à tout moment depuis le compte, et une déconnexion partout ou un changement de mot de passe le coupe aussi : les jetons de l'IA doivent donc être révoqués par `revokeUserSessions`, qui aujourd'hui n'invalide que les cookies de session ;
- les actions faites par l'IA sont tracées (qui, quand, quoi) ;
- les règles de sécurité existantes s'appliquent telles quelles (isolation par jeu, validation zod, fichiers du même jeu) ;
- les actions irréversibles ou qui sortent de Limbus (envoi d'emails aux participants, suppression d'un jeu, legs, données personnelles) sont exclues au départ, ou demandent une confirmation dans l'interface.

## Découpage envisagé

1. Choix du protocole et du mode d'authentification (ADR).
2. Lecture seule : jeux, personnages, factions, intrigues, objets, documents, chronologie, lieux, sessions.
3. Écriture du contenu d'un jeu (création, modification, liens).
4. Sessions et casting.
5. Le reste, au cas par cas.

## Suivi

- 2026-11-02 : état de l'art fait ([revue du 2026-11-02](../../revues/2026-11-02-api-pour-ia.md)). La revue recommande MCP avec OAuth, Limbus étant son propre serveur d'autorisation, en lecture seule d'abord. Elle reformule les points à trancher (section 7) ; ceux ci-dessous restent jusqu'aux choix de l'utilisatrice.

## Décisions

2026-11-02, choix de l'utilisatrice après l'[état de l'art](../../revues/2026-11-02-api-pour-ia.md) :

- **Connexion** : serveur MCP avec OAuth. Dans son assistant, l'organisatrice ajoute Limbus, puis autorise l'accès sur une page de Limbus, sans rien copier. Pas de clé personnelle pour l'instant.
- **Droits** : lecture et écriture dès le premier lot. À l'autorisation, l'organisatrice choisit entre lecture seule et lecture et écriture.
- **Jeux** : l'IA ne voit que les jeux cochés à l'autorisation. L'organisatrice change ce choix depuis son compte.
- **Ce que l'IA ne lit pas** : les coordonnées des participants (emails, téléphones, contacts d'urgence) et tout champ libre d'un formulaire d'inscription, écrit par un tiers. Les allergies sont exclues dans tous les cas. L'IA voit les noms des participants et les notes d'organisation.
- **Réponses aux formulaires, pour le casting** (précisé le 2026-11-02) : l'IA lit les réponses fermées, c'est-à-dire les choix, les échelles et les relations refusées cochées. Elle ne lit jamais une question à texte libre. Elle voit les affinités (avec qui jouer ou ne pas jouer, qui éviter) seulement une fois que l'équipe les a traitées : une ligne rattachée à une personne du jeu apparaît comme ce lien, jamais avec le texte tapé par la personne. Une ligne non traitée n'apparaît pas.
- **Ce que l'IA ne fait jamais** : envoyer un email, publier la page publique, partager ou léguer un jeu, supprimer un jeu ou une session, toucher aux paiements (validation, tarifs, RIB).
- **Écritures** : appliquées tout de suite, et inscrites dans un journal (assistant, action, élément, date) que l'organisatrice consulte.
- **Assistants à vérifier** : Claude (web, ordinateur, Claude Code), ChatGPT et Mistral.
- **Serveur d'autorisation** : un essai écrit pour Limbus et un essai avec `oidc-provider`, comparés dans un ADR ; l'utilisatrice tranche.
- **Politique de confidentialité** : elle dit qu'une organisatrice peut brancher une IA, qui reçoit alors les données de ses jeux, noms des participants et notes compris. C'est un changement de fond : nouvelle `TERMS_VERSION`, chaque compte accepte de nouveau.

Devenue [SPEC-014](../../specs/SPEC-014-api-pour-ia.md), avec les choix précisés le 2026-11-02 ; fiche archivée.

## Questions d'origine

Posées à la création de la fiche, avec leurs recommandations d'alors. Elles sont tranchées : en cas d'écart, la section Décisions fait foi.

- MCP, REST + OpenAPI, ou les deux ? Recommandation : MCP d'abord, c'est ce que les assistants savent utiliser directement ; il peut s'appuyer sur les mêmes fonctions serveur qu'une future API REST.
- Authentification : OAuth (recommandé par la spécification MCP pour un serveur distant) ou jetons personnels ? Recommandation : OAuth, pour que l'organisatrice autorise l'accès depuis Limbus sans copier de secret.
- Quels droits par défaut : lecture seule, ou lecture et écriture du contenu ? Recommandation : l'organisatrice choisit à l'autorisation ; lecture seule par défaut.
- Les données personnelles des participants (emails, téléphones, allergies) sont-elles accessibles à l'IA ? Recommandation : non au départ, pour ne pas les envoyer à un service tiers sans base légale claire. Le lot 4 (casting) en dépend : il a au moins besoin du nom des participants. Il faut donc décider avant ce lot quels champs le casting expose (par exemple le nom seul).
- Faut-il une limite de débit propre aux accès par IA ? Recommandation : oui, distincte de celle de l'interface.
