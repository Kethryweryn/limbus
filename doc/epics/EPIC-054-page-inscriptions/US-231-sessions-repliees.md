---
id: US-231
titre: Sessions repliées, dans l'adresse, avec leurs tirages
statut: terminée
epic: EPIC-054
regles: [R8, R9, R10]
adr: []
---

# US-231 : Sessions repliées, dans l'adresse, avec leurs tirages

En tant qu'organisatrice, je veux chaque session repliée sur une ligne, la prochaine dépliée, et ses tirages avec elle, afin de travailler sur une session sans les autres.

## Critères d'acceptation

- [x] Étant donné plusieurs sessions prévues, quand j'ouvre l'onglet Sessions, alors chacune tient sur une ligne (nom, date, places, état) et seule la première est dépliée (R8, R9).
- [x] Étant donné une session dépliée, alors elle montre toutes ses actions actuelles et ses tirages, repliés (R8).
- [x] Étant donné deux sessions dépliées, quand je recharge la page ou reviens d'une fiche, alors les deux sont dépliées, et la première ne l'est pas si je l'avais repliée ; toutes repliées, elles le restent (R9).
- [x] Étant donné des tirages d'une session terminée, annulée ou supprimée, alors ils sont sous la ligne repliée « Sessions passées » en bas de l'onglet, sans bouton d'annulation ; sans eux, la ligne n'apparaît pas (R10).

## Notes techniques

- `RegistrationSelection` : chaque session tient sur un bouton (`aria-expanded`) ; les sessions dépliées sont dans l'adresse, `sessions=slug1,slug2`, vide pour aucune ; sans rien dans l'adresse, la première est dépliée. La sélection rend le slug de chaque session (`selectableSessions`).
- `RegistrationDrawEntry` affiche un tirage, sous sa session (annulable) ou sous « Sessions passées » (à lire seulement). Un tirage dont la session a été supprimée s'y lit « Session supprimée », au lieu de « Ancienne période ».

## Tests

De bout en bout (`tests/e2e/registrationSessions.spec.ts`), sur les quatre axes (ADR-0079) :

- Actions : « la première session est dépliée, les autres se déplient ; l’adresse garde le choix, même tout replié », « les tirages d’une session sont sous elle, repliés ; ceux d’une session terminée sont sous « Sessions passées », sans annulation ».
- Erreurs de saisie : aucune saisie.
- Droits : ceux de la page (US-230), inchangés ; non rejoués ici.
- Hors ligne : « hors ligne, les sessions dépliées et leurs tirages se relisent ».

Les tests du tirage (`registration.spec.ts`, `registrationRules.spec.ts`) déplient le journal de la session.
