---
id: US-136
titre: Les questions qui ne départagent pas et les échelles tassées
statut: à faire
epic: EPIC-039
regles: [R2, R7, R8, R9]
adr: [ADR-0061, ADR-0063]
---

# US-136 : Les questions qui ne départagent pas et les échelles tassées

En tant qu'organisatrice, je veux savoir quelles questions reçoivent presque toutes la même réponse, afin de les reformuler.

## Critères d'acceptation

- [ ] Une personne compte une fois, par sa dernière inscription au jeu qui contient des réponses, quels que soient la période et le statut.
- [ ] Seules les questions reliées à un rôle sont jugées. Une réponse à une option qui n'existe plus n'est pas comptée, et le détail dit combien sont laissées de côté.
- [ ] Une réponse choisie par 8 personnes sur 10 ou plus est « à revoir » si la borne basse de Wilson atteint 0,8, « à confirmer » sinon. La phrase donne les comptes.
- [ ] Pour un choix multiple, la règle s'applique à chaque option, et le détail donne la part de chaque option. Pour un choix unique ou une échelle, le détail donne l'entropie normalisée.
- [ ] Une extrémité d'échelle au-dessus de 20 % est « à revoir » si la borne basse de Wilson dépasse 20 %, « à confirmer » sinon. Le détail donne la dispersion de Leik. Une note déjà signalée par la règle des 8 sur 10 ne l'est pas deux fois.

## Notes techniques

- `utils/statistics.ts` pour les fonctions statistiques, `answerFindings` dans `utils/questionnaireQuality.ts`.
- La route rend aussi le nombre de personnes qui ont répondu.

## Tests

- Unitaires : valeurs de référence de Wilson, entropie, Leik ; niveaux selon l'effectif ; option retirée ; échelle bien répartie non signalée.
- Intégration : deux inscriptions d'une même personne comptent une fois ; une question sans lien n'est pas jugée.
- Bout en bout : un repère sur les réponses s'affiche dans l'encadré.
