---
id: ADR-0006
titre: JWT de référence en cookie, révocation par version de session
statut: accepté
date: 2026-10-27
liens: [ADR-0007, ADR-0014]
---

# ADR-0006 : JWT de référence en cookie, révocation par version de session

*Rédigé a posteriori, pour une décision prise le 2026-10-27.*

## Contexte

L'authentification repose sur un JWT signé (HS256), valable 20 heures. Un JWT ne peut pas être retiré une fois émis : un mot de passe changé ou un appareil perdu laissait les sessions ouvertes jusqu'à leur expiration. Le rôle et l'email lus dans le jeton pouvaient aussi être périmés.

## Décision

- Le jeton ne porte que l'identifiant de l'utilisateur (`id`) et une version de session (`v`). Il est posé dans le cookie `limbus_token` : `httpOnly`, `secure`, `sameSite=lax`.
- À chaque requête, `requireAuthUser` relit l'utilisateur en base (rôle, email) et compare `v` à `User.sessionVersion`. Un écart vaut 401 ; un jeton sans version compte pour 0.
- `revokeUserSessions(userId)` incrémente `sessionVersion` : tous les jetons déjà émis cessent de valoir. Elle est appelée par « Déconnecter tous mes appareils » (`POST /api/auth/logout-all`), par le changement de mot de passe dans l'administration, et par `scripts/create-user.ts` quand il réinitialise un mot de passe.

## Conséquences

- Une requête authentifiée coûte une lecture en base ; c'est déjà le cas pour relire le rôle, et le volume est faible.
- La révocation est globale par utilisateur : on ne peut pas fermer un seul appareil parmi d'autres.
- Changer le rôle d'un compte ou le supprimer prend effet immédiatement, sans attendre l'expiration du jeton.

## Options écartées

- **Liste noire de jetons** : il faut stocker chaque jeton révoqué jusqu'à son expiration ; une version par utilisateur suffit au besoin.
- **Sessions stockées en base** : permettrait la révocation par appareil, au prix d'une table et d'un nettoyage ; pas de besoin identifié.
- **Jetons courts et jeton de rafraîchissement** : plus de complexité côté client, notamment avec le mode hors ligne.
