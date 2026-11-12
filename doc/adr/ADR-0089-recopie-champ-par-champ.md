---
id: ADR-0089
titre: Les coordonnées du compte sont recopiées champ par champ, seulement les champs que la personne a remplis
statut: accepté
date: 2026-11-12
liens: [SPEC-022, ADR-0042, ADR-0086, ADR-0088]
---

# ADR-0089 : Les coordonnées du compte sont recopiées champ par champ, seulement les champs que la personne a remplis

## Contexte

[ADR-0042](ADR-0042-coordonnees-du-compte.md) recopie les coordonnées du compte sur les fiches et les inscriptions. La recopie prend tous les champs, vides compris, dès que la personne les a enregistrées une fois (`profileUpdatedAt`). Une fiche rattachée à un compte est alors fermée à l'équipe pour le nom et le téléphone.

Avec [SPEC-022](../specs/SPEC-022-compte-pour-chaque-participant.md), toute fiche est rattachée à un compte, activé ou non ([ADR-0088](ADR-0088-compte-pre-cree-sans-mot-de-passe.md)). Le compte activé part vide (R11). R12 demande qu'un champ rempli par la personne remplace la valeur de toutes ses équipes. Un champ qu'elle n'a pas rempli reste celui de chaque équipe, modifiable par elle, et rien ne se perd à l'activation, en particulier les allergies.

L'utilisatrice a choisi, le 2026-11-12 : un champ que la personne vide redevient celui des équipes, qui le voient vide et peuvent le saisir de nouveau.

## Décision

1. **Champs** : le nom, le téléphone, le contact d'urgence (nom et téléphone ensemble) et les allergies (avec leur consentement). Le nom et le téléphone vont sur le lien de la fiche à chaque jeu ([ADR-0086](ADR-0086-fiche-unique-et-valeurs-par-jeu.md)). Chaque champ va aussi sur les inscriptions non désistées et déjà remplies dont le formulaire l'a demandé, comme aujourd'hui : prénom et nom découpés, téléphone, contact d'urgence, allergies.
2. **Champ tenu par la personne** : un champ non vide sur un compte activé. Le nom d'un compte activé est toujours tenu, puisqu'il est choisi à l'activation. Un compte non activé ne tient aucun champ.
3. **Recopie** : `syncProfileToParticipants` ne recopie que les champs tenus. À l'activation, puis à chaque enregistrement des coordonnées, elle écrit ces champs sur toutes les fiches et inscriptions du compte. À l'enregistrement, un champ que la personne vient de vider est vidé partout. Un champ qu'elle n'a jamais rempli n'est jamais écrit. `profileUpdatedAt` ne conditionne plus la recopie : il garde seulement la date du dernier enregistrement.
4. **Écriture par l'équipe** : seule la fiche est concernée, car l'équipe n'écrit pas les coordonnées d'une inscription. Le serveur refuse de changer le nom ou le téléphone quand ils sont tenus, quelle que soit la route : interface, assistant d'IA, file hors ligne. L'écran ne grise que les champs tenus. La lecture renvoie la liste des champs tenus (`heldFields`), jamais les valeurs du compte au-delà de ce que la fiche montre déjà.
5. **Mise en service** : une migration de données recopie les champs tenus de chaque compte activé. Pour un compte qui n'a jamais enregistré ses coordonnées, cela ne touche que le nom. Aujourd'hui, chaque équipe garde le nom qu'elle a saisi. Après la migration, elle voit le nom du compte.

## Conséquences

- Une équipe peut compléter le téléphone ou les allergies d'une personne qui a un compte, tant que la personne ne les a pas remplis.
- À la mise en service, les équipes qui suivent une personne déjà activée voient son nom de compte à la place de celui qu'elles avaient saisi.
- Quand la personne vide un champ, la valeur que l'équipe avait saisie avant ne revient pas : la recopie l'avait remplacée.
- Ce document remplace la partie d'[ADR-0042](ADR-0042-coordonnees-du-compte.md) qui recopie tous les champs dès le premier enregistrement.

## Options écartées

- **Un champ vidé reste à la personne** : il faudrait une date par champ, et les équipes ne pourraient plus saisir un téléphone que la personne a retiré. Écarté par l'utilisatrice.
- **Garder la recopie de tous les champs** : un compte activé vide effacerait les allergies notées par les équipes, contraire à R12.
