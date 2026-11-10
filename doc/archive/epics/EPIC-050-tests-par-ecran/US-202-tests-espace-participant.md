---
id: US-202
titre: Tester l'espace « Je participe », le lien public d'inscription et les assistants
statut: terminée
epic: EPIC-050
regles: []
adr: []
---

# US-202 : Tester l'espace « Je participe », le lien public d'inscription et les assistants

En tant qu'organisatrice, je veux que l'espace « Je participe », le lien public d'inscription et les assistants d'IA aient des tests automatiques sur leurs actions, leurs erreurs de saisie, leurs droits et le hors ligne, afin qu'une régression s'y voie avant la mise en production.

## Critères d'acceptation

- [x] Chaque écran du lot a les tests listés dans la [fiche](../../todo/tests-par-ecran.md), ou la raison de leur absence est notée ici.
- [x] Un défaut trouvé en écrivant un test est corrigé dans le lot, avec sa note de nouveautés : [US-217](US-217-derniers-ecrans-sans-reseau.md), [US-218](US-218-inscription-sans-reseau.md), [US-219](US-219-bandeau-hors-ligne.md).

## Notes techniques

Specs : SPEC-011, SPEC-014, SPEC-018. Tests Playwright dans `tests/e2e/`, selon `.claude/rules/tests.md`.

## Tests

`tests/e2e/participantSpace.spec.ts` :

- **Lien public d'inscription (`/i/…`)** : formulaire vide puis adresse invalide refusés avec leurs messages, sans rien enregistrer ; vivier fermé sans formulaire, lien inconnu invalide ; personne connectée, coordonnées du compte et adresse verrouillée, reçue sans email, puis le jeu dans « Je participe » ; hors ligne, envoi refusé et dit. Le formulaire complet par une personne sans compte était déjà testé (`registration.spec.ts`). Droits : page publique, sans objet.
- **« Je participe »** : l'inscription s'ouvre, refuse un champ obligatoire vidé, puis s'enregistre ; l'inscription et le document d'une autre personne sont introuvables (droits) ; hors ligne, la liste et un document déjà lus se relisent, l'inscription dit qu'elle demande le réseau ; une panne du serveur et un lien personnel sans réseau ne disent plus « introuvable » ni « Lien invalide » (US-218). Le document reçu qui s'ouvre était déjà testé (`participate.spec.ts`).
- **Assistants d'IA** : une co-organisatrice ne propose un jeu partagé que si la propriétaire l'ouvre, et le compte montre ensuite le jeu fermé sans le proposer (SPEC-014, R5) ; refuser renvoie un refus à l'assistant, demande inconnue expirée ; les jeux d'un assistant se changent depuis le compte ; hors ligne, « Autoriser » est refusé et le dit, et le bandeau dit ce qui attend la connexion (US-219). Le retrait d'un assistant était déjà testé (`aiAssistants.spec.ts`). Erreurs de saisie : la page n'a que des cases et des choix, sans objet.
- **Autres écrans passés au message clair (US-217)** : réglage des assistants d'un jeu refusé hors ligne, sans partir au retour du réseau ; retrait d'un assistant du compte refusé hors ligne ; document et événement jamais lus sur l'appareil ; acceptation des conditions et renvoi du lien de confirmation sans réseau. L'écran de connexion disait déjà « Serveur indisponible. » sans réseau, et son test existe (`auth.spec.ts`).

`tests/e2e/helpers.ts` : `authorizationRequest` et `captureCallback`, partagés avec `aiAssistants.spec.ts`, dont l'assistant prend un nom propre au test (revue de la PR #197).

Temps ajouté à la suite : 18 tests, environ 45 secondes sur un navigateur.
