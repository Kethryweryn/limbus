---
id: US-006
titre: Désistement d'une personne confirmée
statut: à faire
epic: EPIC-001
regles: [R13, R16, R22]
adr: [ADR-0021]
---

# US-006 : Désistement d'une personne confirmée

En tant que personne confirmée, je veux pouvoir me désister par mon lien personnel, afin de libérer ma place sans devoir écrire aux orgas. En tant qu'organisatrice, je veux que ce désistement soit reflété partout.

## Critères d'acceptation

- [ ] Sur la page de mon lien personnel, un bouton « Me désister » demande une confirmation, puis fait passer l'inscription à `désistée`. C'est possible même après la clôture (R13).
- [ ] Le désistement, ou le retrait par une organisatrice (US-005) :
  - retire le `SessionParticipant` de la session ;
  - retire la personne du personnage éventuellement attribué dans cette session ; le personnage reste, sans joueur ;
  - laisse le paiement éventuel intact, à traiter à la main (R22).
- [ ] La page du lien affiche ensuite « Vous vous êtes désisté·e », et le lien ne permet plus rien d'autre.
- [ ] La liste des inscriptions montre le désistement, avec sa date et son auteur (la personne ou une organisatrice).
- [ ] Les organisateurs du jeu reçoivent un email signalant le désistement.

## Notes techniques

- Route : `POST /api/public/registrations/:token/withdraw`, avec limitation de débit. Le retrait par une organisatrice réutilise la même fonction serveur.
- Retirer le joueur d'un personnage efface aussi sa photo d'attribution, et le fichier si plus rien ne le référence ([ADR-0008](../../adr/ADR-0008-fichiers-televerses.md)).

## Tests

- Intégration : désistement après confirmation (`SessionParticipant` et attribution retirés, paiement conservé, photo nettoyée) ; désistement après la clôture accepté ; second désistement sans effet.
