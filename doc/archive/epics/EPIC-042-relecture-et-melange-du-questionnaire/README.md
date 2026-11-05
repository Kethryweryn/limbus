---
id: EPIC-042
titre: Aide à la conception du questionnaire, lot 3 : relecture et mélange
statut: terminé
spec: ../../../specs/SPEC-016-conception-du-questionnaire.md
date: 2026-11-05
---

# EPIC-042 : Aide à la conception du questionnaire, lot 3 : relecture et mélange

## Objectif

Dernier lot de [SPEC-016](../../../specs/SPEC-016-conception-du-questionnaire.md) (R11 à R13, et le mélange dans l'essai, R1). L'équipe voit les questions à relire, peut demander une relecture plus large à son assistant d'IA, et mélange l'ordre des options là où il n'a pas de sens.

Il complète [EPIC-038](../EPIC-038-essai-du-questionnaire/README.md) (essai) et [EPIC-041](../EPIC-041-prevision-du-questionnaire/README.md) (prévision), dont il ajoute aussi le test manquant du message d'échec du calcul.

## US

| US | Titre | Statut |
|---|---|---|
| [US-144](US-144-relecture-par-regles.md) | Voir les questions à relire | terminée |
| [US-145](US-145-consigne-relire-le-questionnaire.md) | Demander une relecture à mon assistant d'IA | terminée |
| [US-146](US-146-melange-des-options.md) | Mélanger l'ordre des options d'une question | terminée |

## Décisions

2026-11-05, choix de l'utilisatrice : voir l'historique de SPEC-016. Règles, consigne et mélange : [ADR-0062](../../../adr/ADR-0062-aide-a-la-conception-du-questionnaire.md).

## Définition de terminé

- Toutes les US terminées ; `npm run lint`, `npm run typecheck`, `npm test` et la CI passent.
- Spec à jour, ADR écrits pour les décisions prises.

## Suivi

- 2026-11-05 : déployé (PR #137). La revue a notamment gardé l'ordre tiré quand une option est corrigée dans l'éditeur, écarté « n° » et « pas à pas » des négations, ajouté « … » aux fins de phrase, et ajouté un test du mélange sur le formulaire réel, rendu côté serveur. SPEC-016 est entièrement livrée.
- Limites connues au déploiement :
  - la partie « Rédaction » et la case « Mélanger les options » n'ont été vues à l'écran que par Playwright, sur le build testé ;
  - la consigne « Relire le questionnaire » n'a été essayée que par un client MCP de test, pas dans un vrai assistant ;
  - le test du message d'échec de la prévision simule un Web Worker qui échoue : `page.route` n'a pas bloqué le script du vrai worker, et le refus de créer le Worker n'est pas testé.
- Epic archivé.
