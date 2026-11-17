<template>
  <AccessCard title="Activer mon compte" subtitle="Choisissez le nom que verront vos équipes et votre mot de passe.">
    <form class="space-y-4" novalidate @submit.prevent="save">
      <UFormField label="Nom" :error="fieldErrors.name">
        <UInput v-model="form.name" autocomplete="name" class="w-full" />
      </UFormField>
      <UFormField label="Mot de passe" help="8 caractères au moins." :error="fieldErrors.password">
        <PasswordInput v-model="form.password" autocomplete="new-password" class="w-full" />
      </UFormField>
      <UFormField label="Confirmation">
        <PasswordInput v-model="confirmation" autocomplete="new-password" class="w-full" />
      </UFormField>
      <!-- Conditions d'utilisation (US-111) -->
      <UCheckbox v-model="form.termsAccepted">
        <template #label>
          J’accepte les <NuxtLink to="/conditions" target="_blank" class="text-primary underline">conditions d’utilisation</NuxtLink>
          et j’ai lu la <NuxtLink to="/confidentialite" target="_blank" class="text-primary underline">politique de confidentialité</NuxtLink>
        </template>
      </UCheckbox>
      <UButton type="submit" color="primary" size="lg" block :loading="saving">
        Activer et me connecter
      </UButton>
      <UAlert v-if="error" color="error" variant="soft" :description="error" />
      <p v-if="offerNewLink" class="text-sm text-center">
        <NuxtLink to="/acces/activer" class="text-primary hover:underline">Demander un nouveau lien</NuxtLink>
      </p>
    </form>
  </AccessCard>
</template>

<script setup lang="ts">
// Lien d'activation (US-246, SPEC-022 R9, R11) : nom, mot de passe et conditions ; le compte part vide, chaque équipe
// garde ses coordonnées. Le lien expiré ou déjà utilisé le dit, et propose d'en demander un autre
import { isValidationError } from '~/utils/apiErrors'

definePageMeta({ layout: false })

const route = useRoute()
const form = ref({ name: '', password: '', termsAccepted: false })
const confirmation = ref('')
const saving = ref(false)
const error = ref('')
// Après un refus du serveur (lien expiré, déjà utilisé, compte déjà activé…), un nouveau lien est toujours possible
const offerNewLink = ref(false)
const { fieldErrors, report, reset } = useFieldErrors(['name', 'password'])

async function save() {
  error.value = ''
  reset()
  offerNewLink.value = false
  if (form.value.password !== confirmation.value) {
    error.value = 'Les deux mots de passe ne correspondent pas.'
    return
  }
  saving.value = true
  try {
    await $fetch('/api/auth/activate', { method: 'POST', body: { ...form.value, token: String(route.params.token || '') } })
    window.location.replace('/participer')
  } catch (err) {
    error.value = report(err, 'Impossible d’activer le compte.')
    // Une saisie à corriger (nom, conditions…) n'est pas un lien périmé ou déjà utilisé
    offerNewLink.value = !isValidationError(err)
  } finally {
    saving.value = false
  }
}
</script>
