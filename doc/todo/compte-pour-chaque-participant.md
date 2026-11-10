---
titre: Un compte pour chaque participant
statut: à trancher
date: 2026-11-09
---

# Un compte pour chaque participant

## Besoin

Né de la [revue du schéma de données](../archive/todo/schema-de-donnees.md) : une fiche participant n'a pas de propriétaire dans la base, elle n'est rattachée qu'à des jeux. La règle « une seule fiche par personne » ([US-185](../archive/epics/EPIC-045-retours-du-cahier-de-tests/US-185-une-fiche-par-personne.md)) ne vaut donc que dans les jeux d'une même propriétaire, et seul le code la tient. Paul, inscrit au jeu de Claire et à celui d'Anne, peut avoir deux fiches.

Pour l'utilisatrice, la fiche de Paul appartient à Paul, même s'il ne s'est jamais inscrit sur Limbus.

## Proposition

- Toute fiche participant appartient à un compte : celui de la personne. Quand une équipe crée la fiche d'une adresse qui n'a pas de compte, Limbus en pré-crée un, inactif, que la personne activera quand elle le voudra.
- Une seule fiche par compte dans tout Limbus. Chaque équipe n'en voit que ce qui concerne ses jeux (jeux, notes, casts, envois), comme aujourd'hui après US-185.
- Tant que le compte n'est pas activé, chaque équipe garde les coordonnées qu'elle a saisies (téléphone, contact d'urgence, allergies), sans les montrer aux autres équipes : la personne n'a pas consenti à ce partage. Une fois le compte activé, ses coordonnées valent pour toutes les équipes, comme aujourd'hui ([ADR-0042](../adr/ADR-0042-coordonnees-du-compte.md)).
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

## Points à trancher

- **Fiches existantes de la même personne chez plusieurs propriétaires** : la migration les fusionne en une seule, chaque équipe gardant ses jeux, ses notes et ses coordonnées ? Recommandation : oui, automatiquement.
- **Activation** : Paul s'inscrit avec son adresse (ou demande un nouveau mot de passe), confirme par le lien reçu, choisit son mot de passe et accepte les conditions. Son compte part-il vide, ou reprend-il des coordonnées saisies par une équipe ? Recommandation : vide, puisqu'aucune équipe ne doit voir ce qu'une autre a saisi ; il remplit ses coordonnées, que les équipes voient ensuite.
- **Inactivité** : un compte pré-créé échappe à l'effacement après 24 mois sans connexion ([ADR-0056](../adr/ADR-0056-durees-de-conservation.md)), puisqu'il ne s'est jamais connecté, et suit la règle « effacé sans fiche » ? Recommandation : oui.
