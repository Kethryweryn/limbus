---
id: US-063
titre: Gérer son compte : nom, email, mot de passe
statut: terminée
epic: EPIC-013
regles: []
adr: [ADR-0039]
---

# US-063 : Gérer son compte : nom, email, mot de passe

En tant que personne qui a un compte, je veux changer mon nom, mon email et mon mot de passe moi-même.

## Critères d'acceptation

- [x] Une page « Mon compte », dans le menu, montre le nom, l'email, l'espace de stockage utilisé et le plafond.
- [x] Le nom se change directement.
- [x] Le changement d'email demande le mot de passe ; la nouvelle adresse reçoit un lien de confirmation (48 heures). L'email ne change qu'à la confirmation, si l'adresse est encore libre ; l'ancienne adresse reçoit alors un message.
- [x] Le changement de mot de passe demande l'ancien ; les autres appareils sont déconnectés, celui-ci reste connecté.

## Notes techniques

- `AccountToken` de type `email` (porte la nouvelle adresse). Routes `GET`/`PUT /api/account`, `POST /api/account/email`, `PUT /api/account/password`. Page `/compte`.

## Tests

- Intégration : changement de nom, d'email (mot de passe exigé, confirmation, ancienne adresse prévenue, adresse prise entre-temps), de mot de passe (ancien exigé, autres sessions refusées).
