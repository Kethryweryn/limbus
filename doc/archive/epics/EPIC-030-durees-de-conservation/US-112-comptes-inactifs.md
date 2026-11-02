---
id: US-112
titre: Effacer les comptes sans connexion depuis deux ans, après un avertissement
statut: terminée
epic: EPIC-030
regles: [L6]
adr: [ADR-0056]
---

# US-112 : Effacer les comptes sans connexion depuis deux ans, après un avertissement

En tant que personne inscrite, je veux que mon compte ne soit pas gardé indéfiniment si je ne m'en sers plus. Je veux aussi être prévenue avant qu'il ne soit effacé.

## Critères d'acceptation

- [x] Le compte garde la date de sa dernière activité : sa connexion, puis son usage de l'application, au plus une fois par jour.
- [x] Après 23 mois sans activité, un email prévient que le compte sera effacé un mois plus tard, sauf s'il se connecte.
- [x] Après 24 mois, et au moins 25 jours après l'avertissement, le compte est effacé comme un effacement demandé : ses fiches sont effacées et les équipes prévenues.
- [x] Un compte qui possède encore des jeux, ou qui est la dernière administratrice, n'est pas effacé. L'administratrice en est prévenue une fois par email.
- [x] Une activité après l'avertissement l'annule.
- [x] Un compte non confirmé suit sa règle existante (7 jours).

## Tests

- Intégration : avertissement, effacement après l'avertissement, rien sans avertissement, activité qui annule, compte propriétaire gardé et signalé.
