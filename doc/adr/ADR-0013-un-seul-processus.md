---
id: ADR-0013
titre: Concurrence gérée en mémoire, dans un seul processus Node
statut: accepté
date: 2026-10-27
liens: [ADR-0003]
---

# ADR-0013 : Concurrence gérée en mémoire, dans un seul processus Node

*Rédigé a posteriori, pour des décisions prises le 2026-10-27.*

## Contexte

Plusieurs mécanismes doivent tenir compte des requêtes simultanées :

- la limitation de débit (connexion, routes publiques) ;
- les envois d'emails d'une session : un double clic ou deux onglets envoyaient deux fois aux mêmes destinataires, l'envoi n'étant noté qu'après coup ;
- les slugs : `generateUniqueSlug` lit puis écrit, si bien que deux créations simultanées du même nom calculaient le même slug, et la seconde échouait sur la contrainte d'unicité.

L'application tourne en un seul processus Node (service systemd unique, [ADR-0003](ADR-0003-service-de-production.md)).

## Décision

- **Limitation de débit** en mémoire (`assertRateLimit`), par IP client et éventuellement par clé (email…).
- **Verrou d'envoi** en mémoire par session (`withSessionSendLock`) : un deuxième envoi pendant le premier reçoit un 409. Il couvre les quatre envois de documents et l'envoi des paiements. En complément, l'envoi groupé ignore les destinataires déjà servis.
- **Slugs** : une extension Prisma (`$extends` sur `create` et `update` de tous les modèles) réessaie une fois avec un suffixe aléatoire (`-xxxx`) quand l'écriture échoue sur l'unicité du slug (`isSlugConflict`).

## Conséquences

- Aucune dépendance supplémentaire (Redis, verrous PostgreSQL) ; le comportement est simple et testé unitairement.
- Un redémarrage remet les compteurs de débit à zéro et libère les verrous.
- **Passer à plusieurs processus ou serveurs invalide les deux premiers mécanismes** : il faudrait alors un ADR pour les déplacer en base (verrou consultatif PostgreSQL, table de compteurs) ou dans un stockage partagé. Le réessai des slugs, lui, reste valable.
- Un slug obtenu par réessai porte un suffixe aléatoire au lieu du `-2` habituel.

## Options écartées

- **Verrou consultatif PostgreSQL dès maintenant** : correct en multi-processus, mais plus complexe sans besoin actuel.
- **Contrainte d'unicité gérée par une boucle de lecture plus longue** : ne supprime pas la course entre lecture et écriture.
