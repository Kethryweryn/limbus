---
id: US-074
titre: Tenir ses coordonnées et ses allergies dans son compte
statut: terminée
epic: EPIC-016
regles: [R12]
adr: [ADR-0042]
---

# US-074 : Tenir ses coordonnées et ses allergies dans son compte

En tant que personne qui joue, je veux tenir à jour une seule fois mon téléphone, mon contact d'urgence et mes allergies, pour toutes les équipes.

## Critères d'acceptation

- [x] « Mon compte » a une section « Mes coordonnées » : téléphone, contact d'urgence (nom, téléphone), régime et allergies, avec le consentement santé exigé dès qu'une allergie est déclarée.
- [x] À l'enregistrement, le nom du compte, le téléphone et ces informations passent sur toutes mes fiches participant et mes inscriptions non désistées, pour les champs que chaque formulaire a demandés : chaque équipe voit la version à jour pour ses jeux (fiche, inscription, fiche allergies). Une personne du cast sans inscription figure sur la fiche allergies avec les allergies de son compte.
- [x] Une fiche rattachée plus tard reçoit aussitôt mes coordonnées, si je les ai déjà enregistrées une fois.
- [x] Répondre à une inscription depuis mon compte met aussi à jour mes coordonnées (pas par le lien personnel, qui peut avoir été transmis) ; le formulaire d'une invitation est prérempli avec elles.
- [x] Aucune équipe n'est prévenue par email.

## Notes techniques

- Colonnes `User.phone`, `emergencyContactName`, `emergencyContactPhone`, `dietary`, `healthConsentAt`, `profileUpdatedAt`. Route `PUT /api/account/profile`. Fonction `syncProfileToParticipants`.

## Tests

- Intégration : enregistrement des coordonnées, propagation aux fiches et inscriptions de deux équipes, fiche allergies à jour, consentement exigé, préremplissage, fiche rattachée après coup.
