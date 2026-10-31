---
id: ADR-0046
titre: Formulaire public des inscriptions : demande à confirmer, inscription reçue, inscription permanente
statut: accepté
date: 2026-10-31
liens: [../specs/SPEC-001-inscriptions.md, ../specs/SPEC-009-page-publique.md, ADR-0018-jetons-des-liens-personnels.md, ADR-0019-modele-des-inscriptions.md, ADR-0041-fiches-rattachees-a-un-compte.md]
---

# ADR-0046 : Formulaire public des inscriptions : demande à confirmer, inscription reçue, inscription permanente

## Contexte

[SPEC-001](../specs/SPEC-001-inscriptions.md), lot 2 (R10, R11, R13, R30 à R32) : n'importe qui remplit le formulaire d'une période d'inscription en mode formulaire, par son lien de diffusion. L'inscription n'est reçue qu'une fois l'email confirmé (R11) ; une réponse ne révèle jamais si une adresse est déjà inscrite. L'inscription permanente couvre tout le jeu (R30). [SPEC-009](../specs/SPEC-009-page-publique.md) (écart 3) : la page publique montre, au choix de l'équipe, les sessions à venir et le lien d'inscription.

## Décision

- **Demande à confirmer.** Un formulaire envoyé sans être connecté crée une `RegistrationRequest` (période, email, réponses en JSON, version du formulaire, hash du jeton), et rien d'autre : ni fiche participant, ni inscription. L'email part dans tous les cas, avec un lien `/inscription/<jeton>`. Ouverte, la page confirme la demande par un POST (pas au GET : un logiciel qui ouvre les liens d'un email ne confirme rien) ; la demande devient alors l'inscription, et son jeton le lien personnel. Une demande non confirmée sous 7 jours est supprimée, à chaque envoi de formulaire et à chaque connexion (comme ADR-0039).
- **À la confirmation**, la personne est rapprochée d'une fiche par son email (R12), sinon une fiche est créée et rattachée au jeu et à son compte s'il existe (ADR-0041). Puis :
  - pas d'inscription dans cette période : elle est créée au statut `received` (« reçue ») ;
  - inscription reçue ou désistée : elle repart à « reçue » avec les nouvelles réponses (choix de l'utilisatrice) ;
  - inscription à un autre statut : elle ne change pas ; seul le lien personnel est renouvelé, l'ancien cesse de marcher.
  Comme la demande ne touche à rien avant d'être confirmée depuis la boîte de la personne, quelqu'un qui connaît son adresse ne peut ni modifier ses réponses ni savoir si elle est inscrite.
- **Personne connectée** (compte à l'adresse confirmée) : le formulaire est prérempli par son compte, l'adresse est celle du compte, et l'inscription est reçue aussitôt, sans demande ni email de confirmation ; elle la retrouve dans « Je participe ». Ses réponses mettent à jour ses coordonnées, comme depuis le compte (ADR-0042).
- **Statut « reçue ».** Le lien personnel permet de la modifier jusqu'à la clôture et de la retirer à tout moment (statut désistée, R13). Elle n'a pas de session : la sélection (lot 3) en retiendra pour une session.
- **Disponibilités** (R10) : `RegistrationAvailability` (inscription, session), au moins une, parmi les sessions d'une période qui en couvre plusieurs ; aucune pour une période d'une seule session ni pour l'inscription permanente.
- **Inscription permanente** : `scope = game`, sans sessions rattachées ni date de clôture, toujours en mode formulaire ; une seule ouverte par jeu à la fois. Son formulaire liste pour information les sessions à venir du jeu qui n'ont pas leur propre période. Rattacher une session à une période dédiée la retire de l'inscription permanente (R31) ; le refus quand des inscrits du vivier sont déjà retenus pour cette session viendra avec la sélection.
- **Lien de diffusion** (R32) : `/i/<publicId>`, rendu côté serveur pour les balises Open Graph (nom du jeu, sessions et dates, début de la note d'intention, vignette du teaser YouTube s'il y en a une, servie par `/api/public/periods/<publicId>/teaser-thumbnail`). Il marche même sans page publique, et dit « inscriptions closes » quand la période est clôturée ; en brouillon, il répond comme un lien inconnu.
- **Équipe prévenue** : `RegistrationPeriod.notifyTeam` ; coché, la propriétaire et les co-organisatrices reçoivent un email à chaque inscription reçue.
- **Page publique** : `Game.publicShowSessions` et `Game.publicShowRegistration`, décochés par défaut. Cochés, la page montre les sessions à venir marquées visibles (date et lieu), et le lien de diffusion de chaque période ouverte en mode formulaire.
- **Protection** : limite de débit par IP sur l'envoi du formulaire, champ piège (`website`), état d'ouverture vérifié côté serveur.

## Conséquences

- Les inscriptions reçues attendent la sélection (lot 3) : d'ici là, l'équipe les consulte sans pouvoir les retenir.
- Une demande n'est pas une donnée de participant : elle n'a pas de fiche, et disparaît au bout de 7 jours ou à la confirmation.

## Options écartées

- **Créer la fiche et l'inscription dès l'envoi, au statut « email à confirmer »** : une adresse saisie par un robot ou par erreur laisserait une fiche chez l'équipe, et une seconde soumission pourrait écraser les réponses d'une inscription existante.
- **Confirmer au premier GET du lien** : les antivirus de messagerie ouvrent les liens et confirmeraient à la place de la personne.
