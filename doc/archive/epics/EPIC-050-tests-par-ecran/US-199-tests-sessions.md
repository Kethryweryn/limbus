---
id: US-199
titre: Tester chaque écran des sessions
statut: terminée
epic: EPIC-050
regles: []
adr: []
---

# US-199 : Tester chaque écran des sessions

En tant qu'organisatrice, je veux que la liste des sessions et chaque onglet d'une session aient des tests automatiques sur leurs actions, leurs erreurs de saisie, leurs droits et le hors ligne, afin qu'une régression s'y voie avant la mise en production.

## Critères d'acceptation

- [x] Chaque écran du lot a les tests listés dans la [fiche](../../todo/tests-par-ecran.md), ou la raison de leur absence est notée ici.
- [x] Un défaut trouvé en écrivant un test est corrigé dans le lot, avec sa note de nouveautés.

## Notes techniques

Specs : SPEC-004, SPEC-005, SPEC-006, SPEC-010. Tests Playwright dans `tests/e2e/`, selon `.claude/rules/tests.md`.

## Avancement

Le lot se livre en deux PR.

- **Première PR (faite)** : liste des sessions (parties à venir et passées, période, recherche, pages), carte et suppression (US-209), détails (nom vide, lieu du même jeu, statut, page publique), cast (PNJ, réglage « un seul PJ », « Aucun participant »), déroulé (responsables), droits, création hors ligne. Défaut trouvé : la carte, le bouton « Organisation » et la suppression depuis la fiche ([US-209](US-209-carte-et-fiche-d-une-session.md)) ; le formulaire de session avait le même `required` que ceux de l'écriture ([US-204](US-204-champ-obligatoire-explique.md)).
- **Seconde PR (faite)** : trombinoscopes (réglages d'un personnage, exclusion globale, étiquette d'un groupe, régénération), PDF (fiche, document, allergies), documents et envois (brouillon, test à 10 adresses au plus, envoi aux manquants, échec listé, personne sans email), fiches prêtes, paiements (valider, demande puis relance, paiement d'une personne partie, tarif de soutien, retour au tarif du rôle), présence (délai dépassé, place libérée). Défaut trouvé : des refus du serveur s'affichaient en anglais ([US-210](US-210-messages-en-francais.md)).

Non couverts ici, avec leur raison : le RIB en PDF (téléversement d'un PDF signé, couvert par les tests d'intégration : téléversement dans `content.test.ts`, droits dans `isolation.test.ts`), et la réponse « Je viens » par le lien de présence (déjà couverte par `publicPage.spec.ts` et `sessions.spec.ts`).

## Tests

- `tests/e2e/sessionScreens.spec.ts` : 7 tests (liste, carte, détails, cast, déroulé, droits, hors ligne).
- `tests/e2e/sessionDocuments.spec.ts` : 5 tests (trombinoscope, brouillon et test, envoi, fiches, PDF).
- `tests/e2e/sessionPayments.spec.ts` : 3 tests (paiement simple, tarifs, présence).
