<template>
    <UCard class="w-full">
        <template #header>
            {{ mode === 'edit' ? 'Modifier le personnage' : 'Créer un nouveau personnage' }}
        </template>

        <form @submit.prevent="submit" class="w-full space-y-6">
            <UFormField label="Jeu" :error="errors.gameId">
                <USelect v-model="localCharacter.gameId"
                    :items="props.games.map(g => ({ label: g.title, value: g.id }))" value-key="value" placeholder="Choisissez un jeu"
                    required size="lg" class="w-full" />
            </UFormField>

            <UFormField label="Nom" :error="errors.name">
                <UInput v-model="localCharacter.name" required autofocus size="lg" class="w-full" />
            </UFormField>

            <UFormField label="Type">
                <USelect
                    v-model="localCharacter.type"
                    :items="characterTypeOptions"
                    value-key="value"
                    size="lg"
                    class="w-full"
                />
            </UFormField>

            <UFormField v-if="factionOptions.length" label="Groupes">
                <USelectMenu
                    v-model="localCharacter.factionIds"
                    :items="factionOptions"
                    value-key="value"
                    multiple
                    placeholder="Associer des groupes"
                    size="lg"
                    class="w-full"
                />
            </UFormField>

            <UFormField label="Pitch" :error="errors.pitch">
                <UTextarea
                    v-model="localCharacter.pitch"
                    :rows="5"
                    size="lg"
                    class="w-full"
                    placeholder="Texte court envoyé aux participants lors de l’attribution du personnage."
                />
            </UFormField>

            <UFormField label="Background" :error="errors.background">
                <UTextarea
                    v-model="localCharacter.background"
                    :rows="18"
                    size="lg"
                    class="w-full font-mono text-sm"
                    placeholder="Histoire complète du personnage."
                />
            </UFormField>

            <UFormField label="Lien vers un background externe" :error="errors.backgroundDocumentUrl">
                <UInput
                    v-model="localCharacter.backgroundDocumentUrl"
                    type="url"
                    size="lg"
                    class="w-full"
                    placeholder="Google Docs, PDF, DOCX ou ODT hébergé ailleurs"
                />
            </UFormField>

            <UCheckbox
                v-model="localCharacter.sheetReadyToSend"
                label="Fiche prête à être envoyée"
                description="Décochez pour repasser la fiche en brouillon."
            />

            <UCard variant="outline" class="bg-gray-50">
                <template #header>
                    Options de trombinoscope
                </template>

                <div class="space-y-4">
                    <UCheckbox
                        v-model="localCharacter.excludeFromTrombinoscope"
                        label="Ne jamais inclure ce personnage dans un trombinoscope"
                    />
                    <UCheckbox
                        v-model="localCharacter.trombinoscopeFaceHidden"
                        label="Personne ne connaît son visage"
                        description="Sa photo sera remplacée par un point d’interrogation par défaut."
                    />
                    <UFormField label="Photo de trombinoscope par défaut" :error="errors.trombinoscopePhotoUrl">
                        <div class="flex flex-col gap-2 sm:flex-row">
                            <UInput
                                v-model="localCharacter.trombinoscopePhotoUrl"
                                type="url"
                                size="lg"
                                class="w-full"
                                placeholder="URL ou photo téléversée utilisée à la place de la photo de session"
                            />
                            <input
                                ref="trombinoscopePhotoInput"
                                type="file"
                                accept="image/png,image/jpeg,image/webp"
                                class="hidden"
                                @change="uploadTrombinoscopePhoto"
                            >
                            <UButton
                                type="button"
                                color="neutral"
                                variant="soft"
                                icon="i-heroicons-photo"
                                :loading="uploadingTrombinoscopePhoto"
                                @click="trombinoscopePhotoInput?.click()"
                            >
                                Photo
                            </UButton>
                        </div>
                    </UFormField>
                    <UFormField label="Fausse identité par défaut">
                        <UInput
                            v-model="localCharacter.trombinoscopeDisplayName"
                            size="lg"
                            class="w-full"
                            placeholder="Nom affiché dans les trombinoscopes"
                        />
                    </UFormField>
                    <UFormField label="Note de trombinoscope par défaut">
                        <UTextarea
                            v-model="localCharacter.trombinoscopeNote"
                            :rows="3"
                            size="lg"
                            class="w-full"
                        />
                    </UFormField>
                </div>
            </UCard>

            <UFormField label="Indications costumes" :error="errors.costumeIndications">
                <UTextarea
                    v-model="localCharacter.costumeIndications"
                    :rows="5"
                    size="lg"
                    class="w-full"
                />
            </UFormField>

            <div class="flex flex-wrap gap-2 pt-2">
                <UButton type="submit" color="primary" size="lg" :disabled="!localCharacter.name?.trim() || !localCharacter.gameId">
                    {{ mode === 'edit' ? 'Enregistrer' : 'Créer' }}
                </UButton>
                <UButton @click="$emit('cancel')" color="neutral" size="lg">
                    Annuler
                </UButton>
            </div>

            <p v-if="serverError" class="text-red-500 text-sm mt-2">{{ serverError }}</p>
        </form>
    </UCard>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { CHARACTER_TYPE_OPTIONS, CHARACTER_TYPES } from '~/utils/domain'

const props = defineProps({
    character: { type: Object, required: true },
    games: { type: Array, required: true },
    factions: { type: Array, default: () => [] },
    mode: { type: String, default: 'create' }
})

const emit = defineEmits(['submit', 'cancel', 'update:character'])

const localCharacter = ref({ ...props.character })
const errors = ref({})
const serverError = ref('')
const trombinoscopePhotoInput = ref(null)
const uploadingTrombinoscopePhoto = ref(false)
const characterTypeOptions = CHARACTER_TYPE_OPTIONS

const factionOptions = computed(() =>
    props.factions
        .filter((faction) => faction.gameId === localCharacter.value.gameId)
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((faction) => ({
            label: faction.name,
            value: faction.id
        }))
)

watch(() => props.character, (newVal) => {
    localCharacter.value = {
        ...newVal,
        type: newVal.type || CHARACTER_TYPES.pj,
        sheetReadyToSend: Boolean(newVal.sheetReadyToSend),
        excludeFromTrombinoscope: Boolean(newVal.excludeFromTrombinoscope),
        trombinoscopeFaceHidden: Boolean(newVal.trombinoscopeFaceHidden),
        factionIds: newVal.factionIds || newVal.factions?.map((faction) => faction.id) || []
    }
    errors.value = {}
    serverError.value = ''
}, { immediate: true })

watch(() => localCharacter.value.gameId, () => {
    const validFactionIds = new Set(factionOptions.value.map((faction) => faction.value))
    localCharacter.value.factionIds = (localCharacter.value.factionIds || []).filter((id) => validFactionIds.has(id))
})

function validate() {
    errors.value = {}
    if (!localCharacter.value.name?.trim()) {
        errors.value.name = 'Le nom est requis.'
    }
    if (!localCharacter.value.gameId) {
        errors.value.gameId = 'Le jeu est requis.'
    }
    return Object.keys(errors.value).length === 0
}

async function submit() {
    if (!validate()) return
    try {
        emit('update:character', localCharacter.value)
        await emit('submit')
    } catch (err) {
        serverError.value = err?.data?.message || err?.message || 'Erreur inconnue'
    }
}

async function uploadTrombinoscopePhoto(event) {
    const input = event.target
    const file = input.files?.[0]
    if (!file) return

    uploadingTrombinoscopePhoto.value = true
    try {
        const formData = new FormData()
        formData.append('photo', file)
        const result = await useApiFetch('/api/uploads/session-assignment-photos', {
            method: 'POST',
            body: formData
        })
        localCharacter.value.trombinoscopePhotoUrl = result.photoUrl
    } catch (err) {
        serverError.value = err?.data?.message || err?.message || 'Impossible d’envoyer la photo'
    } finally {
        uploadingTrombinoscopePhoto.value = false
        input.value = ''
    }
}
</script>
