---
id: ADR-0049
titre: Affinités rattachées à une fiche participant, suggestions et alertes calculées à la lecture
statut: accepté
date: 2026-11-01
liens: [../specs/SPEC-001-inscriptions.md, ADR-0045-questions-et-affinites-du-formulaire.md, ADR-0047-selection-des-inscriptions.md, ADR-0011-donnees-des-participants.md]
---

# ADR-0049 : Affinités rattachées à une fiche participant, suggestions et alertes calculées à la lecture

## Contexte

[SPEC-001](../specs/SPEC-001-inscriptions.md), lot 4 (R23 à R25). Depuis [ADR-0045](ADR-0045-questions-et-affinites-du-formulaire.md), chaque ligne d'affinité est une `RegistrationAffinity` (sorte, texte, position), remplacée à chaque réponse. L'équipe doit rapprocher ces lignes des personnes du jeu, et la sélection doit signaler les personnes qui ne veulent pas se croiser.

Choix de l'utilisatrice : on rattache à n'importe quelle personne du jeu ; Limbus propose, sans rattacher seul ; une ligne peut être marquée « inconnue » ; « ne pas croiser » et « ne pas jouer avec » alertent, cast compris ; l'alerte prévient sans bloquer et le tirage l'ignore ; « veut jouer avec » donne un repère ; l'export ne contient que les affinités écrites par la personne.

## Décision

- **Cible** : `RegistrationAffinity.targetParticipantId` (fiche participant liée au jeu de la période, autre que la personne elle-même) et `targetUnknown` (la ligne ne vise personne du jeu). Seules les sortes qui désignent une personne se rattachent : `wantWith`, `notWith`, `avoid` ; `refusedRelations` reste du texte. La clé étrangère est en cascade : effacer une fiche supprime les lignes qui la visent (SPEC-001, données personnelles).
- **Rattacher** : `POST /api/registration-affinities/:id/link` (`{ targetParticipantId }` ou `{ unknown: true }`, ou rien pour détacher). C'est une action, jamais mise en file hors ligne. Le rattachement ne se voit que de l'équipe : les vues de la personne lisent le texte seul.
- **Nouvelle réponse** : les lignes sont toujours remplacées, mais une ligne de même sorte et de même texte (sans tenir compte de la casse ni des espaces autour) reprend la cible de l'ancienne.
- **Suggestions** : calculées à la lecture du détail d'une inscription (`utils/affinityMatching.ts`), sur le nom des fiches du jeu. Noms comparés sans accents, casse ni ponctuation : nom identique, puis noms dont chaque mot de l'un commence un mot de l'autre (« Paul D. » et « Paul Durand »), puis distance d'édition. Trois au plus, au-dessus d'un seuil ; aucune n'est appliquée seule.
- **Présence dans une session** : une personne est dans une session si une de ses inscriptions (toutes périodes du jeu) y est retenue ou confirmée, ou si elle en est participante (`SessionParticipant`, cast compris).
- **Alertes** : pour chaque session de la sélection, une alerte par ligne `avoid` ou `notWith` d'une inscription retenue ou confirmée dans la session, dont la cible y est présente. Calculées par `selectionOverview` à chaque lecture : rien n'est stocké, une décision n'est jamais refusée pour une alerte, et le tirage ne les lit pas.
- **Repères** : pour chaque inscription de la période, ses lignes `wantWith` rattachées, avec les sessions de la sélection où la cible est présente.
- **Données personnelles** : `exportParticipantData` ajoute aux affinités de la personne le nom de la fiche rattachée ; les lignes des autres qui la visent n'y figurent pas.

## Conséquences

- Une alerte suit la situation présente : elle disparaît dès qu'une des deux personnes quitte la session ou que la ligne est détachée.
- Une personne retirée du jeu reste la cible des lignes déjà rattachées ; le choix d'une nouvelle cible se limite aux fiches du jeu.
- Les suggestions comparent chaque ligne à toutes les fiches du jeu à chaque lecture du détail : suffisant pour quelques centaines de fiches.

## Options écartées

- **Rattacher seul un nom identique** : écarté par l'utilisatrice, deux personnes peuvent porter le même nom.
- **Bloquer ou faire confirmer une décision qui crée une alerte** : écarté, l'alerte prévient seulement.
- **Un tirage qui évite les alertes** : écarté, le tirage reste un pur hasard (ADR-0048).
- **Exporter les lignes qui visent la personne, sans auteur** : écarté, pour ne rien dévoiler.
