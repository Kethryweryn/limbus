---
id: EPIC-059
titre: Une CSP prête à bloquer
statut: en cours
spec: ../../todo/durcissement-web.md
date: 2026-11-12
---

# EPIC-059 : Une CSP prête à bloquer

## Objectif

Suite du [durcissement web](../../todo/durcissement-web.md) : corriger les deux violations relevées en mode rapport, et faire vérifier par la suite de bout en bout qu'aucun écran n'en provoque. La CSP reste en mode rapport ; le mode bloquant viendra dans une PR à part.

## Décisions

- `'strict-dynamic'` est retiré : la page d'accueil, prérendue pour l'ouverture sans réseau, garde son fonctionnement ([ADR-0091](../../adr/ADR-0091-csp-sans-strict-dynamic.md)).
- Les icônes sont livrées avec Limbus, jamais demandées à un autre site.
- La suite de bout en bout échoue sur toute violation de CSP.

## US

| US | Titre | Statut |
|---|---|---|
| [US-250](US-250-csp-accueil-icones-et-garde-fou.md) | La page d'accueil et les icônes passent la CSP, et les tests le vérifient | terminée |

## Définition de terminé

- Toutes les US terminées ; `npm run lint`, `npm run typecheck`, `npm test` et la CI passent.
- [ADR-0091](../../adr/ADR-0091-csp-sans-strict-dynamic.md).
