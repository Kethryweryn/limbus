---
id: US-110
titre: Lire les mentions légales, la politique de confidentialité et les conditions d'utilisation
statut: terminée
epic: EPIC-029
regles: [L1, L2, L3, L4]
adr: [ADR-0055]
---

# US-110 : Lire les mentions légales, la politique de confidentialité et les conditions d'utilisation

En tant que visiteuse, joueuse ou organisatrice, je veux savoir qui édite Limbus, ce qui est fait de mes données et à quoi je m'engage.

## Critères d'acceptation

- [x] `/mentions-legales`, `/confidentialite` et `/conditions` s'ouvrent sans compte, et aussi connecté.
- [x] Elles sont liées depuis :
  - l'écran de connexion et les pages d'accès ;
  - le pied du menu ;
  - le formulaire d'inscription à un jeu ;
  - le lien personnel.
- [x] Les textes suivent SPEC-013 (L2 à L4) et portent leur date de version.

## Tests

- Bout en bout : les trois pages s'ouvrent sans compte, et l'écran de connexion y mène.
