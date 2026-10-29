---
id: SPEC-006
titre: Envois d'emails et suivi des paiements
statut: validée
date: 2026-10-29
origine: ../todo/documentation-de-l-existant.md
epics: []
adr: [ADR-0004, ADR-0008]
---

# SPEC-006 : Envois d'emails et suivi des paiements

Cette spec décrit un comportement déjà en production, avant la reprise du développement ([Documentation de l'existant](../todo/documentation-de-l-existant.md)). Elle n'a ni epic ni US. Les écarts constatés entre le code et l'intention sont listés à la fin, sans être corrigés.

## Objectif

Remettre à chaque personne d'une session ce qui la concerne, par email : documents du jeu, fiche de personnage, trombinoscope, demande de paiement. Suivre qui a reçu quoi et qui a payé, pour savoir à qui il reste à écrire.

## Vocabulaire

- **Envoi** : un email parti à une personne pour une session, noté avec sa date. Un envoi est d'un des types suivants : document, fiche de personnage, trombinoscope, ou fiche et trombinoscope ensemble.
- **Destinataires manquants** : les personnes visées qui n'ont pas encore reçu l'envoi.
- **Email de test** : un aperçu envoyé à des adresses choisies par l'organisatrice. Il n'est pas noté comme un envoi.
- **Tableau des paiements** : la liste des personnes d'une session qui doivent payer, avec leur état.

## Acteurs

- **Administratrice** : configure le serveur d'envoi (SMTP) de toute l'application.
- **Organisatrice** : propriétaire ou co-organisatrice du jeu ([SPEC-003](SPEC-003-ecriture-d-un-jeu.md), R16). Elle envoie les emails et suit les paiements des sessions du jeu.
- **Participant** : reçoit les emails. Il n'a pas de compte : tout ce qui lui est destiné part en pièce jointe.

## Parcours

### Configurer l'envoi

1. Dans l'administration, l'administratrice saisit le serveur SMTP, le port, le chiffrement, l'identifiant, le mot de passe et l'expéditeur, puis active l'envoi.
2. Elle s'envoie un email de test pour vérifier la configuration.

### Envoyer les documents d'une session

1. Dans l'onglet Documents de la session, l'organisatrice voit chaque document du jeu, avec ses destinataires dans cette session et ce qui leur a déjà été envoyé.
2. Elle peut s'envoyer un email de test pour un document ou une fiche.
3. Elle envoie un document, les fiches, les trombinoscopes, ou les fiches et trombinoscopes ensemble, aux destinataires manquants, après une confirmation.

### Suivre les paiements

1. Dans l'onglet Paiements, elle téléverse le RIB (un PDF) ou indique son lien, et le lien de paiement.
2. Elle envoie la demande de paiement aux personnes qui n'ont pas payé, toutes ou une seule. Un nouvel envoi à quelqu'un qui a déjà reçu la demande est une relance.
3. Elle valide le paiement de chaque personne à réception, ou annule cette validation.

## Règles métier

### Configuration et envoi

- **R1** Un seul serveur SMTP sert toute l'application, et seule l'administratrice le configure. Tant que l'envoi est désactivé, aucun email ne part : un envoi qui a des destinataires, et tout test, est refusé. Un envoi sans destinataire manquant répond simplement que rien n'est parti.
- **R2** Le mot de passe SMTP est chiffré en base, avec un secret lu à l'exécution ([ADR-0004](../adr/ADR-0004-secrets-a-l-execution.md)). Il n'est jamais renvoyé à l'interface, qui sait seulement s'il est renseigné. Le laisser vide conserve l'ancien.
- **R3** La connexion au serveur SMTP a des délais bornés. Un échec est noté dans le journal du serveur, sans destinataire ni contenu, et l'interface reçoit un message qui en donne la cause probable (authentification, connexion, refus du serveur). Pour les demandes de paiement, un échec à l'ouverture de la connexion (configuration incomplète, mot de passe indéchiffrable) ne donne que « SMTP désactivé ou mal configuré ».
- **R4** Une personne sans adresse email est ignorée par les envois, sans erreur.
- **R5** Un seul envoi à la fois par session : un deuxième, lancé pendant le premier (double clic, deuxième onglet), est refusé. Chaque type d'envoi est aussi limité à 10 par organisatrice et par session en 10 minutes, et les emails de test d'une session à 20 en 15 minutes. Le test SMTP de l'administration n'est pas limité.
- **R6** Un email de test part à 1 à 10 adresses, avec un contenu « [Test] » et les mêmes pièces jointes que le vrai. Il ne compte pas comme un envoi.

### Documents, fiches et trombinoscopes

- **R7** Les destinataires d'un document dans une session dépendent de son audience ([SPEC-003](SPEC-003-ecriture-d-un-jeu.md), R11) :
  - tout le monde : les personnes castées, les organisateurs, les PNJ et la cuisine de la session, chacun une seule fois ;
  - organisateurs, PNJ ou cuisine : les membres de l'équipe qui ont ce rôle ;
  - ciblage manuel : les personnes qui jouent dans la session le personnage choisi, les personnages ciblés ou les membres des factions ciblées. Un personnage sans participant dans la session n'a pas de destinataire.
- **R8** Seul un document marqué « prêt à envoyer » peut être envoyé. Le test, lui, est toujours possible.
- **R9** L'email d'un document reprend son contenu et son lien externe, avec le PDF du document en pièce jointe ([SPEC-005](SPEC-005-trombinoscopes-et-pdf.md), R12).
- **R10** Les fiches partent aux personnes castées dont le personnage, PJ ou PNJ, est « prêt à envoyer », avec le PDF de la fiche ([SPEC-005](SPEC-005-trombinoscopes-et-pdf.md), R11). Les trombinoscopes partent aux personnes dont le trombinoscope a été généré, avec son PDF.
- **R11** L'envoi groupé « fiches et trombis » part aux personnes dont la fiche est prête et le trombinoscope généré, et qui n'ont pas déjà reçu les deux. Il note à la fois la fiche, le trombinoscope et l'ensemble comme envoyés. Une personne qui a reçu fiche et trombinoscope séparément compte comme ayant reçu l'ensemble.
- **R12** Chaque envoi ne part qu'aux destinataires manquants. Un document, une fiche ou un trombinoscope déjà reçu n'est plus renvoyé à la même personne par son propre envoi (voir les écarts). Seule exception, l'envoi groupé (R11) : à une personne qui n'a reçu que la fiche ou que le trombinoscope, il renvoie les deux.
- **R13** Un échec d'envoi à une personne arrête l'envoi en cours : les emails déjà partis restent notés, les suivants ne partent pas (voir les écarts).

### Paiements

- **R14** Le tableau des paiements liste les personnes qui jouent un personnage PJ ou PNJ dans la session, les inscrits confirmés sans personnage (« personnage à attribuer ») et les membres de rôle PNJ, même sans personnage ([SPEC-001](SPEC-001-inscriptions.md), R22). La cuisine et les organisateurs sans personnage n'y sont pas.
- **R15** Un paiement est « payé » avec sa date, ou « non payé ». L'organisatrice le valide ou annule la validation à la main ; seules les personnes du tableau peuvent l'être. Il n'y a ni montant, ni tarif, ni moyen de paiement (voir les écarts).
- **R16** Un paiement reçu d'une personne qui n'est plus dans le tableau (désistement, rôle retiré) reste affiché à part, hors du décompte et des envois, pour être remboursé ou gardé à la main.
- **R17** La demande de paiement part aux personnes du tableau qui n'ont pas payé. Elle donne le nom de la session et du jeu, le lien de paiement et le lien du RIB s'ils existent ; un RIB téléversé est joint en PDF.
- **R18** La première demande est un « Paiement ». Tout envoi suivant à la même personne est une « Relance », avec une autre formule. Le tableau garde la date de la première demande et celle de la dernière relance.
- **R19** Un échec d'envoi à une personne n'arrête pas les autres : les personnes qui n'ont rien reçu sont listées. Si aucun email n'est parti, l'envoi est en erreur.
- **R20** Le RIB est un PDF (signature vérifiée, 10 Mo au plus) rattaché à la session, ou un lien http(s). Remplacé ou retiré, l'ancien fichier est supprimé ([ADR-0008](../adr/ADR-0008-fichiers-televerses.md)).

## Données

- `SmtpSettings` : une seule ligne pour toute l'application.
- `SessionDocumentDelivery` : un envoi (session, participant, type, document ou personnage, date).
- `SessionPayment` : l'état du paiement d'un participant pour une session (date de paiement, de la première demande, de la dernière relance).
- `Session.paymentRibUrl` et `Session.paymentLinkUrl`.
- Envois et paiements sont des données personnelles du participant : ils sont couverts par l'export et la suppression RGPD (`participantPrivacy.ts`), décrits dans [SPEC-007](SPEC-007-participants-et-rgpd.md). Ils sont supprimés avec la session ([SPEC-004](SPEC-004-sessions.md), R3), sans proposer de remboursement, et avec le participant. Un envoi est aussi supprimé avec son document ou son personnage : leur historique d'envoi disparaît.
- Le contenu des emails n'est pas conservé.

## Sécurité et droits

- **R21** Envoyer, tester, suivre les paiements et téléverser le RIB demandent l'accès au jeu de la session. Le RIB n'est lu que par une route qui vérifie ces droits, jamais en statique ; il part aux participants en pièce jointe, jamais en lien vers l'API.
- **R22** Configurer et tester le serveur SMTP est réservé à l'administratrice.

## Hors périmètre

- Emails des inscriptions (invitation, confirmation, relance) : [SPEC-001](SPEC-001-inscriptions.md).
- Emails de legs : [SPEC-002](SPEC-002-copie-de-jeu.md).
- Invitations à co-organiser et comptes : [SPEC-008](SPEC-008-comptes-et-partage.md).
- Paiement en ligne : Limbus donne un lien, mais n'encaisse rien.
- Remboursement d'une session annulée ou reportée : fiche [Cycle de vie d'une session](../todo/cycle-de-vie-d-une-session.md).

## Écarts constatés

Relevés le 29 octobre 2026 avec l'utilisatrice. Aucun n'est corrigé ici.

1. **Renvoi (R12)** : il faut pouvoir renvoyer la version à jour d'un document, d'une fiche ou d'un trombinoscope, par exemple après une correction ou après la régénération des trombinoscopes qui suit un désistement. Aujourd'hui, une personne qui a reçu un envoi n'est plus jamais destinataire de ce type d'envoi.
2. **Échecs d'envoi (R13)** : la règle voulue est celle des paiements (R19) : continuer avec les personnes suivantes, et lister celles qui n'ont rien reçu. Pour les documents, fiches et trombinoscopes, un échec arrête tout l'envoi, et l'interface ne dit pas qui a déjà reçu.
3. **Montant (R15)** : un tarif, par session ou par personne, et le montant reçu devraient apparaître, dans le tableau comme dans l'email. Il faut aussi pouvoir noter un paiement partiel, et relancer la personne pour le reste dû.
