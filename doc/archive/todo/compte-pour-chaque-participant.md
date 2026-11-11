---
titre: Un compte pour chaque participant
statut: archivée
date: 2026-11-09
---

# Un compte pour chaque participant

Devenue [SPEC-022](../../specs/SPEC-022-compte-pour-chaque-participant.md).

## Besoin

Né de la [revue du schéma de données](schema-de-donnees.md) : une fiche participant n'a pas de propriétaire dans la base, elle n'est rattachée qu'à des jeux. La règle « une seule fiche par personne » ([US-185](../epics/EPIC-045-retours-du-cahier-de-tests/US-185-une-fiche-par-personne.md)) ne vaut donc que dans les jeux d'une même propriétaire, et seul le code la tient. Paul, inscrit au jeu de Claire et à celui d'Anne, peut avoir deux fiches.

Pour l'utilisatrice, la fiche de Paul appartient à Paul, même s'il ne s'est jamais inscrit sur Limbus.

## Proposition

- Toute fiche participant appartient à un compte : celui de la personne. Quand une équipe crée la fiche d'une adresse qui n'a pas de compte, Limbus en pré-crée un, inactif, que la personne activera quand elle le voudra.
- Une seule fiche par compte dans tout Limbus. Chaque équipe n'en voit que ce qui concerne ses jeux (jeux, notes, casts, envois), comme aujourd'hui après US-185.
- Tant que le compte n'est pas activé, chaque équipe garde les coordonnées qu'elle a saisies (téléphone, contact d'urgence, allergies), sans les montrer aux autres équipes : la personne n'a pas consenti à ce partage. Une fois le compte activé, ses coordonnées valent pour toutes les équipes, comme aujourd'hui ([ADR-0042](../../adr/ADR-0042-coordonnees-du-compte.md)).
- L'email devient obligatoire sur une fiche, puisqu'il porte le compte.
- Aucun email n'est envoyé à la création du compte pré-créé : la personne reçoit déjà ceux des équipes. Un compte jamais activé disparaît quand plus aucune équipe ne le suit. La politique de confidentialité le dit.

## Découpage envisagé

À préciser dans la spec : compte pré-créé et activation ; une fiche par compte, avec la fusion des fiches existantes ; coordonnées par équipe avant l'activation.

## Décisions

Tranchées par l'utilisatrice le 2026-11-09 :

- La fiche appartient à la personne, par un compte pré-créé, inactif jusqu'à ce qu'elle l'active.
- Une seule fiche par personne dans tout Limbus, chaque équipe ne voyant que ses jeux, ses notes et ses casts.
- Avant l'activation, chaque équipe garde ses propres coordonnées.
- Email obligatoire ; les fiches sans email existantes sont signalées à leur équipe.
- Pas d'email à la création du compte ; un compte jamais activé est effacé quand plus aucune fiche ne le relie à une équipe.

Tranchées par l'utilisatrice le 2026-11-11 :

- Les fiches existantes d'une même adresse chez plusieurs propriétaires sont fusionnées automatiquement par la migration ; chaque équipe garde ses jeux, ses notes, ses casts et les coordonnées qu'elle avait saisies.
- À l'activation, le compte part vide : la personne remplit elle-même ses coordonnées, que ses équipes voient ensuite. Aucune équipe ne voit ce qu'une autre a saisi.
- Tant que la personne n'a pas rempli un champ de ses coordonnées (téléphone, contact d'urgence, allergies), chaque équipe garde le sien ; un champ rempli par la personne remplace celui de toutes ses équipes ([ADR-0042](../../adr/ADR-0042-coordonnees-du-compte.md)). Rien ne se perd à l'activation, en particulier les allergies.
- Un compte jamais activé échappe à l'effacement après 24 mois sans connexion ([ADR-0056](../../adr/ADR-0056-durees-de-conservation.md)) : il n'est effacé que quand plus aucune fiche ne le relie à une équipe. Une fois activé, il suit la règle normale.

## Points à trancher

Aucun : la fiche est prête pour sa spec.
