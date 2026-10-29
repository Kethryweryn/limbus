---
id: US-066
titre: Plafond de stockage par compte
statut: terminée
epic: EPIC-013
regles: [R7]
adr: [ADR-0039]
---

# US-066 : Plafond de stockage par compte

En tant qu'administratrice, je veux qu'un compte ne remplisse pas le disque du serveur.

## Critères d'acceptation

- [x] Chaque compte a un plafond, 500 Mo par défaut ; l'administratrice le change sur la page des comptes, qui montre aussi l'espace utilisé.
- [x] Les fichiers téléversés d'un jeu (photos, RIB) comptent pour la propriétaire du jeu, quelle que soit la personne qui téléverse.
- [x] Un téléversement qui dépasserait le plafond est refusé : « L'espace de stockage de la propriétaire du jeu est plein (X Mo sur Y Mo) ».
- [x] « Mon compte » montre l'espace utilisé et le plafond.
- [x] Un jeu reçu (transfert, legs) compte aussitôt pour sa nouvelle propriétaire, même au-delà du plafond : seuls les nouveaux téléversements sont bloqués.

## Notes techniques

- `User.storageQuotaMb` (500 par défaut) et `UploadedFile.size`. Les fichiers d'avant n'ont pas de taille : elle est relevée sur le disque au premier calcul, puis enregistrée.

## Tests

- Intégration : téléversement refusé au-delà du plafond, y compris par une co-organisatrice ; espace utilisé affiché dans le compte.
