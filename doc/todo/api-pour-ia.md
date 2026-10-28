---
titre: API pour qu'une IA organise un jeu au nom d'une organisatrice
statut: à trancher
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

- l'accès est révocable à tout moment depuis le compte, et une déconnexion partout le coupe aussi ;
- les actions faites par l'IA sont tracées (qui, quand, quoi) ;
- les règles de sécurité existantes s'appliquent telles quelles (isolation par jeu, validation zod, fichiers du même jeu) ;
- les actions irréversibles ou qui sortent de Limbus (envoi d'emails aux participants, suppression d'un jeu, legs, données personnelles) sont exclues au départ, ou demandent une confirmation dans l'interface.

## Découpage envisagé

1. Choix du protocole et du mode d'authentification (ADR).
2. Lecture seule : jeux, personnages, factions, intrigues, objets, documents, chronologie, lieux, sessions.
3. Écriture du contenu d'un jeu (création, modification, liens).
4. Sessions et casting.
5. Le reste, au cas par cas.

## Points à trancher

- MCP, REST + OpenAPI, ou les deux ? Recommandation : MCP d'abord, c'est ce que les assistants savent utiliser directement ; il peut s'appuyer sur les mêmes fonctions serveur qu'une future API REST.
- Authentification : OAuth (recommandé par la spécification MCP pour un serveur distant) ou jetons personnels ? Recommandation : OAuth, pour que l'organisatrice autorise l'accès depuis Limbus sans copier de secret.
- Quels droits par défaut : lecture seule, ou lecture et écriture du contenu ? Recommandation : l'organisatrice choisit à l'autorisation ; lecture seule par défaut.
- Les données personnelles des participants (emails, téléphones, allergies) sont-elles accessibles à l'IA ? Recommandation : non au départ, pour ne pas les envoyer à un service tiers sans base légale claire.
- Faut-il une limite de débit propre aux accès par IA ? Recommandation : oui, distincte de celle de l'interface.
