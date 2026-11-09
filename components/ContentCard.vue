<template>
  <!-- Carte d'une liste qui ouvre sa fiche (US-179, US-197) : un clic sur la carte, ou Entrée quand elle a le focus.
       Entrée sur un de ses boutons ne l'ouvre pas (.self) ; un bouton arrête son clic par @click.stop -->
  <UCard
    class="cursor-pointer transition-shadow hover:shadow-md"
    role="link"
    tabindex="0"
    @click="open"
    @keydown.enter.self="open"
  >
    <template v-if="$slots.header" #header>
      <slot name="header" />
    </template>
    <slot />
  </UCard>
</template>

<script setup lang="ts">
const props = defineProps<{ to: string }>()
// Avant la navigation, pour une liste qui retient d'où l'on vient (documents)
const emit = defineEmits<{ open: [] }>()
const router = useRouter()

function open() {
  emit('open')
  void router.push(props.to)
}
</script>
