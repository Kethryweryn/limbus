<template>
  <LegalPage title="Conditions d’utilisation">
    <h2>1. Objet</h2>
    <p>
      Limbus est un outil en ligne pour organiser des jeux de rôle grandeur nature : écrire un jeu, recruter ses joueurs, préparer
      et suivre ses sessions. Il est édité par {{ LEGAL_EDITOR.name }} (voir les <NuxtLink to="/mentions-legales">mentions légales</NuxtLink>).
      Créer un compte vaut acceptation de ces conditions.
    </p>

    <h2>2. Le service</h2>
    <p>
      Limbus est fourni gratuitement, tel quel, sans garantie de disponibilité ni de conservation de vos données au-delà de ce que
      décrit la <NuxtLink to="/confidentialite">politique de confidentialité</NuxtLink>. Il peut être interrompu pour maintenance,
      évoluer ou fermer. En cas de fermeture prévue, les comptes seront prévenus à l’avance, pour que chacun puisse télécharger ses données.
    </p>

    <h2>3. Votre compte</h2>
    <ul>
      <li>Vous donnez une adresse email qui est la vôtre et la confirmez.</li>
      <li>Vous gardez votre mot de passe pour vous. Toute action faite depuis votre compte est réputée faite par vous.</li>
      <li>Vous pouvez effacer votre compte à tout moment depuis la page « Mon compte ».</li>
    </ul>

    <h2>4. Les équipes et les données de leurs joueurs</h2>
    <p>
      Quand vous organisez un jeu, vous êtes responsable des données des personnes que vous y inscrivez ou qui s’y inscrivent ;
      Limbus les traite pour vous, sur vos instructions. En particulier, vous vous engagez à :
    </p>
    <ul>
      <li>ne collecter que ce qui sert à l’organisation de votre jeu ;</li>
      <li>informer vos joueurs de l’usage de leurs données (Limbus affiche une information sur les photos dans ses formulaires et ses emails) ;</li>
      <li>ne demander d’informations de santé (allergies, régime) qu’avec le consentement de la personne, que le formulaire recueille ;</li>
      <li>répondre aux demandes de vos joueurs sur leurs données (accès, correction, effacement) ;</li>
      <li>
        si vous branchez un assistant d’IA sur un jeu, vous décidez de transmettre à son fournisseur ce que Limbus lui ouvre
        (contenu du jeu, noms des participants, vos notes, réponses aux questions à choix) : vous en portez la base légale et en
        informez vos joueurs ;
      </li>
      <li>ne pas utiliser Limbus pour envoyer des messages sans rapport avec vos jeux.</li>
    </ul>
    <p>
      Limbus garde ces données confidentielles, ne les utilise que pour vous rendre le service, et vous permet de les exporter et de les effacer.
    </p>

    <h2>5. Contenus</h2>
    <p>
      Vous restez propriétaire de ce que vous mettez dans Limbus et garantissez en avoir le droit. Sont interdits les contenus illicites,
      notamment ceux qui portent atteinte aux droits d’autrui (vie privée, droit à l’image, droits d’auteur), ainsi que les
      contenus haineux ou violents envers des personnes réelles. Un contenu signalé et manifestement illicite peut être retiré.
    </p>

    <h2>6. Suspension et effacement</h2>
    <p>
      Un compte qui ne respecte pas ces conditions peut être désactivé, après un avertissement sauf urgence.
      Un compte inutilisé pendant longtemps est effacé, comme le décrit la politique de confidentialité.
    </p>

    <h2>7. Changements</h2>
    <p>
      Ces conditions peuvent évoluer. Une nouvelle version vous est présentée à votre connexion suivante, et vous l’acceptez pour continuer
      à utiliser Limbus. Si vous la refusez, vous pouvez télécharger vos données et effacer votre compte.
    </p>

    <h2>8. Droit applicable et contact</h2>
    <p>
      Ces conditions relèvent du droit français. Pour toute question ou réclamation, écrivez à
      <a :href="`mailto:${LEGAL_EDITOR.email}`">{{ LEGAL_EDITOR.email }}</a> ; nous chercherons une solution amiable avant toute autre démarche.
    </p>
  </LegalPage>
</template>

<script setup lang="ts">
import { LEGAL_EDITOR } from '~/utils/legal'

useHead({ title: 'Conditions d’utilisation – Limbus' })
</script>
