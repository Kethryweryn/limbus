---
titre: Valider les saisies partout
statut: prête
epic: ../epics/EPIC-060-validation-des-saisies/README.md
date: 2026-11-17
spec: ../../specs/SPEC-023-validation-des-saisies.md
---

# Valider les saisies partout

## Besoin

Le cahier de tests relève trois saisies acceptées alors qu'elles ne devraient pas l'être :

- A10-1 : un nom de compte peut contenir des chiffres et des symboles ;
- A9-1 : un contact d'urgence peut avoir un nom sans téléphone ;
- A9-2 : un téléphone accepte n'importe quel texte.

Ce ne sont pas des cas isolés : ailleurs non plus, Limbus ne vérifie ni la forme d'un nom, ni celle d'un téléphone. Beaucoup de textes libres n'ont pas non plus de longueur maximale. La vérification est donc à étendre à tous les champs saisis.

## Proposition

- Un nom de personne n'accepte que des lettres et quelques séparateurs.
- Un téléphone est vérifié selon son pays, puis rangé sous une seule forme.
- Un contact d'urgence se remplit en entier, nom et téléphone, ou pas du tout.
- Chaque texte libre a une longueur maximale, selon un barème par type de texte.
- Un refus s'affiche sous le champ concerné, en français.

## Découpage envisagé

1. Les noms de personnes.
2. Les téléphones, avec les numéros déjà en base, et le contact d'urgence.
3. Les longueurs maximales de tous les textes, et des emails vérifiés de la même façon partout.

## Points tranchés (2026-11-17)

- **Noms :** toutes les lettres, accents et autres alphabets compris, plus l'espace, le trait d'union, l'apostrophe et le point. Chiffres et autres symboles refusés.
- **Téléphones :** français et étrangers, vérifiés selon leur pays.
  - Un numéro français s'écrit avec ou sans indicatif, et passe automatiquement au format +33.
  - Les espaces sont acceptés à la saisie, puis retirés. Il en va de même pour les points, les tirets et les parenthèses (précision du 2026-11-17).
- **Affichage des téléphones :** sous la forme rangée (+33612345678), à l'écran comme dans les exports.
- **Contact d'urgence :** nom et téléphone vont ensemble. Un nom seul est refusé, et un téléphone seul aussi.
- **Étendue :** tous les champs saisis, avec le message sous le champ concerné, à l'écran comme sur le serveur.
- **Valeurs déjà en base :** une migration remet au format chaque téléphone reconnu. Le reste ne bouge pas, et la règle s'applique à la prochaine modification du champ.
- **Longueurs :** un barème par type de texte. Les plafonds déjà en place ne changent pas.
  - nom de personne : 100 caractères ;
  - titre ou nom d'élément : 200 ;
  - texte court : 500 ;
  - texte long : 50 000.
- **Textes de fond :** 1 000 000 de caractères, car un historique peut être très long. Cela couvre l'historique d'un personnage ou d'un groupe et le contenu d'un document. La description d'une intrigue et la note d'intention sont des textes longs (précision du 2026-11-17).
