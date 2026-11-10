---
id: US-203
titre: Tester chaque règle des inscriptions
statut: terminée
epic: EPIC-050
regles: []
adr: []
---

# US-203 : Tester chaque règle des inscriptions

En tant qu'organisatrice, je veux que les écrans des inscriptions, règle par règle aient des tests automatiques sur leurs actions, leurs erreurs de saisie, leurs droits et le hors ligne, afin qu'une régression s'y voie avant la mise en production.

## Critères d'acceptation

- [x] Chaque écran du lot a les tests listés dans la [fiche](../../archive/todo/tests-par-ecran.md), ou la raison de leur absence est notée ici.
- [x] Un défaut trouvé en écrivant un test est corrigé dans le lot, avec sa note de nouveautés : [US-220](US-220-reglages-des-inscriptions-expliques.md), [US-221](US-221-refus-hors-ligne-une-fois.md), [US-222](US-222-editeur-du-formulaire-sans-reseau.md).

## Notes techniques

Specs : SPEC-001, SPEC-015, SPEC-016, SPEC-018. Tests Playwright dans `tests/e2e/`, selon `.claude/rules/tests.md`.

## Relevé des règles sans test de bout en bout

Fait le 2026-11-10, à partir des tests existants (`registration.spec.ts`, `registrationActions.spec.ts`, `castingAssistant.spec.ts`, `casting.spec.ts`, `participantSpace.spec.ts`). Les routes sont couvertes par les tests d'intégration ; ce relevé porte sur les écrans.

| Règle | Ce qui manquait | Test |
|---|---|---|
| SPEC-018 R6 | Session sans date : ouverture impossible | 1/2 |
| SPEC-018 R8 | Session complète : « Retenir » grisé ; surnombre signalé | 1/2 |
| SPEC-018 R22, SPEC-001 R4 | Mode mixte : réglage, limite par organisatrice, tirage qui complète | 1/2 |
| SPEC-018 R23, SPEC-001 R19, R21 | Liste d'attente réordonnée ; place libre qui propose la première | 1/2 |
| SPEC-018 R24, SPEC-001 R7 | Rejoueur exclu : ni demande ni tirage, retenu à la main | 1/2 |
| SPEC-018 R20 | Personne « pas disponible » ajoutée à la main, signalée | 1/2 |
| SPEC-018 R29 | « Pas disponible » : en attente, retenue sans annonce, retenue annoncée | 1/2 |
| SPEC-018 R2, R14 | Vivier fermé : la personne modifie encore ses réponses | 1/2 |
| SPEC-018 R15 | Nouvelle question obligatoire exigée à l'enregistrement | 1/2 |
| SPEC-018 R4 | Invitation pour une session complète ou annulée | 1/2 |
| SPEC-001 R16 | Invitation déclinée | 1/2 |
| SPEC-001 R33 | Droits : co-organisatrice, organisatrice sans accès | 1/2 |
| SPEC-018 R30 | Remboursement : annulation ; report : transférée | 1/2 |
| SPEC-010 | Sélection relue hors ligne, décision refusée sans réseau | 1/2 |
| SPEC-001 R8, R9 | Éditeur du formulaire : question sans libellé, choix à une option | 2/2 |
| SPEC-015 R6, R10 | Personnages aux mêmes liens, questions en doublon | 2/2 |
| SPEC-015 R9 | Échelle tassée à une extrémité | 2/2 |
| SPEC-015 R11 | Personnages aux liens différents mais aux mêmes notes chez les inscrits | 2/2 |
| SPEC-016 R10 | Prévision identique à chaque ouverture | 2/2 |
| Droits, hors ligne | Co-organisatrice et organisatrice sans accès ; formulaire enregistré hors ligne, éditeur rouvert sans réseau | 2/2 |

## Tests

PR 1/2, `tests/e2e/registrationRules.spec.ts` (18 tests) : chaque ligne marquée 1/2 ci-dessus. Erreurs de saisie : réglage de la sélection, délai du vivier, prolongation sans date, adresse d'invitation (US-220), question obligatoire, champ vidé (lot 5). Droits : co-organisatrice qui retient, organisatrice sans accès qui ne voit ni le vivier ni sa route. Hors ligne : sélection relue, décision refusée et dite une seule fois (US-221). Les SPEC-018 R1, R3, R5, R7, R9 à R13, R16 à R19, R21, R25 à R28, R31 et SPEC-001 R11, R20, R23, R26 à R29, R32 étaient déjà testées.

PR 2/2, `tests/e2e/registrationForm.spec.ts` (7 tests) : chaque ligne marquée 2/2 ci-dessus. Les SPEC-015 R1 à R5, R7, R8, R12, R13 et SPEC-016 R1 à R9, R11, R13 étaient déjà testées (`questionnaireQuality.spec.ts`, `registration.spec.ts`). SPEC-016 R12 (consigne de relecture d'un assistant d'IA) n'a pas d'écran. Le premier test de `questionnaireQuality.spec.ts` prend les outils communs `questionnaireGame` et `questionnaireAnswers` (`tests/e2e/helpers.ts`).
