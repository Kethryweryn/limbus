---
id: US-255
titre: Retrouver le réseau sans que la page se recharge
statut: terminée
epic: EPIC-061
regles: [R7]
adr: [ADR-0093]
---

# US-255 : Retrouver le réseau sans que la page se recharge

En tant qu'organisatrice qui a travaillé hors ligne, je veux qu'au retour du réseau mes modifications partent sans que la page se recharge, afin de ne pas perdre ce que je suis en train d'écrire.

## Critères d'acceptation

- [x] Étant donné des modifications en attente, quand le réseau revient et qu'elles passent toutes, alors un message dit qu'elles sont envoyées, et la page affichée relit ses données sans recharger l'application.
- [x] Étant donné une fenêtre ouverte ou un champ en cours de saisie à ce moment, alors la page attend que la fenêtre se ferme et que le champ soit quitté pour relire ses données ; rien de ce qui est saisi ne se perd.
- [x] Étant donné un élément créé hors ligne, après l'envoi, la page l'affiche avec son vrai identifiant : l'ouvrir ou le modifier fonctionne (la page relit la liste du serveur, comme avant le rechargement).
- [x] Étant donné une modification refusée, alors rien ne change par rapport à aujourd'hui : le panneau des modifications s'ouvre.

## Notes techniques

- `app.vue` : `syncPendingChanges` ne fait plus `window.location.reload()`. Une fois la file passée, la page affichée est remontée (clé de `NuxtPage`), ce qui relit ses données comme à l'ouverture, quand aucune fenêtre (`[role="dialog"]`) n'est ouverte et qu'aucun champ n'a le focus ; sinon, à la première de ces deux occasions : un changement de page, ou la fin de la saisie.

## Tests

De bout en bout (Playwright), sur les quatre axes (ADR-0079) :

- Actions : une modification faite hors ligne part au retour du réseau, la page ne se recharge pas (repère posé sur `window`), et affiche la valeur du serveur ; un élément créé hors ligne s'ouvre après l'envoi.
- Erreurs de saisie : une saisie en cours dans une fenêtre ouverte au retour du réseau reste intacte, et la page se relit à sa fermeture.
- Droits : sans objet, rien ne change dans les droits des écritures rejouées.
- Hors ligne : c'est l'objet de l'US.

Écrits : `tests/e2e/syncWithoutReload.spec.ts` (la page relit une donnée changée sur le serveur sans se recharger ; une saisie en cours dans une fenêtre ouverte reste intacte, et la page se relit à sa fermeture) et `tests/utils/pageRefresh.test.ts`. Les 23 fichiers e2e qui coupent le réseau passent.

En passant : `tests/e2e/sessionScreens.spec.ts` (déroulé) attend la réponse du premier enregistrement avant le second. Sous charge, le second partait avec l'ancienne version de la session et était refusé.
