---
id: ADR-0021
titre: L'inscription crée la participation de session, la session reste la référence
statut: accepté
date: 2026-10-27
liens: [SPEC-001, EPIC-001]
---

# ADR-0021 : L'inscription crée la participation de session, la session reste la référence

## Contexte

Une session connaît déjà ses participants : les `SessionParticipant` (rôles participant, orga, PNJ, cuisine) et les attributions de personnages. L'écran de session les remplace en bloc à chaque enregistrement (`PUT /api/sessions/:id`). Les inscriptions ajoutent une seconde source : une personne confirmée doit faire partie de la session (R22). Si les deux sources se contredisent, laquelle fait foi ?

## Décision

- **La session reste la référence** de qui participe. L'inscription est la trace du recrutement.
- La confirmation d'une inscription crée le `SessionParticipant` de rôle participant, s'il n'existe pas, dans la même transaction que le changement de statut.
- Le désistement ou le retrait d'une personne confirmée supprime ce `SessionParticipant` et vide le personnage qu'elle avait dans la session (US-006), dans la même transaction.
- Une modification manuelle de la session ne modifie pas les inscriptions. Quand une personne confirmée n'est plus participante de la session, la liste des inscriptions le signale, et l'organisatrice corrige dans un sens ou dans l'autre.
- Une personne ajoutée à la main dans la session n'a pas d'inscription : c'est le fonctionnement actuel, qui reste possible.

## Conséquences

- Aucune modification de l'écran de session ni de ses règles (`assertSessionCastRules`), dont la règle « un participant ne peut pas être PJ et PNJ en même temps ».
- Les deux sources peuvent diverger, mais la divergence est visible et sans perte : rien n'est supprimé automatiquement.
- Les fonctionnalités existantes (paiements, documents, trombinoscope) continuent de partir de la session.

## Options écartées

- **L'inscription comme seule référence**, avec une session calculée à partir des inscriptions : il faudrait réécrire l'écran de session et toutes les fonctionnalités qui en dépendent, et créer des inscriptions pour les PNJ, la cuisine et les orgas.
- **Synchronisation dans les deux sens** : chaque enregistrement de session modifierait des inscriptions, avec des effets difficiles à prévoir (un PNJ retiré passerait-il en désisté ?).
