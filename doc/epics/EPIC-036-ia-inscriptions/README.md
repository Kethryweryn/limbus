---
id: EPIC-036
titre: Brancher une IA, lot 4 : inscriptions
statut: en cours
spec: ../../specs/SPEC-014-api-pour-ia.md
date: 2026-11-03
---

# EPIC-036 : Brancher une IA, lot 4 : inscriptions

## Objectif

Lot 4 de [SPEC-014](../../specs/SPEC-014-api-pour-ia.md) (R10 à R13), le dernier. Avec une autorisation en lecture et écriture, l'assistant prépare les périodes d'inscription, rédige le formulaire du jeu, et aide à la sélection : décisions, listes d'attente, places du vivier et tirages au sort. Rien n'est annoncé, rien ne part par email, et aucune période n'est ouverte par lui.

## Décisions

2026-11-03, choix de l'utilisatrice :

- une période créée par l'assistant est un brouillon. Il modifie toute période, brouillon, ouverte ou close (nom, sessions, places, date de clôture, réglages de sélection), mais ne change jamais son état : il ne l'ouvre, ne la clôt ni ne la remet en brouillon ;
- il décide d'une inscription (retenue, en attente, non retenue, à trier) tant que rien ne lui a été annoncé. Une inscription dont une décision a déjà été annoncée se change dans l'interface ;
- il règle aussi l'ordre des listes d'attente, les places d'une session recrutée par l'inscription permanente, et les liens du questionnaire vers les personnages, factions et intrigues (assistant de casting, [ADR-0050](../../adr/ADR-0050-relations-et-questionnaire-relie.md)).

Rappels de SPEC-014 : il n'invite personne, n'annonce rien, n'envoie ni relance ni lien, ne supprime aucune période ni inscription, et ne rattache pas les affinités (il n'en lit pas le texte).

Choix techniques :

- La création et la modification d'une période passent dans des fonctions serveur (`server/utils/registrationPeriodWrites.ts`) que la route et les outils appellent toutes deux (R12). Les autres écritures avaient déjà leur fonction commune (`applySelection`, `drawPeriod`, `cancelDraw`, `saveRegistrationFormDefinition`, `saveQuestionLinks`, `reorderWaitlist`, `setPoolSeats`).
- Version lue : celle de la période pour la période, ses listes d'attente, ses places et ses tirages ; celle de l'inscription pour une décision ; le numéro de version du formulaire pour le formulaire et ses liens.
- Un tirage qui déciderait pour une inscription déjà annoncée (remise à trier après une annonce) est refusé à l'assistant, comme la décision elle-même.
- Comme aux lots 2 et 3, un outil de modification ne reçoit que ce qui change et le complète avec l'existant.

## US

| US | Titre | Statut |
|---|---|---|
| [US-130](US-130-periodes.md) | L'assistant prépare les périodes d'inscription | terminée |
| [US-131](US-131-formulaire.md) | L'assistant rédige le formulaire et ses liens | terminée |
| [US-132](US-132-selection-et-tirages.md) | L'assistant aide à la sélection et tire au sort | terminée |
