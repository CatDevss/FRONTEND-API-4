<template>
    <div>
        <input ref="fileInput" type="file" multiple :accept="accept" class="d-none" @change="addFiles" />
        <v-btn color="primary" prepend-icon="mdi-plus" class="mb-4" @click="openFilePicker">Adicionar arquivos</v-btn>

        <v-alert v-if="fileErrors.length > 0" type="error" variant="tonal" class="mb-4">
            <div v-for="error in fileErrors" :key="error">
                {{ error }}
            </div>
        </v-alert>

        <v-list v-if="model.length > 0" class="border rounded">
            <v-list-subheader>
                Arquivos adicionados {{ model.length }}
            </v-list-subheader>

            <v-list-item v-for="(file, index) in model" :key="`${file.name}-${file.size}-${file.lastModified}`"
                :title="file.name" :subtitle="formatFileSize(file.size)">

                <template #prepend>
                    <v-icon icon="mdi-file-outline" />
                </template>

                <template #append>
                    <v-btn icon="mdi-delete-outline" variant="text" color="error" :aria-label="`Excluir ${file.name}`"
                        @click="removeFile(index)" />
                </template>
            </v-list-item>
        </v-list>
    </div>
</template>

<script setup lang="ts">

import { computed, ref } from 'vue';

const props = defineProps<{
    allowedExtensions: readonly string[]
}>()

// O componente recebe e atualiza a lista do componente pai via v-model.
const model = defineModel<File[]>({ default: () => [] });

const fileInput = ref<HTMLInputElement | null>(null);

const fileErrors = ref<string[]>([])

const normalizedExtensions = computed(() =>
    props.allowedExtensions.map((extension) =>
        extension.replace('.', '').toLowerCase(),
    ),
)

const accept = computed(() =>
    normalizedExtensions.value.map((extension) => `.${extension}`).join(','),
)

function openFilePicker() {
    fileInput.value?.click();
}

function getFileExtension(fileName: string): string | null {
    const lastDot = fileName.lastIndexOf('.')

    if (lastDot <= 0 || lastDot === fileName.length - 1) {
        return null
    }

    return fileName.slice(lastDot + 1).toLowerCase()
}

function addFiles(event: Event) {
    const input = event.target as HTMLInputElement
    const newFiles = Array.from(input.files ?? [])

    const validFiles: File[] = []
    const errors: string[] = []

    for (const file of newFiles) {
        const extension = getFileExtension(file.name)

        if (!extension || !normalizedExtensions.value.includes(extension)) {
            errors.push(`${file.name}: formato não autorizado`)
            continue
        }

        validFiles.push(file)
    }

    model.value = [...model.value, ...validFiles]
    fileErrors.value = errors
    input.value = ''
}

function removeFile(index: number) {
    model.value = model.value.filter((_, currentIndex) => currentIndex !== index);
}

function formatFileSize(sizeInBytes: number) {
    return `${Math.ceil(sizeInBytes / 1024)} KB`
}
</script>