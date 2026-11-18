---
id: US-256
titre: Voir la nouvelle version annoncée en haut de la page
statut: terminée
epic: EPIC-062
regles: [R14]
adr: [ADR-0093]
---

# US-256 : Voir la nouvelle version annoncée en haut de la page

En tant qu'organisatrice ou participante, je veux que le bandeau de nouvelle version s'affiche en haut de la page, avec les autres bandeaux, afin de le voir là où Limbus annonce déjà l'état de la connexion.

## Critères d'acceptation

- [x] Étant donné qu'une nouvelle version attend, alors le bandeau « Une nouvelle version de Limbus est disponible », avec « Recharger » et une croix, s'affiche tout en haut de la page, au-dessus de la barre du logo et des autres bandeaux.
- [x] Il pousse la page vers le bas sans rien recouvrir, et défile avec elle, comme les bandeaux « Pas de connexion au serveur » et « Modifications faites hors ligne ».
- [x] Le reste ne change pas : « Recharger », la croix, masqué sans réseau (US-254).

## Notes techniques

- `components/AppUpdateBanner.vue` monté en premier dans `UApp` (`app.vue`), dans le flux de la page et non plus fixé à l'écran ; la place réservée en bas et le décalage des toasts (`limbus-toaster`) disparaissent. La zone `role="status"` reste dans la page, vide sans version qui attend, pour que les lecteurs d'écran lisent le texte quand il apparaît (revue de la PR #265).

## Tests

De bout en bout (Playwright), sur les quatre axes (ADR-0079) :

- Actions : le bandeau est au-dessus de la barre du logo, en haut de la page ; « Recharger » et la croix restent couverts par `tests/e2e/pwaUpdate.spec.ts`.
- Erreurs de saisie : sans objet, le bandeau ne demande aucune saisie.
- Droits : sans objet, le bandeau est le même pour tout compte et sans compte ; il n'appelle aucune route.
- Hors ligne : déjà couvert (masqué sans réseau, revient avec lui) ; la position ne change rien.

Écrit : `tests/e2e/pwaUpdate.spec.ts` vérifie que le bandeau est en haut de la page, au-dessus de la barre du logo, et dans le flux de la page.
