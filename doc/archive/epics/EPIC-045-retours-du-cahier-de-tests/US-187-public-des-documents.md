---
id: US-187
titre: Choisir le public d'un document par rôles et par personnages
statut: terminée
epic: EPIC-045
regles: [R11]
adr: [ADR-0072]
---

# US-187 : Choisir le public d'un document par rôles et par personnages

En tant qu'organisatrice, je veux viser plusieurs publics à la fois pour un document, PJ compris, et y ajouter des personnages ou des groupes, afin d'envoyer chaque document aux bonnes personnes (retour B3-1 du cahier).

## Critères d'acceptation

- [x] Étant donné le formulaire d'un document, alors le public se choisit par cases : Organisateurs, PNJ, Cuisine, PJ, et « Tout le monde », qui coche les quatre (et se décoche si l'une l'est).
- [x] Étant donné la case « Sélection avancée », alors elle montre une liste de personnages et une liste des groupes du jeu, à choix multiple, qui s'ajoutent aux cases.
- [x] Dans une session, le document part aux personnes de chaque rôle coché (PNJ : rôle PNJ de l'équipe ou personnage PNJ ; PJ : personnage PJ), et à celles qui tiennent un personnage choisi ou un personnage d'un groupe choisi, chacune une fois.
- [x] Les documents existants gardent leurs destinataires : « Tout le monde » coche les quatre cases, un rôle coche sa case, et le personnage du champ « Personnage » rejoint la liste des personnages.
- [x] La liste des documents, leur fiche et l'onglet Documents d'une session disent le public ; un document sans public est signalé « non ciblé ».
- [x] Les assistants d'IA lisent et écrivent ce public.

## Notes techniques

`Document.audiences`, migration, `utils/documentAudiences.ts`, `components/DocumentForm.vue`, `server/utils/documents.ts` (destinataires), `server/utils/schemas.ts` (conversion des anciennes écritures), `server/mcp/`. [SPEC-003](../../../specs/SPEC-003-ecriture-d-un-jeu.md), R11 ; [SPEC-006](../../../specs/SPEC-006-emails-et-paiements.md), R7 ; [ADR-0072](../../../adr/ADR-0072-public-des-documents.md). Choix de l'utilisatrice le 2026-11-08 : PJ = qui tient un personnage PJ ; PNJ = rôle PNJ ou personnage PNJ ; vrais groupes seulement ; une seule liste de personnages.

## Tests

`tests/integration/documentAudiences.test.ts`, `tests/utils/documentAudiences.test.ts`, `tests/e2e/documents.spec.ts`, et `sessionDocuments`, `participantDocuments`, `seed` adaptés.
