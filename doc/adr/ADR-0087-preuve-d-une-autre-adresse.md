---
id: ADR-0087
titre: Une adresse donnée en réponse, déjà celle d'une autre fiche, se prouve par un lien avant la réunion des deux fiches
statut: accepté
date: 2026-11-12
liens: [SPEC-022, ADR-0086, ADR-0018, ADR-0046]
---

# ADR-0087 : Une adresse donnée en réponse, déjà celle d'une autre fiche, se prouve par un lien avant la réunion des deux fiches

## Contexte

Une personne qui répond à son invitation, par son lien personnel ou depuis son compte, peut donner une autre adresse email. Une adresse n'a qu'une fiche dans tout Limbus ([ADR-0086](ADR-0086-fiche-unique-et-valeurs-par-jeu.md)). Si l'adresse donnée est déjà celle d'une autre fiche, la fiche d'origine ne peut pas la prendre. Un lien personnel a aussi pu être transmis à quelqu'un d'autre. L'utilisatrice a choisi, le 2026-11-11 et le 2026-11-12 :

- un lien envoyé à l'autre adresse prouve qu'elle est à la personne ;
- en attendant, la réponse est enregistrée et la fiche comme l'inscription gardent leur adresse ;
- après la preuve, tout passe sur la fiche de l'adresse prouvée ;
- le lien vaut 7 jours ;
- toute autre adresse donnée en réponse se prouve ainsi, connue de Limbus ou non, pour que rien ne révèle si une adresse a une fiche (revue de la PR #236).

## Décision

1. **Demande de preuve** : table `ParticipantEmailProof` (fiche d'origine, adresse à prouver, empreinte du jeton, échéance). Le jeton est tiré au hasard et seule son empreinte SHA-256 est gardée, comme pour les liens personnels ([ADR-0018](ADR-0018-jetons-des-liens-personnels.md)). Une nouvelle demande pour la même fiche et la même adresse remplace la précédente.
2. **Envoi** : à l'enregistrement d'une réponse par le lien personnel qui donne une autre adresse que celle de l'inscription, connue ou non, un email part à cette adresse, avec le lien `/inscription/adresse/<jeton>` ; un lien encore valable n'est pas renvoyé dans l'heure. Une réponse depuis le compte porte l'adresse du compte, déjà confirmée : elle est adoptée aussitôt, comme après une preuve. L'email ne nomme ni la fiche d'origine, ni les jeux, ni les équipes. La réponse dit à la personne qu'un lien est parti et qu'il faut l'ouvrir.
3. **Preuve** : la page du lien demande un clic (« C'est bien mon adresse ») avant la requête `POST /api/public/email-proofs/<jeton>`. Un logiciel qui ouvre les liens des emails ne prouve donc rien. La route est publique, limitée en débit, et répond pareil pour un jeton inconnu, déjà utilisé ou expiré. Sous verrou de l'adresse, tout ce que tient la fiche d'origine passe sur la fiche de l'adresse prouvée (`limbus_move_participant`, pour tous ses jeux), et ses inscriptions qui portaient l'ancienne adresse prennent l'adresse prouvée. La fiche d'origine disparaît, puis la demande. Si aucune fiche ne porte l'adresse, la fiche d'origine la prend simplement (`adoptAddress`). La page ne montre rien de l'autre fiche.
4. **Durée** : 7 jours, comme une demande d'inscription non confirmée ([ADR-0046](ADR-0046-formulaire-public-des-inscriptions.md)). Les demandes expirées sont effacées par le nettoyage quotidien (`retention.ts`).

## Conséquences

- Une adresse est une donnée personnelle de plus, gardée au plus 7 jours ; la politique de confidentialité le dit.
- Une personne qui a deux fiches à deux adresses n'en a plus qu'une, et chaque équipe y garde ses jeux, ses notes et son nom pour elle.
- La fiche d'origine peut être suivie par d'autres équipes : elles la retrouvent à la nouvelle adresse, sous le nom qu'elles lui donnent. C'est la personne, preuve faite, qui décide de son adresse.

## Options écartées

- **Changer l'adresse de la fiche sans preuve** : un lien personnel transféré suffirait à rattacher une fiche à quelqu'un d'autre.
- **Bloquer la réponse jusqu'à la preuve** : écarté par l'utilisatrice.
- **Garder la fiche la plus ancienne** : écarté par l'utilisatrice, au profit de la fiche de l'adresse prouvée.
