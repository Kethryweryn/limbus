<template>
    <UCard class="w-full">
        <template #header>
            {{ mode === 'edit' ? 'Modifier le personnage' : 'Créer un nouveau personnage' }}
        </template>

        <form class="w-full space-y-6" @submit.prevent="submit">
            <UFormField label="Jeu" :error="errors.gameId">
                <USelect
v-model="localCharacter.gameId"
                    :items="gameItems" value-key="value" placeholder="Choisissez un jeu"
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

            <!-- Valeur de l'attribut d'équilibre du jeu, pour un PJ (US-091) -->
            <UFormField v-if="balanceGame && localCharacter.type === CHARACTER_TYPES.pj" :label="balanceGame.balanceAttribute || ''">
                <USelect
                    v-model="balanceSelection"
                    :items="balanceItems"
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
                    v-model.nullable="localCharacter.pitch"
                    :rows="5"
                    size="lg"
                    class="w-full"
                    placeholder="Texte court envoyé aux participants lors de l’attribution du personnage."
                />
            </UFormField>

            <UFormField label="Background" :error="errors.background">
                <UTextarea
                    v-model.nullable="localCharacter.background"
                    :rows="18"
                    size="lg"
                    class="w-full font-mono text-sm"
                    placeholder="Histoire complète du personnage."
                />
            </UFormField>

            <UFormField label="Lien vers un background externe" :error="errors.backgroundDocumentUrl">
                <UInput
                    v-model.nullable="localCharacter.backgroundDocumentUrl"
                    type="url"
                    size="lg"
                    class="w-full"
                    placeholder="Google Docs, PDF, DOCX ou ODT hébergé ailleurs"
                />
            </UFormField>

            <AppCheckboxRow
                v-model="localCharacter.sheetReadyToSend"
                label="Fiche prête à être envoyée"
                description="Décochez pour repasser la fiche en brouillon."
            />

            <UCard variant="outline" class="bg-gray-50">
                <template #header>
                    Options de trombinoscope
                </template>

                <div class="space-y-4">
                    <AppCheckboxRow
                        v-model="localCharacter.excludeFromTrombinoscope"
                        label="Ne jamais inclure ce personnage dans un trombinoscope"
                    />
                    <AppCheckboxRow
                        v-model="localCharacter.trombinoscopeFaceHidden"
                        label="Personne ne connaît son visage"
                        description="Sa photo sera remplacée par un point d’interrogation par défaut."
                    />
                    <UFormField label="Photo de trombinoscope par défaut" :error="errors.trombinoscopePhotoUrl">
                        <div class="flex flex-col gap-2 sm:flex-row">
                            <UInput
                                v-model.nullable="localCharacter.trombinoscopePhotoUrl"
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
                            v-model.nullable="localCharacter.trombinoscopeDisplayName"
                            size="lg"
                            class="w-full"
                            placeholder="Nom affiché dans les trombinoscopes"
                        />
                    </UFormField>
                    <UFormField label="Note de trombinoscope par défaut">
                        <UTextarea
                            v-model.nullable="localCharacter.trombinoscopeNote"
                            :rows="3"
                            size="lg"
                            class="w-full"
                        />
                    </UFormField>
                </div>
            </UCard>

            <UFormField label="Indications costumes" :error="errors.costumeIndications">
                <UTextarea
                    v-model.nullable="localCharacter.costumeIndications"
                    :rows="5"
                    size="lg"
                    class="w-full"
                />
            </UFormField>

            <div class="flex flex-wrap gap-2 pt-2">
                <UButton type="submit" color="primary" size="lg" :disabled="!localCharacter.name?.trim() || !localCharacter.gameId">
                    {{ mode === 'edit' ? 'Enregistrer' : 'Créer' }}
                </UButton>
                <UButton color="neutral" size="lg" @click="$emit('cancel')">
                    Annuler
                </UButton>
            </div>

            <p v-if="serverError" class="text-red-500 text-sm mt-2">{{ serverError }}</p>
        </form>
    </UCard>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { CHARACTER_TYPE_OPTIONS, CHARACTER_TYPES } from '~/utils/domain'
import { apiErrorMessage } from '~/utils/apiErrors'
import type { CharacterDraft, FactionOption, GameOption } from '~/utils/writingDrafts'

const props = withDefaults(defineProps<{
    character: CharacterDraft
    games: GameOption[]
    factions?: FactionOption[]
    mode?: 'create' | 'edit'
}>(), { factions: () => [], mode: 'create' })

const emit = defineEmits<{ submit: [], cancel: [], 'update:character': [character: CharacterDraft] }>()

const localCharacter = ref<CharacterDraft>({ ...props.character })

// Jeu du personnage, s'il a un attribut d'équilibre ; « Non renseigné » s'envoie comme une valeur vide
const NO_BALANCE_VALUE = '__none'
const balanceGame = computed(() => {
    const game = props.games.find((candidate) => candidate.id === localCharacter.value.gameId)
    return game?.balanceAttribute && game.balanceValues?.length ? game : null
})
const balanceItems = computed(() => [
    { label: 'Non renseigné', value: NO_BALANCE_VALUE },
    ...(balanceGame.value?.balanceValues || []).map((value) => ({ label: value, value }))
])
const balanceSelection = computed({
    get: () => localCharacter.value.balanceValue || NO_BALANCE_VALUE,
    set: (value: string) => { localCharacter.value.balanceValue = value === NO_BALANCE_VALUE ? null : value }
})
const errors = ref<Record<string, string>>({})
const serverError = ref('')
const trombinoscopePhotoInput = ref<HTMLInputElement | null>(null)
const uploadingTrombinoscopePhoto = ref(false)
const characterTypeOptions: Array<{ label: string, value: string }> = [...CHARACTER_TYPE_OPTIONS]
const gameItems = computed(() => props.games.map(g => ({ label: g.title, value: g.id })))

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

function submit() {
    if (!validate()) return
    try {
        emit('update:character', localCharacter.value)
        emit('submit')
    } catch (err) {
        serverError.value = apiErrorMessage(err, 'Erreur inconnue')
    }
}

async function uploadTrombinoscopePhoto(event: Event) {
    const input = event.target as HTMLInputElement
    const file = input.files?.[0]
    if (!file) return

    uploadingTrombinoscopePhoto.value = true
    try {
        const formData = new FormData()
        formData.append('photo', file)
        formData.append('gameId', localCharacter.value.gameId || '')
        const result = await useApiAction('/api/uploads/session-assignment-photos', {
            method: 'POST',
            body: formData
        })
        localCharacter.value.trombinoscopePhotoUrl = result.photoUrl
    } catch (err) {
        serverError.value = apiErrorMessage(err, 'Impossible d’envoyer la photo')
    } finally {
        uploadingTrombinoscopePhoto.value = false
        input.value = ''
    }
}
</script>
