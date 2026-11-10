---
id: US-219
titre: Lire dans le bandeau hors ligne ce qui attend le réseau
statut: terminée
epic: EPIC-050
regles: []
adr: []
---

# US-219 : Lire dans le bandeau hors ligne ce qui attend le réseau

En tant que personne qui utilise Limbus sans réseau, je veux que le bandeau du haut dise ce qui est gardé sur l'appareil et ce qui attend le réseau, afin de ne pas croire enregistrée une action qui ne l'est pas (défaut trouvé en écrivant les tests de l'US-202).

## Critères d'acceptation

- [x] Étant donné l'application sans connexion au serveur, alors le bandeau dit que les modifications des fiches sont gardées sur l'appareil et partiront quand la connexion reviendra, et que les envois et les autres actions attendent la connexion.

## Notes techniques

Choix de l'utilisatrice le 2026-11-10 : préciser le bandeau. Le texte est dans `app.vue`.

## Tests

`tests/e2e/participantSpace.spec.ts` : texte du bandeau après une action refusée sans réseau.
