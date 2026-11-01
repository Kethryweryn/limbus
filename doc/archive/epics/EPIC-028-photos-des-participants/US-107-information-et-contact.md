---
id: US-107
titre: Informer les personnes de l'usage de leur photo
statut: terminée
epic: EPIC-028
regles: [P1, P2]
adr: [ADR-0054]
---

# US-107 : Informer les personnes de l'usage de leur photo

En tant que participante, je veux savoir à quoi sert ma photo, combien de temps elle est gardée, et comment la faire retirer.

## Critères d'acceptation

- [x] Les réglages du jeu proposent une adresse de contact, facultative, et la durée de conservation des photos (en mois, de 1 à 60, 6 par défaut).
- [x] Le même texte d'information figure :
  - sous la note d'intention du formulaire d'inscription (lien de diffusion et lien personnel) ;
  - dans l'email d'invitation ;
  - dans l'email qui envoie un trombinoscope, seul ou avec la fiche ;
  - dans « Je participe ».
- [x] Il donne l'usage (trombinoscope de la session, remis à l'équipe et envoyé aux joueurs de la session), la durée du jeu, et le moyen de retrait : le compte, ou l'adresse de contact. Sans adresse de contact, il donne celle de la propriétaire du jeu.
- [x] Le legs copie la durée, pas l'adresse de contact.

## Tests

- Unitaires : le texte selon la durée et le contact.
- Intégration : réglages du jeu ; texte présent dans l'email du trombinoscope et dans la lecture publique du formulaire.
