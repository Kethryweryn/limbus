---
id: ADR-0014
titre: Connexion sans énumération des comptes, emails en minuscules
statut: accepté
date: 2026-10-27
liens: [ADR-0006, ADR-0013]
---

# ADR-0014 : Connexion sans énumération des comptes, emails en minuscules

*Rédigé a posteriori, pour des décisions prises le 2026-10-27.*

## Contexte

- Un mauvais mot de passe renvoyait 200 avec `{ success: false }` : l'écran de connexion, qui n'affiche l'erreur que si la requête échoue, ne montrait rien.
- Le temps de réponse différait selon que l'email existait ou non (bcrypt n'était calculé que pour un compte existant), ce qui permettait de découvrir les comptes.
- Les emails étaient comparés tels que saisis : `Alice@…` et `alice@…` étaient deux comptes possibles, et une connexion échouait selon la casse.

## Décision

- Email inconnu et mauvais mot de passe donnent la même réponse : 401 « Email ou mot de passe incorrect ».
- Le mot de passe est toujours comparé avec bcrypt, contre un hash factice (`DUMMY_PASSWORD_HASH`) quand le compte n'existe pas : le temps de réponse ne révèle rien.
- La connexion est limitée à 30 tentatives par IP et 10 par email sur 15 minutes ([ADR-0013](ADR-0013-un-seul-processus.md)).
- Les emails de compte sont mis en minuscules à la validation (`accountEmail()`, et `loginSchema`), à la création comme à la connexion.

## Conséquences

- L'utilisateur voit enfin l'erreur, sans qu'elle indique si le compte existe.
- Les comptes créés avant la normalisation avec des majuscules doivent être corrigés en base s'il y en a.

## Options écartées

- **Messages distincts (« compte inconnu » / « mauvais mot de passe »)** : plus pratiques, mais révèlent les comptes.
- **Colonne `citext` en base** : équivalente, mais la normalisation à la validation suffit et reste visible dans le code.
