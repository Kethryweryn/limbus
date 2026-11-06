---
id: SPEC-018
titre: Un seul mode d'inscription, le vivier permanent
statut: validée
date: 2026-11-06
origine: ../archive/todo/vivier-permanent.md
epics: [EPIC-046, EPIC-047, EPIC-048]
adr: [ADR-0069, ADR-0070]
---

# SPEC-018 : Un seul mode d'inscription, le vivier permanent

## Objectif

Remplacer les périodes d'inscription par un seul mode : chaque jeu a un vivier permanent. Une personne remplit une seule fois le questionnaire du jeu, puis dit pour quelles sessions elle est disponible. L'équipe caste ensuite session par session.

Cette spec remplace, dans [SPEC-001](SPEC-001-inscriptions.md), ce qui concerne les périodes, les modes d'entrée et le statut unique d'une inscription. Le formulaire, les affinités, les relations et la note de l'assistant de casting ne changent pas, sauf mention ici. SPEC-001 sera mise à jour à la livraison de chaque lot.

## Vocabulaire

- **Vivier** : les personnes qui ont répondu au questionnaire d'un jeu.
- **Session ouverte** : une session que l'équipe a ouverte à la pré-inscription.
- **Demande de disponibilités** : l'email qui demande à une personne du vivier si elle est intéressée et disponible pour une session. Ce n'est pas une confirmation d'inscription.

## Parcours

### Organisatrice

1. Elle prépare le questionnaire du jeu, puis ouvre le vivier, et partage son lien de diffusion. Elle peut aussi inviter une personne par email à le rejoindre.
2. Elle crée une session et l'ouvre à la pré-inscription. Limbus propose alors d'écrire au vivier ; elle peut ensuite relancer les personnes qui n'ont pas répondu.
3. Pour chaque session ouverte, elle caste parmi les pré-inscrits : à la main, avec l'assistant, ou par tirage au sort selon le réglage de la session. Elle peut ajouter à la main une autre personne du vivier.
4. Elle annonce le casting : toutes les personnes retenues reçoivent un email, et les personnes en attente aussi si elle le choisit.
5. Ensuite, à chaque changement du cast, Limbus lui propose d'envoyer un email individuel. Rien ne part sans son clic.

### Personne qui s'inscrit

1. Elle répond au questionnaire et coche, si elle le veut, les sessions ouvertes où elle est disponible. Elle est alors intéressée, et pré-inscrite pour chaque session cochée.
2. Quand une session s'ouvre, elle peut recevoir une demande : « Je suis disponible » ou « Pas disponible » la mènent à une page où elle confirme d'un clic.
3. Elle peut à tout moment revoir et modifier ses réponses, par son lien personnel ou son compte.
4. Une fois castée, elle confirme sa présence, ce qui l'inscrit à la session. Son premier versement la rend inscrite validée.
5. Elle peut annuler sa présence à une session sans quitter le vivier, ou quitter le vivier.

## Règles métier

### Vivier

- **R1** Un jeu a au plus un vivier. Une personne y a une seule réponse au questionnaire.
- **R2** L'équipe ouvre et ferme le vivier à la main. Il n'a pas de date de clôture. Fermé, il refuse les nouvelles entrées, et son lien de diffusion dit « inscriptions closes ». Les personnes déjà dedans gardent leur accès, leurs réponses et leurs disponibilités.
- **R3** Il n'y a plus de période par session, de mode d'entrée ni de statut « non retenue ». Le lien de diffusion, le formulaire et sa confirmation par email restent ceux de SPEC-001 (R8, R11, R12, R32).
- **R4** L'équipe peut inviter une personne par son nom et son email à rejoindre le vivier. La personne reçoit un lien vers le questionnaire ; elle entre dans le vivier en y répondant. L'invitation ne concerne aucune session.
- **R5** Une personne qui quitte le vivier en sort entièrement : ses présences à venir sont annulées comme en R19. Elle y revient en remplissant de nouveau le questionnaire. L'équipe voit qu'elle est sortie.

### Sessions ouvertes et disponibilités

- **R6** Une session n'est proposée au vivier que si l'équipe l'a ouverte à la pré-inscription. Seule une session à venir, ni annulée ni terminée, peut l'être. La refermer ne retire aucune pré-inscription, mais elle n'est plus proposée.
- **R7** Le questionnaire ajoute une question listant les sessions ouvertes. Elle est facultative, et absente s'il n'y en a aucune. Ne cocher aucune date laisse la personne simplement intéressée.
- **R8** Places d'une session : réglées quand on l'ouvre, le nombre de personnages PJ par défaut. On ne retient pas au-delà des places, et on ne descend pas sous le nombre de personnes retenues ou inscrites.

### Demande de disponibilités

- **R9** Quand une session est ouverte, Limbus propose d'envoyer la demande au vivier. Rien ne part sans le clic d'une organisatrice. La demande part aux personnes du vivier sans réponse pour cette session, sauf les rejoueurs exclus (R24).
- **R10** L'email dit clairement que c'est une demande d'intérêt et de disponibilité, donc une pré-inscription, sans place garantie ni confirmation d'inscription. Il donne la date de la session, les deux réponses, et le lien pour revoir et modifier ses réponses.
- **R11** Un bouton de l'email ouvre une page qui demande de confirmer d'un clic : ouvrir le lien ne change rien. « Disponible » la rend pré-inscrite, « Pas disponible » note sa réponse. L'équipe distingue donc un refus d'une absence de réponse. Elle peut changer de réponse tant qu'elle n'est pas castée pour cette session.
- **R12** Un bouton « Relancer » écrit de nouveau aux seules personnes qui n'ont pas répondu pour cette session. Il indique la date de la dernière demande.
- **R13** Le lien d'un email plus ancien continue de marcher quand un nouvel email part. Si l'équipe envoie un nouveau lien à la demande d'une personne, tous les anciens cessent de marcher.

### Réponses au questionnaire

- **R14** La personne peut revoir et modifier ses réponses à tout moment tant qu'elle est dans le vivier, même castée et même vivier fermé.
- **R15** En revenant, elle voit la dernière version du questionnaire : ses anciennes réponses sont reprises, et les nouvelles questions s'ajoutent. Les nouvelles questions obligatoires ne sont exigées que si elle enregistre. Tant qu'elle ne revient pas, ses réponses restent telles quelles, avec leur version.
- **R16** Quand une personne retenue, en attente ou inscrite pour une session à venir change ses réponses, chaque organisatrice du jeu reçoit un email, et un repère « réponses modifiées » apparaît sur la personne dans la sélection, jusqu'à ce qu'une organisatrice le marque comme lu. Un changement fait hors de ces cas ne déclenche rien.

### Statut par session

- **R17** Le statut se lit session par session. Une personne peut être pré-inscrite pour une session, castée pour une autre, et en attente pour une troisième.

| Statut | Quand |
|---|---|
| Intéressée | Dans le vivier, sans réponse positive pour cette session. Ce statut vaut pour le jeu |
| Pré-inscrite | A dit être disponible pour la session |
| Pas disponible | A répondu non pour la session |
| En attente | Sur la liste d'attente de la session |
| Castée | Retenue pour la session, avec ou sans personnage |
| Inscrite | A confirmé sa présence après le casting |
| Inscrite validée | Inscrite, et premier versement reçu ; sans rien à payer (place offerte, session sans tarif), dès la confirmation |
| Annulation | A annulé sa présence, ou a été retirée de la session |

- **R18** « Inscrite » crée le participant de session (SPEC-001, R22). « Inscrite validée » se déduit des paiements, sans saisie : retirer le seul versement la ramène à « inscrite ».
- **R19** Annuler vaut pour une seule session et laisse la personne dans le vivier. Les effets d'un désistement de SPEC-001 (R22) restent : participant retiré, personnage libéré, paiement à traiter à la main, équipe prévenue. Elle n'est plus proposée pour cette session sauf si elle s'y dit de nouveau disponible.

### Casting

- **R20** Une organisatrice peut retenir ou mettre en attente une personne pré-inscrite, ou ajouter à la main une autre personne du vivier, sans demande préalable. Une personne qui a répondu « pas disponible » peut aussi être ajoutée : l'écran le signale.
- **R21** L'assistant de casting propose les personnages parmi le cast, les personnes retenues et les pré-inscrits de la session. Les autres personnes du vivier n'y figurent pas tant qu'elles n'ont pas été ajoutées à la main. Enregistrer une proposition retient les pré-inscrits concernés, dans la limite des places, et leur réserve le personnage (SPEC-001, R29).
- **R22** Chaque session a son mode de sélection : à la main, au hasard, ou mixte (SPEC-001, R4). Le tirage porte sur les pré-inscrits de la session, et reste reproductible et annulable tant que rien n'est annoncé depuis (SPEC-001, R17 et R18). La priorité « non tirés avant » vise une personne restée sans place lors d'un tirage d'une session plus ancienne du jeu.
- **R23** Après un tirage, les personnes sans place vont en liste d'attente dans la limite réglée. Les autres restent pré-inscrites, sans message, et peuvent être retenues à la main. La liste d'attente suit l'ordre du tirage ou celui que fixe l'équipe, et propose la suivante quand une place se libère (SPEC-001, R19 et R21).
- **R24** Rejoueurs (SPEC-001, R7) : le réglage du vivier s'applique. Autorisé ; signalé à l'équipe ; ou exclu : la personne ne reçoit pas de demande, n'entre pas dans le tirage, et ne peut pas être retenue.
- **R25** Alertes et affinités (SPEC-001, R25) se calculent par session, sur les personnes retenues, inscrites ou dans le cast.

### Annonces

- **R26** Une décision ne prévient personne d'elle-même. Le bouton « Annoncer le casting » d'une session écrit à toutes les personnes retenues. Une case, décochée par défaut, y ajoute les personnes en attente, sans leur rang.
- **R27** Après la première annonce d'une session, un changement pour une personne (ajoutée, retirée, passée en attente ou sortie de la liste d'attente) fait apparaître sur sa ligne une proposition d'email individuel, que l'organisatrice envoie ou ignore. L'échéance de confirmation (SPEC-001, R20) part de l'email envoyé.
- **R28** Tant qu'aucun email ne l'a prévenue, la personne voit ce qui lui a déjà été annoncé, sinon son statut de pré-inscrite.

## Données

- **Par session et par personne** : statut, position en liste d'attente, dates de réponse, de demande, de relance, d'échéance, de confirmation et d'annulation, ce qui a été annoncé, qui a retenu, repère de réponses modifiées. Détail dans [ADR-0069](../adr/ADR-0069-vivier-unique-et-statut-par-session.md).
- **Session ouverte** : ouverture, places, mode de sélection et réglages du tirage.
- **Liens personnels** : plusieurs par personne, gardés seulement sous forme de hash ([ADR-0070](../adr/ADR-0070-liens-personnels-durables.md)).
- **Bascule** : les périodes de chaque jeu sont regroupées en un vivier. Une personne présente plusieurs fois garde ses réponses les plus récentes et l'ensemble de ses statuts par session. Les anciens liens de diffusion des périodes absorbées cessent de marcher. Les jeux de test sont ensuite rechargés à la demande de l'utilisatrice.

Données personnelles : les disponibilités et les statuts par session sont couverts par `eraseParticipant`, `exportParticipantData`, `exportAccountData` et `deleteOwnAccount`. Ils suivent la durée de conservation des inscriptions. Une personne qui quitte le vivier reste visible de l'équipe selon cette même durée.

## Sécurité et droits

- Les routes d'organisation suivent [ADR-0007](../adr/ADR-0007-isolation-par-jeu.md) et sont ajoutées à `isolation.test.ts`.
- La réponse à une demande passe par le lien personnel : aucune écriture à l'ouverture d'un lien, limite de débit, et réponse identique pour un lien inconnu ou invalidé.
- Une personne ne voit que ses propres statuts, tels qu'ils lui ont été annoncés (R28).
- Un assistant d'IA suit les mêmes règles (SPEC-014) : ses outils d'inscription s'adaptent au vivier, sans donner de texte libre écrit par une personne.

## Découpage

1. Vivier unique et statut par session (R1 à R8, R14, R17 à R20, R24, R25), [EPIC-046](../epics/EPIC-046-vivier-unique/README.md).
2. Demande de disponibilités et retour sur ses réponses (R9 à R13, R15), [EPIC-047](../epics/EPIC-047-demande-de-disponibilites/README.md).
3. Casting : assistant, tirage, annonces, alertes et inscrites validées (R16, R21 à R23, R26 à R28), [EPIC-048](../epics/EPIC-048-casting-depuis-le-vivier/README.md).

## Hors périmètre

- Paiement en ligne.
- Recrutement des PNJ et de l'équipe cuisine (SPEC-001, R2).
- Envoi automatique d'un email sans clic de l'équipe.

## Historique

- 2026-11-06 : création à partir du retour A4-4 du cahier de tests.
