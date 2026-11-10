---
id: US-231
titre: Sessions repliées, dans l’adresse, avec leurs tirages
statut: à faire
epic: EPIC-054
regles: [R8, R9, R10]
adr: []
---

# US-231 : Sessions repliées, dans l’adresse, avec leurs tirages

En tant qu'organisatrice, je veux chaque session repliée sur une ligne, la prochaine dépliée, et ses tirages avec elle, afin de travailler sur une session sans les autres.

## Critères d'acceptation

- [ ] Étant donné plusieurs sessions à venir, quand j'ouvre l'onglet Sessions, alors chacune tient sur une ligne (nom, date, places, état) et seule la prochaine est dépliée (R8, R9).
- [ ] Étant donné une session dépliée, alors elle montre toutes ses actions actuelles et ses tirages, repliés (R8).
- [ ] Étant donné deux sessions dépliées, quand je recharge la page ou reviens d'une fiche, alors les deux sont dépliées, et la prochaine ne l'est pas si je l'avais repliée (R9).
- [ ] Étant donné des tirages d'une session passée ou supprimée, alors ils sont sous la ligne repliée « Sessions passées » en bas de l'onglet ; sans eux, la ligne n'apparaît pas (R10).

## Notes techniques

- Sessions dépliées dans l'adresse, par leur slug.

## Tests

De bout en bout (Playwright), sur les quatre axes (ADR-0079) :

- Actions : déplier, replier, plusieurs dépliées, tirages repliés, « Sessions passées ».
- Erreurs de saisie : aucune saisie.
- Droits : ceux de la page (US-230), inchangés ; non rejoués ici.
- Hors ligne : sessions dépliées et tirages relus sans réseau.
