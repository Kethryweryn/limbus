---
id: US-189
titre: Faire refuser par la base les valeurs inconnues
statut: terminée
epic: EPIC-049
regles: []
adr: [ADR-0073]
---

# US-189 : Faire refuser par la base les valeurs inconnues

En tant que mainteneuse de Limbus, je veux que la base refuse une valeur hors liste (un statut, un rôle, une sorte inconnue), afin qu'une faute dans une migration ou une requête ne passe plus en silence.

## Critères d'acceptation

- [x] Chaque colonne à liste fermée (§ 2 de la fiche) est un `enum` Prisma, `Document.audiences` une liste de ce type ; les valeurs gardent leur orthographe. 28 colonnes, 26 énumérations ; les deux sortes de fichiers téléversés gardent leur valeur en base (`session-assignment-photo`), que Prisma présente sous un nom sans tiret (`sessionAssignmentPhoto`).
- [x] Avant la migration, les valeurs présentes en production sont confrontées aux listes ; aucune ligne n'est hors liste. Le relevé a fait entrer `refusedRelationTypes` (relations refusées par type, US-099), absente des listes du code.
- [x] Le code reprend les types des énumérations : signatures du serveur typées par les énumérations générées, listes de `utils/domain.ts` typées par leurs constantes (partagées avec le navigateur, et dont Prisma refuse toute valeur hors liste). Le typage a révélé trois valeurs invalides dans les tests (rôle global « organizer », rôle de session « pnj », statuts de session « withdrawn » et « invited »), corrigées.
- [x] Une écriture d'une valeur inconnue est refusée par la base.
- [x] Le build d'avant est vérifié sur une base migrée, avec son propre client Prisma : il écrit et filtre toutes les colonnes converties, mais ne sait plus lire la liste `Document.audiences`. Coupure des documents entre la migration et le redémarrage, acceptée par l'utilisatrice.

## Notes techniques

Migration `20261118090000_enumerations`, écrite à la main : Prisma générait une suppression puis un ajout de chaque colonne, qui aurait effacé ses valeurs ; chaque colonne change de type sur place (`USING … ::text::"Type"`). Les deux index uniques partiels de `SessionDocumentDelivery`, créés à la main en mai et absents du schéma, comparent `kind` à du texte : la migration les recrée sur le nouveau type. Le journal des assistants (`AiLogEntry.action`, `targetType`) reste en texte : journal sans liste fermée, vide en production.

ADR :
- [ADR-0073](../../../adr/ADR-0073-enumerations-du-schema.md)

## Tests

Intégration : `tests/integration/schema.test.ts` (type de chaque colonne, valeur hors liste refusée) ; suite complète, la conversion touchant presque tous les écrans. Bout en bout : documents, inscriptions, trombinoscopes, paiements.

Migration jouée sur une base neuve : la différence avec le schéma est vide.
