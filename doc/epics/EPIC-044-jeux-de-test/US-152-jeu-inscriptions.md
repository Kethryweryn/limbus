---
id: US-152
titre: Essayer les inscriptions sur Station Meridian
statut: terminée
epic: EPIC-044
regles: []
adr: [ADR-0066]
---

# US-152 : Essayer les inscriptions sur Station Meridian

En tant qu'utilisatrice, je veux un jeu en pleine période d'inscription, afin d'essayer tout le parcours avant les sessions.

## Critères d'acceptation

- [x] Étant donné le jeu, alors sa page publique est ouverte, avec ses sessions et le lien d'inscription, sa présentation dit clairement que c'est un jeu d'essai, et ses deux sessions sont à venir (environ J+45 et J+80).
- [x] Étant donné les périodes, alors on trouve au moins : une ouverte par formulaire à sélection à la main, une sur invitation, une fermée dont le tirage est fait, une en mode mixte, une inscription permanente à l'échelle du jeu, et une en préparation.
- [x] Étant donné la période ouverte par formulaire, alors l'équipe n'est pas prévenue de chaque inscription, pour qu'une inscription extérieure n'envoie rien.
- [x] Étant donné la politique des rejoueurs, alors une période signale une personne ayant déjà joué, qui a joué la session terminée de Station Meridian : la règle ne regarde que le même jeu.
- [x] Étant donné le formulaire, alors il a plusieurs versions et propose les champs standards, les affinités, la question d'équilibre et des questions propres au jeu.
- [x] Étant donné les inscriptions, alors chaque statut est représenté : invitée, reçue, retenue, en attente, non retenue, confirmée et retirée, avec des décisions annoncées et d'autres encore à annoncer.
- [x] Étant donné le tirage, alors son résultat s'affiche, peut être annulé, et une liste d'attente ordonnée existe.
- [x] Étant donné le vivier, alors il a des places et des disponibilités par session.
- [x] Étant donné les affinités, alors il y en a de rattachées, d'inconnues et d'incompatibles, qui déclenchent les alertes de la sélection.
- [x] Étant donné les relations et les liens du questionnaire, alors l'assistant de casting propose une distribution.
- [x] Étant donné le questionnaire, alors il y a assez de réponses pour que les repères de qualité et l'estimation générale s'affichent, et il contient des défauts à repérer : question à relire, option peu choisie, proportions attendues à comparer.
- [x] Étant donné Inès, Camille et Lucie, alors chacune y voit ce que son rôle permet, et une décision non annoncée reste invisible côté personne (ADR-0047).

## Notes techniques

Le nombre de réponses dépend des seuils d'ADR-0063 et d'ADR-0064 : il sera relevé à l'implémentation. Il faudra donc des inscriptions de personnes supplémentaires, générées et toutes en `example.test`.

La définition du formulaire doit passer `registrationFormDefinitionSchema`, et le tirage doit venir du vrai calcul (`utils/registrationDraw.ts`), pas d'un résultat écrit à la main. Un formulaire public non confirmé n'est pas préparé : il s'essaie par le lien du jeu, depuis une adresse de test.

## Tests

`tests/integration/seed.test.ts` : page publique, chaque sorte de période et chaque statut, schéma du formulaire, sélection avec alerte et rejoueuse, tirage annulé, qualité du questionnaire, assistant de casting, et vue de Camille et de Lucie.
