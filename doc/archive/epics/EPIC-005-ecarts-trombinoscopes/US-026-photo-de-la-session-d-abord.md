---
id: US-026
titre: La photo de la personne qui joue le rôle passe avant la photo par défaut
statut: terminée
epic: EPIC-005
regles: [R8]
adr: []
---

# US-026 : La photo de la personne qui joue le rôle passe avant la photo par défaut

En tant qu'organisatrice, je veux que le trombinoscope montre le visage de la personne qui joue chaque rôle dans la session, afin que les joueuses et joueurs se reconnaissent sur le terrain.

## Critères d'acceptation

- [x] Une entrée affiche la photo de l'attribution du personnage regardé dans la session quand elle existe.
- [x] Sans photo d'attribution, elle affiche la photo par défaut du personnage.
- [x] Sans l'une ni l'autre, l'entrée compte comme photo manquante, comme avant.
- [x] « Visage caché » et « visage inconnu » l'emportent toujours sur les deux photos.

## Notes techniques

- Ordre inversé dans `server/utils/trombinoscopes.ts` (choix de la photo d'une entrée).

## Tests

- Unitaires (`tests/server/trombinoscopes.test.ts`) : photo d'attribution prioritaire, photo par défaut en repli, photo manquante, visage caché.
