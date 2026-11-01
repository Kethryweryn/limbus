---
id: US-111
titre: Accepter les conditions d'utilisation
statut: terminée
epic: EPIC-029
regles: [L5]
adr: [ADR-0055]
---

# US-111 : Accepter les conditions d'utilisation

En tant qu'éditeur de Limbus, je veux que chaque compte ait accepté la version en cours des conditions d'utilisation.

## Critères d'acceptation

- [x] L'inscription libre et le choix du mot de passe depuis un lien reçu demandent de cocher « J'accepte les conditions d'utilisation », avec un lien vers elles. Le serveur refuse sans cette case.
- [x] Le compte garde la version acceptée et sa date.
- [x] Après connexion, un compte qui n'a pas accepté la version en cours voit un écran qui la lui demande avant de continuer. Les pages légales restent lisibles.
- [x] L'export du compte contient la version acceptée et sa date.

## Tests

- Intégration : inscription refusée sans la case ; acceptation enregistrée ; `auth/me` dit si la version en cours est acceptée.
- Bout en bout : l'écran d'acceptation, puis l'application.
