---
id: US-003
titre: Inviter des participants
statut: à faire
epic: EPIC-001
regles: [R12, R13, R16, R20]
adr: [ADR-0018, ADR-0019, ADR-0020]
---

# US-003 : Inviter des participants

En tant qu'organisatrice, je veux inviter des personnes à une session de ma période d'inscription, afin qu'elles confirment leur venue et me donnent leurs informations.

## Critères d'acceptation

- [ ] Depuis une période d'inscription ouverte, j'invite pour une de ses sessions :
  - des participants existants du jeu (sélection multiple) ;
  - ou une nouvelle personne (nom et email).
- [ ] Pour une nouvelle personne, l'email est rapproché, sans tenir compte de la casse, des participants liés aux jeux de la même propriétaire. S'il y en a un, il est réutilisé et lié au jeu ; sinon, un participant est créé et lié au jeu (R12).
- [ ] Une même personne ne peut avoir qu'une inscription par période d'inscription : une seconde invitation est refusée avec un message.
- [ ] Une personne sans email ne peut pas être invitée ; l'interface l'indique.
- [ ] Chaque invitation crée une inscription au statut `invitée`, avec l'organisateur invitant, l'échéance de réponse (aujourd'hui + délai de la période d'inscription) et un lien personnel (R16, R20).
- [ ] Un email part à chaque personne invitée. Il contient le nom du jeu, la session et sa date, l'échéance et le lien personnel (`absoluteAppUrl`).
- [ ] Un envoi groupé utilise le verrou d'envoi de session (pas de double envoi sur double clic), et un échec SMTP est signalé sans bloquer les autres envois.
- [ ] Je peux renvoyer l'invitation : l'ancien lien est alors invalidé.
- [ ] Je peux annuler une invitation sans réponse : son lien est invalidé et l'inscription supprimée.
- [ ] Le nombre d'invitations est affiché face au nombre de places de la session ; dépasser les places est permis, avec un avertissement.

## Notes techniques

- Modèle : `Registration` ([ADR-0019](../../adr/ADR-0019-modele-des-inscriptions.md)) ; jeton selon [ADR-0018](../../adr/ADR-0018-jetons-des-liens-personnels.md).
- Routes : `POST /api/registration-periods/:id/invitations`, `POST /api/registrations/:id/resend`, `DELETE /api/registrations/:id`.
- Le rapprochement par email est une fonction serveur testée à part, réutilisée par le formulaire public (EPIC-002).

## Tests

- Unitaires : génération et hash du jeton ; rapprochement par email (casse, autre propriétaire ignoré).
- Intégration : invitation d'un participant existant et d'une nouvelle personne ; doublon refusé ; renvoi qui invalide l'ancien lien ; email envoyé (transport simulé) ; ajout à `isolation.test.ts`, y compris inviter un participant de Bob dans le jeu d'Alice.
