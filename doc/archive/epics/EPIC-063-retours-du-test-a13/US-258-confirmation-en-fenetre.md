---
id: US-258
titre: Confirmer un effacement dans une fenêtre
statut: terminée
epic: EPIC-063
regles: [R4, R5]
adr: []
---

# US-258 : Confirmer un effacement dans une fenêtre

En tant qu'organisatrice ou participante, je veux que la confirmation d'un effacement ou d'une désactivation du hors ligne s'ouvre dans une fenêtre, afin de voir tout de suite qu'une réponse est attendue, sans que la section change sous mes yeux.

Règles de [SPEC-019](../../../specs/SPEC-019-hors-ligne-dans-le-compte.md).

## Critères d'acceptation

- [x] Étant donné Mon compte, quand je choisis « Effacer les données de l'appareil » ou que je décoche « Garder Limbus sur cet appareil pour le hors ligne », alors une fenêtre s'ouvre, avec son titre, la question, les modifications en attente s'il y en a, et les mêmes boutons qu'avant.
- [x] Derrière la fenêtre, la section ne change pas : le bouton « Effacer les données de l'appareil » et la liste « Télécharger pour le hors ligne » restent en place.
- [x] « Annuler », la croix, la touche Échap ou un clic hors de la fenêtre renoncent : rien n'est effacé, la case reste cochée.
- [x] Pendant un envoi ou un effacement en cours, la fenêtre ne se ferme pas.
- [x] En recochant la case, la liste « Télécharger pour le hors ligne » ne s'affiche qu'une fois (retour A13-3).

## Notes techniques

- `components/OfflineDeviceCard.vue` : la confirmation passe dans un `UModal` (contenu dans `#body`). La liste des téléchargements portait la clé `0`, la même que celle que Vue donne au premier bloc conditionnel de la section : en recochant la case, les deux se confondaient et la liste restait en double. Sa clé est maintenant un texte.

## Tests

De bout en bout (Playwright), sur les quatre axes (ADR-0079), dans `tests/e2e/offlineDevice.spec.ts` :

- Actions : la fenêtre s'ouvre pour l'effacement et pour la désactivation, la section reste en place derrière ; « Annuler » et Échap renoncent ; recocher n'affiche la liste qu'une fois.
- Erreurs de saisie : sans objet, la fenêtre ne demande aucune saisie ; une modification refusée y arrête l'effacement (test existant, repris dans la fenêtre).
- Droits : une participante a la même fenêtre (test existant de la section).
- Hors ligne : sans réseau, seul l'abandon est proposé dans la fenêtre (test existant, repris).
