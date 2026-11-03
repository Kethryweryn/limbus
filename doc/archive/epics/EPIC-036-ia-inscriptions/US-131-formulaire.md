---
id: US-131
titre: L'assistant rédige le formulaire et ses liens
statut: terminée
epic: EPIC-036
regles: [R4, R5, R8, R10, R11, R12, R13, R15]
adr: [ADR-0058, ADR-0045, ADR-0050]
---

# US-131 : L'assistant rédige le formulaire et ses liens

En tant qu'organisatrice, je veux que mon assistant rédige le formulaire d'inscription de mon jeu et le relie au casting, afin de préparer les questions avec lui.

## Critères d'acceptation

- [x] L'assistant lit le formulaire en vigueur : champs demandés, affinités, question d'équilibre, questions propres au jeu, et les liens du questionnaire.
- [x] Il enregistre une nouvelle version du formulaire en donnant le numéro de version lu : seules les parties données changent (champs demandés, affinités, équilibre, liste des questions). Une question garde son identifiant ; en changer la sorte en fait une autre ([ADR-0045](../../../adr/ADR-0045-questions-et-affinites-du-formulaire.md)).
- [x] Il relie une réponse à un personnage, une faction ou une intrigue du jeu : les liens des questions données sont remplacés, les autres restent.
- [x] Un numéro de version dépassé est refusé. Un lien vers un élément d'un autre jeu, ou vers une question ou une option qui n'existe pas, est refusé.
- [x] Une autorisation en lecture seule n'a pas ces outils, et le serveur refuse quand même l'écriture.
- [x] Chaque écriture est notée au journal.

## Tests

- Intégration : nouvelle version partielle, question gardée et ajoutée, version dépassée, liens d'une question remplacés et autres gardés, lien vers un autre jeu, lecture seule, journal.
