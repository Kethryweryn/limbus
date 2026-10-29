---
id: US-061
titre: Créer son compte et confirmer son adresse
statut: à faire
epic: EPIC-013
regles: [R4, R5, R6]
adr: [ADR-0039]
---

# US-061 : Créer son compte et confirmer son adresse

En tant que personne qui veut organiser un GN, je veux créer mon compte moi-même, afin de ne pas dépendre de l'administratrice.

## Critères d'acceptation

- [ ] Étant donné l'inscription ouverte (`SIGNUP_OPEN=1`), l'écran de connexion propose « Créer un compte » : nom, email, mot de passe (8 caractères au moins).
- [ ] Étant donné l'inscription fermée, le lien n'apparaît pas et la route refuse (403).
- [ ] Après l'inscription, la personne reçoit un lien de confirmation, valable 48 heures. Le lien confirme l'adresse et la connecte.
- [ ] Un compte non confirmé se connecte mais ne voit qu'un écran « Confirmez votre adresse », avec « Renvoyer le lien » et « Se déconnecter » ; toute autre route lui répond 403.
- [ ] Une adresse déjà prise reçoit la même réponse qu'une adresse libre (on ne révèle pas les comptes) ; la personne reçoit un email qui l'invite à se connecter ou à réinitialiser son mot de passe.
- [ ] Contre les robots : 5 inscriptions par heure et par adresse IP ; un champ invisible rempli fait semblant de réussir sans rien créer.
- [ ] Un compte jamais confirmé est supprimé au bout de 7 jours.
- [ ] L'envoi d'emails désactivé, l'inscription est refusée avec un message clair.

## Notes techniques

- `User.emailConfirmedAt` (défaut : maintenant ; vide pour une inscription libre). `AccountToken` (empreinte, type, expiration), voir [ADR-0039](../../adr/ADR-0039-comptes-en-libre-service.md).
- Routes publiques `GET /api/auth/signup` (ouverte ou non), `POST /api/auth/signup`, `POST /api/auth/confirm` ; `POST /api/auth/resend-confirmation` pour le compte connecté non confirmé.
- Pages `/acces/inscription` et `/acces/confirmer/:token`.
- Purge des comptes non confirmés à chaque inscription et connexion.

## Tests

- Intégration : inscription fermée, inscription puis confirmation par le lien reçu, compte non confirmé refusé partout sauf `me` et renvoi, adresse prise, champ piège, limite par IP, purge à 7 jours.
