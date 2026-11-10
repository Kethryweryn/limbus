---
id: US-203
titre: Tester chaque règle des inscriptions
statut: en cours
epic: EPIC-050
regles: []
adr: []
---

# US-203 : Tester chaque règle des inscriptions

En tant qu'organisatrice, je veux que les écrans des inscriptions, règle par règle aient des tests automatiques sur leurs actions, leurs erreurs de saisie, leurs droits et le hors ligne, afin qu'une régression s'y voie avant la mise en production.

## Critères d'acceptation

- [ ] Chaque écran du lot a les tests listés dans la [fiche](../../archive/todo/tests-par-ecran.md), ou la raison de leur absence est notée ici.
- [ ] Un défaut trouvé en écrivant un test est corrigé dans le lot, avec sa note de nouveautés.

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
| SPEC-015, SPEC-016 | Formulaire et qualité du questionnaire | 2/2 |

## Tests

PR 1/2, `tests/e2e/registrationRules.spec.ts` (18 tests) : chaque ligne marquée 1/2 ci-dessus. Erreurs de saisie : réglage de la sélection, délai du vivier, prolongation sans date, adresse d'invitation (US-220), question obligatoire, champ vidé (lot 5). Droits : co-organisatrice qui retient, organisatrice sans accès qui ne voit ni le vivier ni sa route. Hors ligne : sélection relue, décision refusée et dite une seule fois (US-221). Les SPEC-018 R1, R3, R5, R7, R9 à R13, R16 à R19, R21, R25 à R28, R31 et SPEC-001 R11, R20, R23, R26 à R29, R32 étaient déjà testées.

PR 2/2 : à compléter.
