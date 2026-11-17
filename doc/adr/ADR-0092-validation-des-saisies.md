---
id: ADR-0092
titre: Règles de saisie partagées, téléphones par libphonenumber-js
statut: accepté
date: 2026-11-17
liens: [../specs/SPEC-023-validation-des-saisies.md]
---

# ADR-0092 : Règles de saisie partagées, téléphones par libphonenumber-js

## Contexte

[SPEC-023](../specs/SPEC-023-validation-des-saisies.md) ajoute des règles sur les noms de personnes, les téléphones, le contact d'urgence et la longueur des textes. Ces règles valent pour les routes de l'application et pour les outils des assistants d'IA (`server/mcp/`), qui ont leurs propres schémas.

Aujourd'hui :

- `server/utils/schemas.ts` écrit ses champs au cas par cas (`optionalText`, `requiredText`), sans plafond pour la plupart ;
- les réponses au questionnaire passent par `server/utils/registrationForms.ts` ;
- l'écran affiche les refus du serveur. `apiFieldErrors` sait déjà les ranger par champ, mais peu de formulaires s'en servent.

Pour vérifier un téléphone selon son pays (R4), il faut connaître le plan de numérotation de chaque pays. Une expression régulière faite main n'y suffit pas.

## Décision

1. **Des briques de champ uniques**, dans un module serveur (`server/utils/fieldRules.ts`), que réutilisent `schemas.ts`, `registrationForms.ts` et les schémas de `server/mcp/` :
   - `personName` (R1) : `/^(?=.*\p{L})[\p{L}\p{M} '’.-]+$/u` après réduction des espaces : au moins une lettre, à n'importe quelle place (« 't Hooft ») et 100 caractères au plus ;
   - `phone` (R4 à R6) ;
   - `emergencyContact` (R8), un `superRefine` posé sur l'objet qui porte les deux champs, qui range son message sous le champ vide ;
   - `email` (R10) ;
   - `text(type)`, avec le barème de R9 rangé en constantes : `TEXT_MAX.personName`, `title`, `short`, `long` et `background`.

   Le message d'un plafond se construit d'une seule façon : « Le nom : 200 caractères au plus ».
2. **Téléphones** : la bibliothèque `libphonenumber-js` (licence MIT, sans dépendance), dans sa version `max`, qui valide le numéro selon le plan de chaque pays et pas seulement sa longueur. Pays par défaut : `FR`.
   - La saisie passe par `parsePhoneNumberFromString(value, 'FR')` puis `isValid()`. Elle est rangée par `.number`, au format E.164.
   - Le « (0) » d'un « +33 (0)6… » est retiré avant l'analyse.
   - La bibliothèque ne sert qu'au serveur : aucune métadonnée n'est envoyée dans le code des pages.
3. **Affichage sous le champ** : chaque formulaire concerné lit `apiFieldErrors` et passe le message à l'`error` de son `UFormField`. Le message reste aussi sous le bouton, pour un champ qui n'est pas à l'écran.
4. **Téléphones déjà en base (R12)** : une migration SQL, sans bibliothèque. Elle retire d'abord un « (0) » placé après un indicatif, puis les espaces, points, tirets et parenthèses. Elle ne réécrit ensuite que les formes sûres :
   - un numéro de 10 chiffres commençant par 0 (sauf 00) devient +33 suivi des 9 derniers chiffres ;
   - un numéro commençant par 0033 devient +33 suivi du reste ;
   - un numéro commençant par + et suivi de 8 à 15 chiffres est gardé, sans ses séparateurs.

   Toute autre valeur est laissée telle quelle.

## Conséquences

- Un seul endroit à changer pour une règle : les routes, le questionnaire et les assistants ne divergent plus.
- La version `max` des métadonnées pèse environ 145 ko, chargés par le serveur seul. Il faut la tenir à jour, car les plans de numérotation évoluent : Dependabot s'en charge.
- Un numéro rangé par la migration n'a pas été validé selon son pays. Il le sera à la prochaine modification du champ.
- Une écriture faite hors ligne et refusée au retour du réseau affiche son refus comme les autres (R11).

## Options écartées

- **Une expression régulière faite main pour les téléphones** : elle n'aurait vérifié que la forme, et l'utilisatrice veut une vérification selon le pays.
- **La version `min` des métadonnées** : plus légère, mais elle ne valide que la longueur. Elle laisserait passer des numéros impossibles.
- **Vérifier aussi sur l'écran avec la bibliothèque** : il faudrait envoyer les métadonnées à chaque appareil, alors que le message du serveur suffit et s'affiche sous le champ.
- **Une migration en TypeScript, lancée au déploiement** : le déploiement ne lance que les migrations Prisma. Un script à part demanderait une étape de plus, pour un gain faible sur des données de test.
