<template>
  <LegalPage title="Politique de confidentialité">
    <p>
      Limbus sert à organiser des jeux de rôle grandeur nature (GN) : écrire un jeu, recruter ses joueurs, préparer ses sessions.
      Cette page dit quelles données y sont traitées, par qui, pourquoi et combien de temps, et comment exercer vos droits.
    </p>

    <h2>Deux responsables, selon les données</h2>
    <ul>
      <li>
        <strong>Votre compte</strong> (nom, email, mot de passe, coordonnées que vous y tenez) : le responsable est
        {{ LEGAL_EDITOR.name }}, éditeur de Limbus (<a :href="`mailto:${LEGAL_EDITOR.email}`">{{ LEGAL_EDITOR.email }}</a>).
      </li>
      <li>
        <strong>Les données des joueurs d’un jeu</strong> (fiche participant, inscription, réponses au questionnaire, affinités,
        distribution, photos, paiements, présence, notes de l’équipe) : le responsable est <strong>l’équipe qui organise ce jeu</strong>.
        Elle décide de ce qu’elle collecte et pourquoi. Limbus les héberge et les traite pour elle, comme sous-traitant, et ne s’en sert pour rien d’autre.
      </li>
    </ul>

    <h2>Données traitées et finalités</h2>
    <ul>
      <li><strong>Compte</strong> : nom, email, mot de passe (jamais en clair), date d’acceptation des conditions, et la date de votre dernière connexion. Pour vous connecter, organiser vos jeux et participer à ceux des autres.</li>
      <li><strong>Coordonnées</strong>, si vous les donnez : téléphone, contact d’urgence, régime alimentaire et allergies. Elles sont transmises aux équipes de vos jeux, pour l’organisation, votre sécurité et les repas.</li>
      <li><strong>Inscription à un jeu</strong> : identité, coordonnées, réponses au questionnaire de l’équipe, personnes avec qui vous voulez jouer ou non, disponibilités. Pour la sélection et la distribution des rôles.</li>
      <li><strong>Photos</strong> ajoutées par l’équipe : pour le trombinoscope de la session. Le formulaire et les emails précisent leur usage et leur durée.</li>
      <li><strong>Paiements</strong> : montants, dates et remboursements notés par l’équipe, et le RIB que l’équipe dépose pour être payée, transmis aux joueurs de la session. Limbus ne traite aucun paiement en ligne et ne connaît aucune carte bancaire.</li>
      <li><strong>Emails envoyés</strong> par l’équipe (documents, fiches, trombinoscopes) : une copie est gardée pour que vous la retrouviez dans « Je participe ».</li>
    </ul>

    <h2>Bases légales</h2>
    <ul>
      <li>Compte : l’exécution des <NuxtLink to="/conditions">conditions d’utilisation</NuxtLink> que vous acceptez.</li>
      <li>Allergies et régime alimentaire, qui peuvent révéler votre santé : votre consentement explicite, demandé dans le formulaire et retirable à tout moment.</li>
      <li>Données des joueurs : la base choisie par l’équipe du jeu, en général l’exécution de votre inscription.</li>
      <li>Sécurité du service (limites de tentatives, journaux techniques) : l’intérêt légitime de protéger Limbus et ses utilisateurs.</li>
    </ul>

    <h2>Qui voit vos données</h2>
    <ul>
      <li>L’équipe de chaque jeu auquel vous participez (propriétaire et co-organisatrices), pour ce jeu seulement. Une équipe ne voit pas les données d’une autre.</li>
      <li>Les joueurs de votre session, pour le trombinoscope : le nom de votre personnage et, si l’équipe l’a ajoutée, votre photo.</li>
      <li>L’hébergeur, {{ LEGAL_HOST.name }}, en France, et le serveur d’envoi d’emails utilisé par Limbus.</li>
    </ul>
    <p>Aucune donnée n’est vendue, ni utilisée pour de la publicité ou de la mesure d’audience.</p>

    <h2>Durées de conservation</h2>
    <ul>
      <li>Compte : tant que vous l’utilisez. Après {{ RETENTION.inactiveAccountMonths }} mois sans connexion, il est effacé ; un email vous prévient un mois avant, et une connexion suffit à le garder.</li>
      <li>Compte créé mais jamais confirmé : {{ RETENTION.unconfirmedAccountDays }} jours.</li>
      <li>Formulaire d’inscription jamais confirmé : {{ RETENTION.unconfirmedFormDays }} jours.</li>
      <li>Fiche participant sans compte : effacée {{ RETENTION.participantWithoutAccountYears }} ans après sa dernière activité (dernière session ou dernière inscription), ou avant si l’équipe l’efface.</li>
      <li>Photos : supprimées après le délai choisi par l’équipe du jeu (6 mois après la session par défaut).</li>
      <li>Copies des emails envoyés : effacées après la session.</li>
    </ul>

    <h2>Vos droits</h2>
    <p>
      Vous pouvez accéder à vos données, les corriger, les faire effacer, en limiter l’usage, vous y opposer et les récupérer.
      Depuis votre compte, vous pouvez tenir vos coordonnées, télécharger toutes vos données, retirer vos photos et effacer votre compte.
      Pour les données qu’une équipe tient sur vous, adressez-vous à elle ; à défaut, ou pour toute autre demande,
      écrivez à <a :href="`mailto:${LEGAL_EDITOR.email}`">{{ LEGAL_EDITOR.email }}</a>.
    </p>
    <p>
      Si vous estimez que vos droits ne sont pas respectés, vous pouvez saisir la CNIL (<a href="https://www.cnil.fr">www.cnil.fr</a>).
    </p>

    <h2>Cookies et données sur votre appareil</h2>
    <ul>
      <li>Limbus n’utilise que les cookies nécessaires à la connexion : celui de votre session (20 heures) et, pour l’administratrice, celui du mode administration (2 heures). Aucun cookie de mesure d’audience ni de publicité : aucun consentement n’est donc demandé.</li>
      <li>Pour fonctionner sans réseau sur le lieu du jeu, l’application garde une copie des pages consultées dans votre navigateur. Elle est effacée à la déconnexion.</li>
    </ul>

    <h2>Sécurité</h2>
    <p>
      Les échanges sont chiffrés (HTTPS), les mots de passe sont stockés sous forme d’empreinte, et chaque équipe n’accède qu’à ses propres jeux.
    </p>

    <h2>Changements</h2>
    <p>Cette politique peut évoluer. La date de version figure en haut de la page ; un changement important vous sera présenté à votre prochaine connexion.</p>
  </LegalPage>
</template>

<script setup>
import { LEGAL_EDITOR, LEGAL_HOST, RETENTION } from '~/utils/legal'

useHead({ title: 'Confidentialité – Limbus' })
</script>
