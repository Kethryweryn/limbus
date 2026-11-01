---
id: US-093
titre: Tirer au sort, avec pondérations et équilibre
statut: terminée
epic: EPIC-022
regles: [R4, R7, R17, R18, R19]
adr: [ADR-0048]
---

# US-093 : Tirer au sort, avec pondérations et équilibre

En tant qu'organisatrice, je veux lancer le tirage des inscriptions reçues, afin de remplir les places restantes équitablement.

## Critères d'acceptation

- [x] « Tirer au sort » range les inscriptions reçues : retenues, en attente (dans la limite de la taille réglée), non retenues ; rien n'est envoyé.
- [x] Le tirage va session par session, parmi les personnes disponibles pas encore placées, sur les places restantes.
- [x] Les rejoueurs exclus ne sont pas tirés.
- [x] « Non tirés avant » double les chances d'une personne non retenue ou restée en attente lors d'une autre période du jeu.
- [x] Avec l'équilibre, les places sont réservées par valeur au prorata des PJ ; « peu importe » comble la valeur la plus libre ; une valeur sans assez de candidates laisse ses places libres.
- [x] La même graine et les mêmes inscriptions donnent le même résultat.

## Notes techniques

- `utils/registrationDraw.ts` (calcul pur), `POST /api/registration-periods/:id/draws`.

## Tests

- Unitaires : reproductibilité, poids, réserves par valeur, liste d'attente limitée.
- Intégration : tirage d'une période à deux sessions, rejoueur exclu.
