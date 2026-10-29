---
id: US-077
titre: Effacer son compte, équipes prévenues
statut: terminée
epic: EPIC-017
regles: [R13]
adr: [ADR-0043]
---

# US-077 : Effacer son compte, équipes prévenues

En tant que personne qui a un compte, je veux effacer mon compte et tout ce que les équipes savent de moi, sans passer par elles.

## Critères d'acceptation

- [x] « Mon compte » propose « Effacer mon compte » : le mot de passe est demandé, et la page dit ce qui va disparaître.
- [x] Refusé tant que la personne possède un jeu (« transférez ou supprimez vos jeux d'abord »), ou si c'est la dernière administratrice active.
- [x] L'effacement est immédiat : le compte, ses coordonnées, ses partages, ses liens et toutes ses fiches participant (inscriptions, photos, paiements, notes des équipes) disparaissent ; la personne est déconnectée.
- [x] Chaque équipe d'un jeu où figurait une de ses fiches (propriétaire et co-organisatrices) reçoit un email : la personne a effacé ses données, ses places sont libérées (sessions citées), et les paiements reçus (montant par session) sont à régler à la main.
- [x] Une copie léguée en attente dont elle était l'autrice est supprimée avec ses fichiers.

## Notes techniques

- `POST /api/account/delete` (mot de passe). Utilise `eraseParticipant` pour chaque fiche.

## Tests

- Intégration : refus avec un jeu possédé, mot de passe exigé, effacement des fiches de deux équipes, emails reçus par chaque équipe avec sessions et montants, compte et jeton refusés ensuite.
