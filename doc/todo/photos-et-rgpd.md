---
titre: Photos des participants : durée de conservation et information
statut: à trancher
date: 2026-10-29
revue: ../revues/2026-10-29-architecture.md
---

# Photos des participants : durée de conservation et information

## Besoin

Une photo où une personne est reconnaissable est une donnée personnelle. La [revue d'architecture](../revues/2026-10-29-architecture.md) relève deux écarts avec le RGPD :

- R-08 : les photos de session sont gardées tant que la session existe, sans durée de conservation (article 5, 1, e) ;
- R-09 : les participants ne sont pas informés de l'usage de leur photo : le trombinoscope remis à l'équipe et envoyé par email aux joueurs de la session (articles 13 et 14).

## Proposition

- **Durée de conservation** : réglage par jeu, par exemple « supprimer les photos 6 mois après la fin de la session ». Une échéance dépassée est traitée à la lecture, comme les autres échéances (ADR-0020). La suppression passe par `deleteUnusedUploads`, et les trombinoscopes concernés sont supprimés.
- **Information** : un texte affiché au moment où la photo est demandée ou ajoutée, et dans le formulaire d'inscription. Il indique la finalité (trombinoscope de la session), les destinataires (organisation et joueurs de la session), la durée de conservation et le moyen d'en demander la suppression.

## Découpage envisagé

1. Information des participants (texte, sans changement de données).
2. Durée de conservation et purge.

## Points à trancher

- Base légale : intérêt légitime ou exécution de l'inscription, avec information, plutôt qu'un consentement explicite ? La revue penche pour l'information, mais ce point est à confirmer par une source juridique (CNIL, juriste) avant la spec.
- Durée par défaut, et faut-il pouvoir la désactiver ?
- La purge supprime-t-elle aussi les trombinoscopes PDF déjà générés, ou seulement les photos ? Recommandation : les deux, puisque les PDF contiennent les photos.
