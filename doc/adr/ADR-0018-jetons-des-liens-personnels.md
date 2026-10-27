---
id: ADR-0018
titre: Liens personnels des inscrits par jeton aléatoire stocké hashé
statut: proposé
date: 2026-10-27
liens: [SPEC-001, EPIC-001, ADR-0013]
---

# ADR-0018 : Liens personnels des inscrits par jeton aléatoire stocké hashé

## Contexte

Les inscrits n'ont pas de compte ([SPEC-001](../specs/SPEC-001-inscriptions.md)). Leur lien personnel donne accès à leurs coordonnées, à leur contact d'urgence et à leurs allergies, et permet de modifier leur inscription. Il circule par email, et peut finir dans un historique de navigateur ou un journal de proxy. Les invitations d'organisateurs existantes (`GameInvitation`) stockent leur jeton en clair.

## Décision

- Le jeton est fait de 32 octets aléatoires (`randomBytes`), encodés en base64url dans l'URL `/inscription/<jeton>`.
- Seul son SHA-256 est stocké (`Registration.tokenHash`, unique). Une requête calcule le hash du jeton reçu et cherche l'inscription par ce hash. Un hash sans sel suffit : le jeton est aléatoire et long, donc impossible à deviner.
- Renvoyer une invitation, libérer une place ou supprimer l'inscription remplace ou efface le hash : l'ancien lien cesse de fonctionner.
- Après un désistement, le lien ne permet plus rien. Après la date de la dernière session de la période d'inscription plus 30 jours, il cesse aussi de fonctionner.
- Les routes publiques répondent de la même façon à un jeton inconnu et à un jeton invalidé, et sont soumises à une limitation de débit par IP.
- La page du lien envoie `Referrer-Policy: no-referrer`, pour que le jeton ne fuite pas vers un site tiers par un lien cliqué.

## Conséquences

- Une fuite de la base ne donne pas accès aux liens personnels.
- Le lien ne peut pas être réaffiché à l'organisatrice : pour le redonner, elle renvoie l'invitation, ce qui crée un nouveau jeton.
- Les jetons de `GameInvitation` restent en clair ; les aligner sur cette règle est une évolution à part.

## Options écartées

- **Jeton en clair** : comme `GameInvitation`, mais une fuite de la base ouvrirait toutes les inscriptions.
- **Lien magique à usage unique et session courte** : plus sûr, mais l'utilisateur a écarté les liens magiques, et un lien réutilisable est plus simple pour des personnes qui reviennent modifier leur inscription.
- **JWT signé contenant l'identifiant** : ne peut pas être révoqué individuellement sans état en base.
