---
id: US-130
titre: L'assistant prépare les périodes d'inscription
statut: terminée
epic: EPIC-036
regles: [R4, R5, R10, R11, R12, R13, R15]
adr: [ADR-0058, ADR-0046, ADR-0047]
---

# US-130 : L'assistant prépare les périodes d'inscription

En tant qu'organisatrice, je veux que mon assistant prépare les périodes d'inscription de mes jeux, afin de n'avoir plus qu'à les relire et les ouvrir.

## Critères d'acceptation

- [x] Avec une autorisation en lecture et écriture, l'assistant crée une période d'un jeu de l'autorisation : nom, portée (sessions ou inscription permanente), mode d'entrée (invitation ou formulaire), sessions et places, date de clôture, délai de réponse, rejoueurs, mode de sélection et réglages du tirage, taille des listes d'attente. Elle est en brouillon.
- [x] Il modifie une période, brouillon, ouverte ou close, en donnant la version lue : seuls les champs donnés changent. Son état ne change jamais.
- [x] Les règles de l'interface s'appliquent : sessions du même jeu, une seule inscription permanente ouverte, tirage réservé aux périodes ordinaires en mode formulaire…
- [x] Il n'ouvre, ne clôt ni ne supprime une période, n'invite personne et ne diffuse aucun lien.
- [x] Une autorisation en lecture seule n'a pas ces outils, et le serveur refuse quand même l'écriture.
- [x] Chaque écriture est notée au journal.
- [x] La création et la modification d'une période dans l'interface gardent leur comportement : elles appellent les mêmes fonctions serveur.

## Tests

- Intégration : création (brouillon), modification partielle d'une période ouverte (état gardé), session d'un autre jeu, version dépassée, lecture seule, journal, tests existants des routes inchangés.
