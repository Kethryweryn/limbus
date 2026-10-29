---
id: US-072
titre: Répondre à une inscription et se désister depuis son compte
statut: terminée
epic: EPIC-015
regles: [R15]
adr: [ADR-0041, ADR-0018]
---

# US-072 : Répondre à une inscription et se désister depuis son compte

En tant que personne invitée à s'inscrire, je veux répondre depuis mon compte, sans chercher l'email qui contient mon lien.

## Critères d'acceptation

- [x] Depuis « Je participe », j'ouvre une inscription et j'y fais ce que permet le lien personnel : accepter en remplissant le formulaire, décliner, modifier jusqu'à la clôture, me désister.
- [x] Mêmes règles que le lien (statut, clôture, délai), même formulaire, même email de confirmation.
- [x] Le lien personnel marche toujours, sans connexion (R15).
- [x] Une inscription d'une fiche qui n'est pas la mienne répond 404.

## Notes techniques

- Routes `GET`/`PUT /api/me/registrations/:id`, `POST …/decline`, `POST …/withdraw`, qui reprennent la logique du lien personnel. Le formulaire devient un composant partagé par la page du lien et `/participer/inscriptions/:id`.

## Tests

- Intégration : accepter, modifier, se désister depuis le compte ; refus pour l'inscription d'une autre personne ; le lien personnel continue de marcher.
