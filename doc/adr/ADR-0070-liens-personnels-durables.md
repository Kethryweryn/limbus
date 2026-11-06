---
id: ADR-0070
titre: Plusieurs liens personnels valides pour une personne du vivier
statut: proposé
date: 2026-11-06
liens: [../specs/SPEC-018-vivier-permanent.md, ADR-0018-jetons-des-liens-personnels.md, ADR-0047-selection-des-inscriptions.md, ADR-0069-vivier-unique-et-statut-par-session.md]
---

# ADR-0070 : Plusieurs liens personnels valides pour une personne du vivier

## Contexte

Le jeton du lien personnel n'est gardé que sous forme de hash (ADR-0018) : on ne peut pas renvoyer le même, et chaque nouvel email le remplace (ADR-0047). Avec le vivier, une même personne reçoit des demandes pour plusieurs sessions sur une longue durée. Les liens de ses anciens emails cesseraient de marcher à chaque envoi, ce que refuse [SPEC-018](../specs/SPEC-018-vivier-permanent.md) (R13). De plus, ADR-0018 fait expirer le lien 30 jours après la dernière session de la période, ce qui n'a plus de sens sans fin de période.

## Décision

- Une table `RegistrationLink` (inscription, `tokenHash` unique, date de création) remplace `Registration.tokenHash`. Chaque email qui contient un lien en crée un.
- Tous les liens d'une personne restent valides. Quand l'équipe envoie un nouveau lien à sa demande, tous les anciens sont effacés. Effacer l'inscription les efface aussi.
- Quitter le vivier efface tous ses liens ; revenir passe par le formulaire (R5).
- Une expiration remplace la règle des 30 jours : un lien cesse de marcher quand la durée de conservation de l'inscription est atteinte, et la purge l'efface.
- Ouvrir un lien n'écrit jamais rien : les réponses se font par POST depuis la page, pour ne pas laisser un logiciel qui ouvre les liens d'un email répondre à la place de la personne (ADR-0046).
- Le reste d'ADR-0018 est inchangé : 32 octets aléatoires, SHA-256, même réponse pour un lien inconnu ou invalidé, limite de débit, `Referrer-Policy: no-referrer`.

## Conséquences

- Un email ancien, transféré ou retrouvé donne accès aux coordonnées de la personne tant que l'équipe n'a pas renouvelé le lien. C'est le prix d'un lien qui ne meurt pas ; la personne peut le demander.
- Le nombre de lignes croît avec les envois, ce qui reste faible et est borné par la conservation.

## Options écartées

- **Remplacer le lien à chaque email (l'existant)** : les boutons d'un email précédent mèneraient à une page d'erreur, à la première relance.
- **Un seul jeton réversible, chiffré en base** : une fuite de la base et de la clé donnerait tous les liens, contraire à ADR-0018.
- **Un jeton signé sans stockage** : il ne pourrait pas être révoqué sans liste à part.
