---
id: US-078
titre: Garder une copie de ce qui est envoyé
statut: terminée
epic: EPIC-018
regles: [R7, R14]
adr: [ADR-0044]
---

# US-078 : Garder une copie de ce qui est envoyé

En tant que personne qui reçoit des documents, je veux que Limbus garde ce qu'on m'a envoyé, afin de le relire exactement tel que je l'ai reçu, même si l'équipe l'a modifié depuis.

## Critères d'acceptation

- [x] Un envoi réussi d'un document, d'une fiche personnage, d'un trombinoscope, ou de la fiche et du trombinoscope ensemble, garde une copie de chaque PDF joint et de ce qui se lit dans la page.
- [x] La copie est gardée pour toute personne, avec ou sans compte.
- [x] Un renvoi d'une version à jour remplace la copie précédente.
- [x] Un email de test ne garde rien.
- [x] Les copies comptent dans l'espace de la propriétaire du jeu ; un envoi part même si cet espace est plein.
- [x] Effacer une personne efface aussi les copies de trombinoscope des sessions où figurait sa photo ; l'export d'une personne contient le texte des copies de ses documents et fiches.

## Notes techniques

- `SessionDocumentDelivery` : `copyPdf` (Bytes), `copyContent` (Json), `copySize` (Int). `SessionTrombinoscope.contentJson` : les cartes du trombinoscope généré.
- `storageUsedBytes` et `storageUsedBytesByOwner` ajoutent `copySize`.

## Tests

- Intégration : copie gardée à l'envoi et remplacée au renvoi, contenu de la copie inchangé après modification du document, espace de la propriétaire augmenté.
- Unitaires : contenu d'une copie de document, de fiche, de trombinoscope.
