---
id: US-028
titre: Signaler les trombinoscopes périmés et bloquer leur envoi
statut: à faire
epic: EPIC-005
regles: [R10]
adr: [ADR-0030]
---

# US-028 : Signaler les trombinoscopes périmés et bloquer leur envoi

En tant qu'organisatrice, je veux savoir quand les trombinoscopes d'une session ne correspondent plus au casting, aux photos ou aux réglages, afin de ne pas envoyer une version fausse.

## Critères d'acceptation

- [ ] Un trombinoscope est périmé quand ce qu'il afficherait aujourd'hui diffère de ce qu'il affiche : casting, photo, réglage, nom ou faction affichée ([ADR-0030](../../adr/ADR-0030-empreinte-d-un-trombinoscope.md)).
- [ ] Le tableau des documents de la session affiche un seul avertissement quand des trombinoscopes sont périmés, avec leur nombre, et invite à les générer à nouveau.
- [ ] Tant qu'un trombinoscope à envoyer est périmé, « Envoyer trombinoscopes seuls » et « Envoyer fiches et trombinoscopes » sont désactivés, et le serveur refuse l'envoi (409).
- [ ] Un trombinoscope déjà envoyé qui devient périmé porte le badge « Trombi envoyé, périmé ». Il ne bloque pas les autres envois ; son renvoi relève de [SPEC-006](../../specs/SPEC-006-emails-et-paiements.md).
- [ ] Générer à nouveau rend les trombinoscopes à jour.

## Notes techniques

- Colonne `SessionTrombinoscope.sourceHash String?` : ajout seul ([ADR-0024](../../adr/ADR-0024-migrations-compatibles-avec-le-build-en-service.md)).
- Contenu des entrées calculé par une seule fonction, partagée par la génération et le calcul de l'empreinte (`server/utils/trombinoscopes.ts`).
- `getSessionDocumentDashboard` ajoute `trombinoscopeOutdated` à chaque fiche ; `markTrombinoscopeDeliveries` et `markCharacterSheetBundleDeliveries` refusent l'envoi.

## Tests

- Unitaires (`tests/server/trombinoscopes.test.ts`) : empreinte stable, changée par une photo, un nom ou un réglage.
- Intégration (`trombinoscopes.test.ts`) : périmé après un changement de casting ou de photo, envoi refusé (409), de nouveau à jour après génération.
