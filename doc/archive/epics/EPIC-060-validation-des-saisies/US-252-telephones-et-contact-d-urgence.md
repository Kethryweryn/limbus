---
id: US-252
titre: Des téléphones vérifiés selon leur pays, et un contact d'urgence complet
statut: terminée
epic: EPIC-060
regles: [R4, R5, R6, R7, R8, R11, R12]
adr: [ADR-0092]
---

# US-252 : Des téléphones vérifiés selon leur pays, et un contact d'urgence complet

En tant qu'organisatrice, je veux des numéros de téléphone justes, rangés sous une seule forme, et un contact d'urgence toujours complet, afin de pouvoir joindre quelqu'un le jour du jeu.

## Critères d'acceptation

- [x] Étant donné l'une de ces saisies, quand je l'enregistre, alors elle est rangée sous la forme « +33612345678 » :
  - « 06 12 34 56 78 » ;
  - « 06.12.34.56.78 » ;
  - « 06-12-34-56-78 » ;
  - « +33 (0)6 12 34 56 78 » ;
  - « 0033612345678 ».
- [x] Étant donné « +32 470 12 34 56 », quand je l'enregistre, alors il est rangé sous la forme « +32470123456 ».
- [x] Étant donné « 12 », « bonjour » ou « 06 12 34 », quand je l'enregistre, alors « Numéro de téléphone invalide » s'affiche sous le champ.
- [x] Le téléphone s'affiche et s'exporte sous sa forme rangée, y compris dans le lien « appeler ».
- [x] Chaque téléphone de R7 suit ces règles : compte, fiche participant, questionnaire, contact d'urgence. Les outils des assistants d'IA aussi.
- [x] Étant donné, dans Mon compte, un nom de contact d'urgence sans téléphone, ou un téléphone sans nom, quand j'enregistre, alors le message s'affiche sous le champ vide.
- [x] Un contact d'urgence à moitié rempli est refusé par chaque écriture : compte, questionnaire, outils des assistants (R8).
- [x] La migration range au format les téléphones qu'elle reconnaît (ADR-0092) et laisse les autres tels quels.

## Notes techniques

- La vérification passe par `libphonenumber-js/max`, sur le serveur seulement.
- Les règles s'appellent `phone` et `emergencyContact`, dans `server/utils/fieldRules.ts`.
- La migration SQL ne fait que des `UPDATE`. Elle ne casse donc pas le build encore en service pendant le déploiement (ADR-0024).

## Tests

De bout en bout (Playwright) :

- **Actions :** un numéro français écrit avec des points et un numéro belge s'enregistrent, puis se relisent au format rangé. Écrans : Mon compte, fiche participant, questionnaire.
- **Erreurs de saisie :**
  - un numéro invalide est refusé, avec le message sous le champ ;
  - un contact d'urgence à moitié rempli est refusé, avec le message sous le champ vide.
- **Droits :** sans objet, car la règle ne change aucun droit.
- **Hors ligne :** un téléphone invalide saisi hors ligne sur une fiche participant est refusé au retour du réseau, avec le message.

Tests unitaires : `phone`, avec les formes acceptées, les refus et le format rangé.

Tests d'intégration :

- les routes de R7 ;
- les outils des assistants ;
- la migration, sur une valeur de chaque forme, « +33 (0)6… » compris.

### Tests écrits

- `tests/e2e/phones.spec.ts` :
  - Mes coordonnées : numéro invalide, contact d'urgence à moitié rempli, numéros rangés et relus ;
  - fiche participant : numéro invalide, numéro belge ;
  - questionnaire public ;
  - refus d'une modification faite hors ligne.
- `tests/integration/phones.test.ts` :
  - fiche participant, création et modification ;
  - numéro ancien gardé tant qu'il ne change pas (R12) ;
  - Mes coordonnées et contact d'urgence complet (R8) ;
  - fonction de la migration, sur chaque forme.
- Tests unitaires :
  - `tests/server/fieldRules.test.ts` (`normalizePhone`, `requiredPhone`, `optionalPhone`, `enteredPhone`, `assertChangedPhone`, `refineEmergencyContact`) ;
  - `tests/server/registrationForms.test.ts`.

### Notes

- Limbus n'a pas de lien « appeler » : le numéro s'affiche sous sa forme rangée, sans autre changement d'affichage.

### Revue de la PR #255

- Export CSV : le téléphone est écrit `="+33612345678"`, pour qu'Excel le garde en texte, au lieu de le lire comme le nombre 33612345678 (`csvPhone`, choix de l'utilisatrice). L'exception pour les téléphones dans la neutralisation des formules disparaît.
- `fieldError` est partagé dans `tests/e2e/helpers.ts`.
- Hors ligne, la fiche montre le numéro tel qu'il a été tapé jusqu'au retour du réseau, comme toute modification faite hors ligne. C'est un choix de l'utilisatrice : le mettre au format sur l'écran enverrait les métadonnées de la bibliothèque à chaque appareil (ADR-0092).
- Les outils des assistants d'IA n'écrivent pas de téléphone : `modifier_participant` renvoie celui de la fiche, gardé tel quel s'il ne change pas.
- Le questionnaire demande toujours le contact d'urgence en entier (US-181). R8 s'ajoute donc dans Mes coordonnées.
- Les jeux de test et les tests existants sont passés au format international. Les numéros fictifs « 07 00… », qui n'existent pas dans le plan français, sont remplacés par des numéros valides.
