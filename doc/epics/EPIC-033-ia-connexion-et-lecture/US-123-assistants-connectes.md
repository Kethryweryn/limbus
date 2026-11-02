---
id: US-123
titre: Assistants connectés, réglage de la propriétaire, journal
statut: à faire
epic: EPIC-033
regles: [R5, R6, R13]
adr: [ADR-0043, ADR-0058]
---

# US-123 : Assistants connectés, réglage de la propriétaire, journal

En tant qu'organisatrice, je veux voir et retirer les assistants que j'ai autorisés.

En tant que propriétaire d'un jeu partagé, je veux décider si les co-organisatrices peuvent y brancher le leur, et voir ce que font les assistants.

## Critères d'acceptation

- [ ] **Compte, « Assistants connectés ».**
  - Chaque autorisation affiche l'assistant, la date, les droits, les jeux et le dernier usage.
  - On peut changer ses jeux, ou la retirer.
  - Le journal des actions de ses assistants y est consultable.
- [ ] **Partage d'un jeu (propriétaire).**
  - Le réglage « Les co-organisatrices peuvent y brancher une IA » est désactivé par défaut.
  - On y voit les autorisations qui donnent accès au jeu, et le journal des assistants sur ce jeu.
  - Désactiver le réglage, ou retirer une co-organisatrice, coupe aussitôt l'accès de ses assistants au jeu.
- [ ] **Journal.** Il note les autorisations données, modifiées, retirées ou expirées, puis, aux lots suivants, chaque écriture. Il est gardé un an.
- [ ] **Export et effacement.**
  - L'export du compte contient ses autorisations et son journal.
  - À l'effacement du compte, ses autorisations disparaissent. Ses lignes de journal restent, sans son nom.

## Tests

- Intégration : liste, changement de jeux, retrait, réglage de la propriétaire, journal, export, effacement.
- E2E : « Assistants connectés » et le réglage dans le partage.
