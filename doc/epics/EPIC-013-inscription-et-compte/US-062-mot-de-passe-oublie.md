---
id: US-062
titre: Réinitialiser un mot de passe oublié
statut: à faire
epic: EPIC-013
regles: []
adr: [ADR-0039]
---

# US-062 : Réinitialiser un mot de passe oublié

En tant que personne qui a un compte, je veux choisir un nouveau mot de passe depuis un lien reçu par email, afin de retrouver l'accès sans l'administratrice.

## Critères d'acceptation

- [ ] L'écran de connexion propose « Mot de passe oublié ? » : on saisit son email, et la réponse est la même que le compte existe ou non.
- [ ] Le lien reçu est valable 1 heure et ne sert qu'une fois ; un nouveau lien remplace le précédent.
- [ ] Le nouveau mot de passe déconnecte tous les appareils, puis connecte la personne. Il confirme aussi l'adresse d'un compte qui ne l'était pas.
- [ ] Un compte désactivé ne reçoit pas de lien.
- [ ] Demandes limitées : 5 par quart d'heure et par adresse IP, 3 par email.

## Notes techniques

- `AccountToken` de type `password`. Routes publiques `POST /api/auth/password-forgotten` et `POST /api/auth/password-reset`.
- Pages `/acces/mot-de-passe-oublie` et `/acces/mot-de-passe/:token`.

## Tests

- Intégration : demande pour un compte inconnu (même réponse, pas d'email), lien reçu, réinitialisation, lien à usage unique, anciennes sessions refusées.
