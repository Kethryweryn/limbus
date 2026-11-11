---
id: US-234
titre: Une session désignée par sa date, sans nom à saisir
statut: à faire
epic: EPIC-055
regles: [R1, R2, R3, R5, R6, R7, R8]
adr: [ADR-0083]
---

# US-234 : Une session désignée par sa date, sans nom à saisir

En tant qu'organisatrice, je veux que Limbus désigne mes sessions par leur date, sans nom à saisir, afin de ne plus inventer de nom et de les reconnaître d'un coup d'œil.

## Critères d'acceptation

- [ ] Étant donné le formulaire d'une session ou la fenêtre « Reporter », alors ils ne demandent plus de nom (R1).
- [ ] Étant donné une session d'un premier du mois, alors elle se lit « Session du 1er mai 2099 » (R1).
- [ ] Étant donné une session du 15 mai 2099, alors elle se lit « Session du 15 mai 2099 » partout où son nom apparaissait ; sans date, « Session sans date » (R1, R3).
- [ ] Étant donné deux sessions du jeu le même jour, alors chacune ajoute son heure ; à la même heure, son lieu ; sinon un numéro. Seule, une session n'a pas d'heure (R2).
- [ ] Étant donné une session déplacée à une autre date, alors son libellé et son adresse suivent, et ceux de ses anciennes voisines du même jour aussi (R2, R5).
- [ ] Étant donné une session, alors son adresse est faite du jeu et de la date (R5).
- [ ] Étant donné les sessions existantes, quand le serveur démarre, alors elles prennent leur libellé et leur adresse (R6).
- [ ] Étant donné les jeux de test rechargés, alors chaque session a une date fixe et le cahier la désigne par son libellé (R8).
- [ ] Étant donné un assistant d'IA, quand il crée ou modifie une session, alors il ne donne pas de nom et lit le libellé (R7).

## Notes techniques

- `utils/sessionLabels.ts` (libellés d'un jeu), `server/utils/sessionLabels.ts` (`refreshSessionLabels`), plugin Nitro de démarrage ; `server/utils/sessionWrites.ts`, `sessionLifecycle.ts`, outils `server/mcp/sessionWrites.ts` ; `components/SessionForm.vue` ; jeux de test (`prisma/seed/`, `doc/jeux-de-test.md`).

## Tests

De bout en bout (Playwright), sur les quatre axes (ADR-0079) :

- Actions : créer une session sans nom, lire son libellé ; deux sessions le même jour ; déplacer une session.
- Erreurs de saisie : le formulaire sans nom ; une date invalide garde son message.
- Droits : inchangés ; les routes gardent leurs tests d'isolation.
- Hors ligne : une session créée sans réseau se lit avec son libellé au retour du réseau.
