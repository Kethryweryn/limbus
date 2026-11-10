---
id: SPEC-018
titre: Un seul mode d'inscription, le vivier permanent
statut: implémentée
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
- **R4** L'équipe peut inviter une personne par son nom et son email à rejoindre le vivier. La personne reçoit un lien vers le questionnaire ; elle entre dans le vivier en y répondant. L'invitation peut aussi viser une session : la personne y est alors inscrite dès qu'elle a répondu en se disant disponible. Si la session est complète à ce moment, elle reste pré-inscrite et l'équipe reçoit un email. Une place n'est pas réservée à l'envoi. Si la session n'est plus à venir, ou est annulée, à sa réponse, elle entre simplement dans le vivier.
- **R5** Une personne qui quitte le vivier en sort entièrement : ses présences à venir sont annulées comme en R19. Elle y revient en remplissant de nouveau le questionnaire. L'équipe voit qu'elle est sortie.

### Sessions ouvertes et disponibilités

- **R6** Une session n'est proposée au vivier que si l'équipe l'a ouverte à la pré-inscription. Seule une session datée et à venir, ni annulée ni terminée, peut l'être : une session sans date ne peut pas s'ouvrir, et retirer la date d'une session ouverte la referme. La refermer ne retire aucune pré-inscription et le casting peut continuer, mais elle n'est plus proposée. Ces conditions se vérifient à chaque lecture : une session dont la date est passée, annulée ou terminée cesse d'être proposée et ne reçoit plus de relance, sans autre action.
- **R7** Le questionnaire ajoute une question listant les sessions ouvertes. Elle est facultative, et absente s'il n'y en a aucune. Ne cocher aucune date laisse la personne simplement intéressée. Décocher plus tard une date vaut « Pas disponible » (R29) ; une date jamais cochée reste sans réponse.
- **R8** Le nombre de places d'une session est toujours le nombre de personnages PJ du jeu. Il ne se règle pas : pour l'augmenter, on crée un personnage. On ne retient et on n'inscrit personne au-delà. Supprimer un personnage ne retire personne : la session en surnombre est signalée à l'équipe.

### Demande de disponibilités

- **R9** Quand une session est ouverte, Limbus propose d'envoyer la demande au vivier. Rien ne part sans le clic d'une organisatrice. La demande part aux personnes du vivier sans réponse ni place pour cette session, sauf les rejoueurs exclus (R24). Une personne invitée qui n'a pas encore répondu au questionnaire n'est pas encore dans le vivier (R4) : elle ne la reçoit pas.
- **R10** L'email dit clairement que c'est une demande d'intérêt et de disponibilité, donc une pré-inscription, sans place garantie ni confirmation d'inscription. Il donne la date de la session, les deux réponses, et le lien pour revoir et modifier ses réponses.
- **R11** Un bouton de l'email ouvre une page qui demande de confirmer d'un clic : ouvrir le lien ne change rien. « Disponible » la rend pré-inscrite, « Pas disponible » note sa réponse. L'équipe distingue donc un refus d'une absence de réponse. Elle peut changer de réponse avec les effets de R29.
- **R12** Un bouton « Relancer » écrit de nouveau aux seules personnes qui n'ont pas répondu pour cette session. Il indique la date de la dernière demande.
- **R13** Le lien d'un email plus ancien continue de marcher quand un nouvel email part. Si l'équipe envoie un nouveau lien à la demande d'une personne, tous les anciens cessent de marcher.

### Réponses au questionnaire

- **R14** La personne peut revoir et modifier ses réponses à tout moment tant qu'elle est dans le vivier, même castée et même vivier fermé.
- **R15** En revenant, elle voit la dernière version du questionnaire : ses anciennes réponses sont reprises, et les nouvelles questions s'ajoutent. Les nouvelles questions obligatoires ne sont exigées que si elle enregistre. Tant qu'elle ne revient pas, ses réponses restent telles quelles, avec leur version.
- **R16** Quand une personne castée ou inscrite pour une session à venir change ses réponses, chaque organisatrice du jeu reçoit un email, et un repère « réponses modifiées » apparaît sur la personne dans la sélection, jusqu'à ce qu'une organisatrice le marque comme lu. Un changement fait hors de ces cas, liste d'attente comprise, ne déclenche rien.

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
| Inscrite validée | Inscrite, et premier versement reçu, ou case « payé » cochée pour une session en mode simple. Sans rien à payer (place offerte, aucun tarif pour elle dans une session à tarifs), dès la confirmation |
| Transférée | Sur une session reportée, sa place est passée à la nouvelle session |
| Annulation | A annulé sa présence, ou a été retirée de la session |

- **R18** « Inscrite » crée le participant de session (SPEC-001, R22). « Inscrite validée » se déduit des paiements, sans saisie : retirer le seul versement la ramène à « inscrite ». Le remboursement, le transfert et le report suivent R30.
- **R19** Annuler vaut pour une seule session et laisse la personne dans le vivier. Les effets d'un désistement de SPEC-001 (R22) restent : participant retiré, personnage libéré, paiement à traiter à la main, équipe prévenue. Elle n'est plus proposée pour cette session sauf si elle s'y dit de nouveau disponible.

### Casting

- **R20** Une organisatrice peut retenir ou mettre en attente une personne pré-inscrite, ou ajouter à la main une autre personne du vivier, sans demande préalable. Une personne qui a répondu « pas disponible » peut aussi être ajoutée : l'écran le signale, et elle confirme ou non sa présence ensuite. Il faut au moins qu'elle soit dans le vivier (R31).
- **R21** L'assistant de casting propose les personnages parmi le cast, les personnes retenues et les pré-inscrits de la session. Les autres personnes du vivier n'y figurent pas tant qu'elles n'ont pas été ajoutées à la main. Enregistrer une proposition retient les pré-inscrits concernés, dans la limite des places, et leur réserve le personnage (SPEC-001, R29).
- **R22** Chaque session a son mode de sélection : à la main, au hasard, ou mixte (SPEC-001, R4). Le tirage porte sur les pré-inscrits de la session, et reste reproductible et annulable tant que rien n'est annoncé depuis (SPEC-001, R17 et R18). La priorité « non tirés avant » vise une personne restée sans place lors d'un tirage d'une session plus ancienne du jeu.
- **R23** Après un tirage, les personnes sans place vont en liste d'attente dans la limite réglée. Les autres restent pré-inscrites, sans message, et peuvent être retenues à la main. La liste d'attente suit l'ordre du tirage ou celui que fixe l'équipe, et propose la suivante quand une place se libère (SPEC-001, R19 et R21).
- **R24** Rejoueurs (SPEC-001, R7) : le réglage du vivier s'applique. Autorisé ; signalé à l'équipe ; ou exclu : la personne ne reçoit pas de demande et n'entre pas dans le tirage. L'équipe peut quand même la retenir à la main, avec un signalement.
- **R25** Alertes et affinités (SPEC-001, R25) se calculent par session, sur les personnes retenues, inscrites ou dans le cast.

### Annonces

- **R26** Une décision ne prévient personne d'elle-même. Le bouton « Annoncer le casting » d'une session écrit à toutes les personnes retenues. Une case, décochée par défaut, y ajoute les personnes en attente, sans leur rang.
- **R27** Après la première annonce d'une session, quand la situation d'une personne diffère de ce qui lui a été annoncé (ajoutée, retirée, passée en attente ou sortie de la liste d'attente), sa ligne propose un email individuel, que l'organisatrice envoie ou ignore. Une personne jamais prévenue et sortie du cast ne reçoit aucune proposition : il n'y a rien à lui annoncer. Changer seulement son personnage ne propose rien. L'échéance de confirmation (SPEC-001, R20) part de l'email envoyé.
- **R28** Tant qu'aucun email ne l'a prévenue, la personne voit ce qui lui a déjà été annoncé, sinon sa dernière réponse pour cette session.

### Refus, report et paiements

- **R29** Effet d'un « Pas disponible » pour une session, par le bouton de l'email ou une date décochée :
  - pré-inscrite : elle passe à « pas disponible » ;
  - en attente : elle sort de la file, et les suivantes avancent ;
  - retenue sans annonce : elle est retirée du cast, le personnage qui lui était réservé redevient libre, et l'équipe reçoit un email. La personne lit seulement « réponse enregistrée » : elle n'apprend pas qu'elle avait été retenue ;
  - retenue et annoncée, ou inscrite : rien ne change, la page le lui dit et la renvoie vers l'annulation (R19).

  « Disponible » rend pré-inscrite une personne sans réponse, « pas disponible » ou en annulation, sans lui rendre son rang ni sa place. Pour une personne déjà pré-inscrite, en attente, retenue ou inscrite, ce bouton ne change rien, et la page ne révèle pas une décision non annoncée.
- **R30** Paiements et places :
  - **Remboursement** : une personne à rembourser ou remboursée ne vient plus, ou la session est annulée. Sa place devient « annulation », et elle reste intéressée pour le jeu. Retirer cette marque ne lui rend pas sa place : l'équipe la retient de nouveau si elle en a encore une.
  - **Remplacement** : la personne qui part est en « annulation », et sa place passe à la remplaçante, avec ou sans ses paiements. La remplaçante vient du vivier et suit son parcours, sauf un PNJ qui reprend le rôle (R31).
  - **Report** (SPEC-004, R15 à R17) : le report crée la nouvelle session, avec l'équipe et le casting. Sur l'ancienne, une personne castée ou inscrite passe à « transférée », et garde son statut sur la nouvelle. Si elle répond qu'elle n'est pas disponible à la demande de présence, elle passe à « annulation » sur les deux. Le paiement reporté la valide sur la nouvelle session ; la rembourser ensuite la désinscrit de ce report. Les personnes seulement pré-inscrites ou en attente ne sont pas reprises : la demande de disponibilités leur écrit si l'équipe ouvre la nouvelle session.
- **R31** Un joueur ne s'ajoute plus directement au cast d'une session : il passe d'abord par le questionnaire, donc par le vivier. Les PNJ, l'équipe cuisine et les organisatrices restent ajoutés à la main, sans statut de parcours ni demande de disponibilités. Un PNJ qui reprend le rôle d'une personne qui a annulé garde ce fonctionnement ; une organisatrice aussi peut tenir un PJ ainsi. Pas la cuisine : pour jouer, elle passe par le vivier.

## Données

- **Par session et par personne** : statut, position en liste d'attente, dates de réponse, de demande, de relance, d'échéance, de confirmation et d'annulation, ce qui a été annoncé, qui a retenu, repère de réponses modifiées. Détail dans [ADR-0069](../adr/ADR-0069-vivier-unique-et-statut-par-session.md).
- **Session ouverte** : ouverture, mode de sélection et réglages du tirage. Les places se calculent (R8), elles ne sont pas stockées.
- **Liens personnels** : plusieurs par personne, gardés seulement sous forme de hash ([ADR-0070](../adr/ADR-0070-liens-personnels-durables.md)).
- **Bascule** : les périodes de chaque jeu sont regroupées en un vivier. Une personne présente plusieurs fois garde ses réponses les plus récentes et l'ensemble de ses statuts par session. Les anciens liens de diffusion des périodes absorbées cessent de marcher. Les jeux de test sont ensuite rechargés à la demande de l'utilisatrice.

Données personnelles : les disponibilités et les statuts par session sont couverts par `eraseParticipant`, `exportParticipantData`, `exportAccountData` et `deleteOwnAccount`. Ils suivent la règle d'effacement des fiches de participants (`eraseStaleParticipants`), comme leurs inscriptions. Une personne qui quitte le vivier reste visible de l'équipe selon cette même règle. La politique de confidentialité mentionne les disponibilités et les liens personnels durables.

## Sécurité et droits

- Les routes d'organisation suivent [ADR-0007](../adr/ADR-0007-isolation-par-jeu.md) et sont ajoutées à `isolation.test.ts`.
- La réponse à une demande passe par le lien personnel : aucune écriture à l'ouverture d'un lien, limite de débit, et réponse identique pour un lien inconnu ou invalidé.
- Une personne ne voit que ses propres statuts, tels qu'ils lui ont été annoncés (R28).
- Un assistant d'IA suit les mêmes règles (SPEC-014) : ses outils d'inscription s'adaptent au vivier, sans donner de texte libre écrit par une personne.

## Découpage

1. Vivier unique, statut par session et tirage par session (R1 à R8, R14, R17 à R20, R22 à R25, R29 à R31), [EPIC-046](../archive/epics/EPIC-046-vivier-unique/README.md).
2. Demande de disponibilités et retour sur ses réponses (R9 à R13, R15), [EPIC-047](../archive/epics/EPIC-047-demande-de-disponibilites/README.md).
3. Casting : assistant, annonces, alertes et inscrites validées (R16, R18, R21, R26 à R28, R30), [EPIC-048](../archive/epics/EPIC-048-casting-depuis-le-vivier/README.md).

## Hors périmètre

- Paiement en ligne.
- Recrutement des PNJ et de l'équipe cuisine (SPEC-001, R2).
- Envoi automatique d'un email sans clic de l'équipe.

## Historique

- 2026-11-06 : création à partir du retour A4-4 du cahier de tests.
- 2026-11-06 : EPIC-046 livré sauf US-176 (tout joueur passe par le questionnaire), qui suit dans sa propre PR.
- 2026-11-06 : US-176 livrée : l'onglet Cast choisit dans le vivier, ce qui retient la personne (R20), ou invite pour la session ; toute autre personne est refusée comme joueur.
- 2026-11-06 : US-175 livrée : specs et ADR renvoient vers ce qui les remplace ; EPIC-045 à EPIC-048 restent à archiver sur le feu vert de l'utilisatrice.
- 2026-11-06 : US-174 livrée : « inscrite validée » se calcule des paiements, avec les mêmes libellés pour l'équipe et la personne (R18).
- 2026-11-06 : US-173 livrée : repère « réponses modifiées » et email à l'équipe (R16).
- 2026-11-06 : US-172 livrée : annonce du casting par session, puis email proposé personne par personne (R26 à R28).
- 2026-11-06 : US-170 livrée : l'assistant de casting propose les pré-inscrits, dans la limite des places et du mode de sélection (R21).
- 2026-11-06 : EPIC-047 livré : demande de disponibilités, réponse d'un clic, relance, liens durables et dernière version du questionnaire.
- 2026-11-06 : l'ancien modèle des inscriptions est retiré de la base (seconde migration d'ADR-0069). L'export d'une personne détaille chaque session, sans décision pas encore annoncée (R28, choix de l'utilisatrice).
- 2026-11-06 (revue d'US-176, choix de l'utilisatrice) : un PNJ ou une organisatrice peut tenir un PJ sans questionnaire, pas la cuisine (R31).
- 2026-11-06 (seconde revue, choix de l'utilisatrice) : les places valent le nombre de PJ (R8) ; un joueur passe toujours par le questionnaire, et l'invitation peut viser une session (R4, R31) ; statut « transférée » au report (R30) ; un rejoueur exclu peut être retenu à la main (R24) ; le mode simple valide à la case « payé » (R17).
- 2026-11-06 (revue, choix de l'utilisatrice) : effets d'un « Pas disponible » (R29), paiements remboursés, transférés ou reportés (R30), session ouverte forcément datée (R6), alerte limitée aux personnes castées ou inscrites (R16). Pas d'entité « place » : voir ADR-0069.

- 2026-11-10 : EPIC-046 à EPIC-048 archivés ; spec implémentée. Ses règles ont leurs tests de bout en bout depuis l'US-203.
