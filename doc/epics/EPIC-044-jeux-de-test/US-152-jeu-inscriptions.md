---
id: US-152
titre: Essayer les inscriptions sur Station Meridian
statut: à faire
epic: EPIC-044
regles: []
adr: [ADR-0066]
---

# US-152 : Essayer les inscriptions sur Station Meridian

En tant qu'utilisatrice, je veux un jeu en pleine période d'inscription, afin d'essayer tout le parcours avant les sessions.

## Critères d'acceptation

- [ ] Étant donné le jeu, alors sa page publique est ouverte, avec ses sessions et le lien d'inscription, et ses deux sessions sont à venir (environ J+45 et J+80).
- [ ] Étant donné les périodes, alors on trouve au moins : une ouverte à sélection à la main, une fermée dont le tirage est fait, et une en préparation.
- [ ] Étant donné le formulaire, alors il a plusieurs versions et propose les champs standards, les affinités, la question d'équilibre et des questions propres au jeu.
- [ ] Étant donné les inscriptions, alors chaque statut est représenté : invitée, reçue, retenue, en attente, non retenue, confirmée et retirée, avec des décisions annoncées et d'autres encore à annoncer.
- [ ] Étant donné le tirage, alors son résultat s'affiche, peut être annulé, et une liste d'attente ordonnée existe.
- [ ] Étant donné le vivier, alors il a des places et des disponibilités par session.
- [ ] Étant donné les affinités, alors il y en a de rattachées, d'inconnues et d'incompatibles, qui déclenchent les alertes de la sélection.
- [ ] Étant donné les relations et les liens du questionnaire, alors l'assistant de casting propose une distribution.
- [ ] Étant donné le questionnaire, alors il y a assez de réponses pour que les repères de qualité et l'estimation générale s'affichent, et il contient des défauts à repérer : question à relire, option peu choisie, proportions attendues à comparer.
- [ ] Étant donné Inès, Camille et Lucie, alors chacune y voit ce que son rôle permet, et une décision non annoncée reste invisible côté personne (ADR-0047).

## Notes techniques

Le nombre de réponses dépend des seuils d'ADR-0063 et d'ADR-0064 : il sera relevé à l'implémentation. Il faudra donc des inscriptions de personnes supplémentaires, générées et toutes en `example.test`.

La définition du formulaire doit passer `registrationFormDefinitionSchema`, et le tirage doit venir du vrai calcul (`utils/registrationDraw.ts`), pas d'un résultat écrit à la main. Un formulaire public non confirmé n'est pas préparé : il s'essaie par le lien du jeu, depuis une adresse de test.

## Tests

Test d'intégration : lecture de la sélection, du tirage, de la qualité du questionnaire et de l'assistant de casting ; chaque statut présent ; schéma du formulaire valide.
