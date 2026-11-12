---
id: ADR-0088
titre: Un compte pré-créé est un compte sans mot de passe, activé par un lien envoyé à son adresse
statut: accepté
date: 2026-11-12
liens: [SPEC-022, ADR-0039, ADR-0041, ADR-0055, ADR-0086]
---

# ADR-0088 : Un compte pré-créé est un compte sans mot de passe, activé par un lien envoyé à son adresse

## Contexte

Avec [SPEC-022](../specs/SPEC-022-compte-pour-chaque-participant.md) (R1, R2, R9, R11), toute fiche appartient au compte de son adresse. Si l'adresse n'a pas de compte, Limbus en crée un, inactif et sans envoyer d'email. Ce compte ne permet pas de se connecter tant que la personne ne l'a pas activé par un lien reçu à son adresse.

Aujourd'hui, un compte a toujours un mot de passe. Une fiche ne se rattache qu'au compte confirmé de son adresse (`accountIdForEmail`, [ADR-0041](ADR-0041-fiches-rattachees-a-un-compte.md)). Une inscription libre non confirmée est effacée au bout de quelques jours (`purgeUnconfirmedAccounts`, [ADR-0039](ADR-0039-comptes-en-libre-service.md)).

L'utilisatrice a choisi, le 2026-11-12 :

- un compte non activé se reconnaît à l'absence de mot de passe ;
- des pages dédiées servent à l'activation ;
- les emails des équipes se terminent par une ligne : elle mène à l'activation pour un compte non activé, et à « Je participe » pour un compte activé.

## Décision

1. **État** : `User.password` devient facultatif. Un compte sans mot de passe est **non activé**. Il n'a ni adresse confirmée (`emailConfirmedAt`) ni conditions acceptées, et son nom est vide. Aucune colonne n'est ajoutée. La connexion compare toujours le mot de passe saisi avec une empreinte factice quand le compte n'en a pas : la réponse est la même que pour un mauvais mot de passe.
2. **Pré-création** : `accountIdForEmail` devient `accountForEmail`. Il rend le compte de l'adresse, quel que soit son état, et le crée non activé s'il n'existe pas. L'écriture se fait dans la transaction qui crée la fiche ou change son adresse, sous le verrou de l'adresse ([ADR-0086](ADR-0086-fiche-unique-et-valeurs-par-jeu.md)). Toute fiche qui a une adresse porte donc un `userId`. Une migration crée les comptes des fiches existantes qui ont une adresse et pas de compte, puis rattache chaque fiche au compte de son adresse.
3. **Ce que le rattachement donne** : seul un compte activé tient des coordonnées ([ADR-0089](ADR-0089-recopie-champ-par-champ.md)). Pour un compte non activé, l'équipe garde la main sur tous les champs.
4. **Inscription non confirmée** : le nettoyage des inscriptions libres non confirmées n'efface plus un compte qui a une fiche. Il lui retire son nom, son mot de passe et ses conditions, et le compte redevient pré-créé : rien de ce qu'un tiers a pu saisir à cette adresse ne reste. Un compte non activé sans fiche est effacé par ce même nettoyage.
5. **Activation** : un jeton `activate`, valable 7 jours, envoyé seulement à l'adresse du compte. La page `/acces/activer/<jeton>` demande le nom, le mot de passe et l'acceptation des conditions ([ADR-0055](ADR-0055-pages-legales-et-acceptation.md)). L'envoi du formulaire confirme l'adresse, enregistre les trois et connecte la personne. Le lien s'obtient de quatre façons :
   - par la page publique `/acces/activer`, qui demande l'adresse ;
   - par « Mot de passe oublié » : pour un compte non activé, le lien envoyé est celui de l'activation ;
   - par l'inscription libre : sur un compte non activé, elle se poursuit comme sur une adresse libre. Le nom, le mot de passe et l'acceptation des conditions voyagent avec le jeton de confirmation et ne s'appliquent au compte qu'à la confirmation. L'inscription n'écrit plus rien sur un compte existant avant ce moment ;
   - par une invitation à co-organiser : la page la traite comme une adresse sans compte, et l'accepter active le compte.

   Les pages et l'email d'activation répondent la même chose que l'adresse ait un compte ou non, comme « Mot de passe oublié ». Pour un compte déjà activé, la page `/acces/activer` envoie l'email « vous avez déjà un compte », comme l'inscription libre.
6. **Ligne des emails** : `participantAccountFooter(email)` rend la ligne à ajouter à chaque email qu'une équipe envoie à une personne qui a une fiche : invitation, lien personnel, décisions et rappels d'inscription, réponses enregistrées, documents et fiche personnage, trombinoscope, paiement, annulation et report d'une session. Les emails de test, qui partent à l'équipe, et la demande de confirmation d'un formulaire public, qui précède la fiche, n'en ont pas. Pour un compte non activé, la ligne mène à `/acces/activer`. Pour un compte activé, elle mène à `/participer`. Aucune adresse ni aucun jeton ne figure dans l'URL.

## Conséquences

- Un compte peut exister sans que la personne le sache. La politique de confidentialité le dit dès la mise en service des comptes pré-créés (R16, avancée au lot 2), et `TERMS_VERSION` change.
- Le nettoyage des 24 mois sans connexion et la liste des comptes de l'administration doivent distinguer les comptes non activés. C'est le lot 3. D'ici là, un compte non activé est daté de sa création et s'affiche sans nom.
- Le mot de passe n'est plus garanti : tout code qui le lit doit traiter son absence.

## Options écartées

- **Une colonne « activé le »** : elle doublerait ce que disent le mot de passe et l'adresse confirmée. Écartée par l'utilisatrice.
- **Réutiliser « Mot de passe oublié » comme page d'activation** : écartée par l'utilisatrice au profit de pages dédiées, qui demandent aussi le nom et les conditions.
- **Un email à la création du compte** : écarté par la fiche d'origine.
