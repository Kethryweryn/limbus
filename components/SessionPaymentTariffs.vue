<template>
  <!-- Tarifs de la session (US-031, US-033 ; découpé de SessionPaymentsManager, US-116) -->
  <section class="space-y-3 rounded border border-gray-200 p-4">
    <div class="flex flex-wrap items-center justify-between gap-2">
      <h3 class="font-medium">Tarifs</h3>
      <UBadge color="neutral" variant="subtle" size="xs">
        {{ tariffMode ? 'Montants calculés' : 'Mode simple : case « payé »' }}
      </UBadge>
    </div>
    <p v-if="!tariffMode" class="text-sm text-gray-500">
      Sans tarif, on coche simplement qui a payé. Créez un tarif pour suivre les montants, les versements et les places solidaires.
    </p>
    <ul v-if="tariffs.length" class="space-y-1 text-sm">
      <li v-for="tariff in tariffs" :key="tariff.id" class="flex flex-wrap items-center justify-between gap-2 border-t border-gray-100 pt-1">
        <span>
          <span class="font-medium">{{ tariff.name }}</span> · {{ formatEuros(tariff.amountCents) }}
          <span v-if="tariff.defaultRole" class="text-gray-500"> · par défaut : {{ TARIFF_ROLE_LABELS[tariff.defaultRole] }}</span>
          <span v-if="tariff.baseTariffId" class="text-gray-500"> · {{ solidarityLabel(tariff) }}</span>
        </span>
        <span class="flex gap-1">
          <UButton color="neutral" variant="ghost" size="xs" @click="editTariff(tariff)">Modifier</UButton>
          <UButton color="error" variant="ghost" size="xs" :loading="deletingTariffId === tariff.id" @click="deleteTariff(tariff)">Supprimer</UButton>
        </span>
      </li>
    </ul>
    <form class="grid grid-cols-1 md:grid-cols-[1fr_8rem_10rem_12rem_auto] gap-2 items-end" @submit.prevent="saveTariff">
      <UFormField :label="tariffForm.id ? 'Modifier le tarif' : 'Nouveau tarif'">
        <UInput v-model="tariffForm.name" placeholder="PJ, PNJ, réduit, soutien…" />
      </UFormField>
      <UFormField label="Montant (€)">
        <UInput v-model="tariffForm.amount" type="number" min="0" step="0.01" />
      </UFormField>
      <UFormField label="Par défaut pour">
        <USelect v-model="defaultRoleModel" :items="defaultRoleOptions" value-key="value" />
      </UFormField>
      <UFormField label="Tarif de base (solidaire)">
        <USelect v-model="baseTariffModel" :items="baseTariffOptions" value-key="value" />
      </UFormField>
      <div class="flex gap-1">
        <UButton type="submit" color="primary" variant="soft" :loading="savingTariff" :disabled="!tariffForm.name.trim() || tariffForm.amount === ''">
          {{ tariffForm.id ? 'Enregistrer' : 'Ajouter' }}
        </UButton>
        <UButton v-if="tariffForm.id" color="neutral" variant="ghost" @click="resetTariffForm">Annuler</UButton>
      </div>
    </form>
  </section>
</template>

<script setup lang="ts">
import { TARIFF_ROLE_LABELS, formatEuros } from '~/utils/sessionTariffs'
import { noneOption, selectModel } from '~/utils/selectOptions'
import { useSessionPaymentActions, type PaymentTariff } from '~/composables/useSessionPaymentActions'

const { tariffMode, tariffs, write } = useSessionPaymentActions()

const defaultRoleOptions = [
  noneOption('Aucun rôle'),
  ...Object.entries(TARIFF_ROLE_LABELS).map(([value, label]) => ({ label, value }))
]
const emptyTariffForm = () => ({ id: '', name: '', amount: '', defaultRole: '', baseTariffId: '', updatedAt: '' })
const tariffForm = reactive(emptyTariffForm())
const defaultRoleModel = selectModel(() => tariffForm.defaultRole, (value) => { tariffForm.defaultRole = value })
const baseTariffModel = selectModel(() => tariffForm.baseTariffId, (value) => { tariffForm.baseTariffId = value })
const savingTariff = ref(false)
const deletingTariffId = ref('')
const baseTariffOptions = computed(() => [
  noneOption('Aucun (tarif normal)'),
  ...tariffs.value
    .filter((tariff) => tariff.id !== tariffForm.id && !tariff.baseTariffId)
    .map((tariff) => ({ label: `${tariff.name} (${formatEuros(tariff.amountCents)})`, value: tariff.id }))
])

// Tarif solidaire : écart avec son tarif de base (US-033)
function solidarityLabel(tariff: PaymentTariff) {
  const base = tariffs.value.find((item) => item.id === tariff.baseTariffId)
  if (!base) return ''
  const difference = tariff.amountCents - base.amountCents
  return difference >= 0
    ? `soutien : +${formatEuros(difference)} par rapport à ${base.name}`
    : `réduit : ${formatEuros(difference)} par rapport à ${base.name}`
}

function resetTariffForm() {
  Object.assign(tariffForm, emptyTariffForm())
}

function editTariff(tariff: PaymentTariff) {
  Object.assign(tariffForm, {
    id: tariff.id,
    name: tariff.name,
    amount: String(tariff.amountCents / 100),
    defaultRole: tariff.defaultRole || '',
    baseTariffId: tariff.baseTariffId || '',
    updatedAt: tariff.updatedAt
  })
}

async function saveTariff() {
  savingTariff.value = true
  try {
    const saved = await write(tariffForm.id ? `tariffs/${tariffForm.id}` : 'tariffs', tariffForm.id ? 'PUT' : 'POST', {
      name: tariffForm.name,
      amount: Number(tariffForm.amount),
      defaultRole: tariffForm.defaultRole || null,
      baseTariffId: tariffForm.baseTariffId || null,
      ...(tariffForm.id && { updatedAt: tariffForm.updatedAt })
    })
    if (saved) resetTariffForm()
  } finally {
    savingTariff.value = false
  }
}

async function deleteTariff(tariff: PaymentTariff) {
  if (!confirm(`Supprimer le tarif « ${tariff.name} » ? Les personnes qui l’avaient reprennent le tarif de leur rôle.`)) return
  deletingTariffId.value = tariff.id
  try {
    if (await write(`tariffs/${tariff.id}`, 'DELETE') && tariffForm.id === tariff.id) resetTariffForm()
  } finally {
    deletingTariffId.value = ''
  }
}
</script>
