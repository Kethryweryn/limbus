<template>
  <LegalPage title="Mentions légales">
    <h2>Éditeur</h2>
    <p>
      Limbus ({{ LEGAL_EDITOR.site }}) est édité par {{ LEGAL_EDITOR.name }}, à titre de {{ LEGAL_EDITOR.status }}.
      Contact : <a :href="`mailto:${LEGAL_EDITOR.email}`">{{ LEGAL_EDITOR.email }}</a>.
    </p>

    <h2>Directeur de la publication</h2>
    <p>{{ LEGAL_EDITOR.name }}.</p>

    <h2>Hébergeur</h2>
    <p>
      {{ LEGAL_HOST.name }}, {{ LEGAL_HOST.description }}, {{ LEGAL_HOST.address }}
      (<a :href="LEGAL_HOST.site">{{ LEGAL_HOST.site }}</a>).
    </p>

    <h2>Contenus</h2>
    <p>
      Les jeux, personnages, documents et images publiés dans Limbus appartiennent aux équipes qui les y mettent.
      Pour signaler un contenu illicite, écrivez à <a :href="`mailto:${LEGAL_EDITOR.email}`">{{ LEGAL_EDITOR.email }}</a>.
    </p>

    <h2>Données personnelles</h2>
    <p>Voir la <NuxtLink to="/confidentialite">politique de confidentialité</NuxtLink>.</p>
  </LegalPage>
</template>

<script setup lang="ts">
import { LEGAL_EDITOR, LEGAL_HOST } from '~/utils/legal'

useHead({ title: 'Mentions légales – Limbus' })
</script>
