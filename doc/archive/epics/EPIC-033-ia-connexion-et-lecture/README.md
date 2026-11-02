---
id: EPIC-033
titre: Brancher une IA, lot 1 : connexion et lecture
statut: terminé
spec: ../../../specs/SPEC-014-api-pour-ia.md
date: 2026-11-02
---

# EPIC-033 : Brancher une IA, lot 1 : connexion et lecture

## Objectif

Lot 1 de [SPEC-014](../../../specs/SPEC-014-api-pour-ia.md). Une organisatrice branche son assistant d'IA (Claude, ChatGPT, Mistral…) sur les jeux qu'elle choisit, puis le suit et le retire depuis son compte. L'assistant lit ces jeux dans les limites de R7 à R9.

Les outils d'écriture viennent aux lots 2 à 4. Une autorisation « lecture et écriture » peut déjà être donnée, mais elle n'a encore que des outils de lecture.

## Décisions

- Serveur d'autorisation OAuth écrit pour Limbus ([ADR-0058](../../../adr/ADR-0058-serveur-d-autorisation-pour-les-ia.md)). Serveur MCP sans état, avec `@modelcontextprotocol/server`.
- Les outils appellent les mêmes fonctions serveur que l'interface, avec le compte de l'autorisation. L'accès aux jeux (`gameAccess`) est restreint aux jeux de l'autorisation en un seul point (R5).
- Le lot part dans une seule PR : la politique de confidentialité doit annoncer les assistants avant qu'on puisse en brancher un.

## US

| US | Titre | Statut |
|---|---|---|
| [US-121](US-121-serveur-d-autorisation.md) | Serveur d'autorisation et page « Autoriser » | terminée |
| [US-122](US-122-serveur-mcp-en-lecture.md) | Serveur MCP et outils de lecture | terminée |
| [US-123](US-123-assistants-connectes.md) | Assistants connectés, réglage de la propriétaire, journal | terminée |
| [US-124](US-124-confidentialite-et-conditions.md) | Politique de confidentialité et conditions | terminée |

## Suivi

- 2026-11-02 : déployé (PR #110). Essai réel avec Claude sur le compte de l'utilisatrice : les outils de lecture répondent sur ses jeux, sans aucune coordonnée, et un jeu non autorisé est refusé. La sélection et les tirages n'ont pas pu être essayés en production, faute de période d'inscription ; les tests d'intégration les couvrent.
- ChatGPT et Mistral : essai reporté, au choix de l'utilisatrice, jusqu'à ce qu'une organisatrice veuille s'en servir.
- Epic archivé.
