---
id: US-105
titre: Cookies avec le préfixe __Host-
statut: terminée
epic: EPIC-027
regles: []
adr: [ADR-0053]
---

# US-105 : Cookies avec le préfixe __Host-

En tant qu'utilisatrice, je veux que mon cookie de connexion ne puisse être posé que par Limbus, en HTTPS.

## Critères d'acceptation

- [x] Le cookie de connexion s'appelle `__Host-limbus_token`, celui du mode administratrice `__Host-limbus_admin_mode`. Ils sont `Secure`, sur `/`, sans `Domain`.
- [x] La déconnexion efface le cookie.
- [x] L'ancien cookie n'est plus lu : chacun se reconnecte une fois après le déploiement.

## Tests

- Intégration : le cookie posé à la connexion porte le préfixe et ses attributs.
