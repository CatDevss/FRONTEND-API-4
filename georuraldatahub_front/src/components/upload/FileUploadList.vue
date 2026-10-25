<template>
  <div class="file-picker" :aria-disabled="disabled">
    <input
      ref="fileInput"
      type="file"
      :disabled="disabled"
      multiple
      :accept="accept"
      class="d-none"
      aria-label="Selecionar arquivos para envio"
      @change="addFiles"
    />
    <div class="file-picker-surface" :class="{ 'has-files': model.length > 0 }">
      <span class="picker-icon"><v-icon icon="mdi-file-upload-outline" size="32" /></span>
      <div class="picker-copy">
        <h3>
          {{ model.length ? 'Continue montando sua seleção' : 'Quais arquivos vamos receber?' }}
        </h3>
        <p>Você pode selecionar vários arquivos de uma vez.</p>
        <div class="accepted-formats" aria-label="Extensões aceitas">
          <span v-for="extension in normalizedExtensions" :key="extension">.{{ extension }}</span>
        </div>
      </div>
      <v-btn
        color="primary"
        variant="tonal"
        prepend-icon="mdi-plus"
        :disabled="disabled"
        @click="openFilePicker"
        >Adicionar arquivos</v-btn
      >
    </div>

    <v-alert
      v-if="fileErrors.length > 0"
      type="error"
      variant="tonal"
      density="compact"
      class="mt-4"
      role="alert"
    >
      <div v-for="error in fileErrors" :key="error">
        {{ error }}
      </div>
    </v-alert>

    <section v-if="model.length > 0" class="file-selection" aria-label="Arquivos selecionados">
      <div class="selection-heading">
        <h3>Sua seleção</h3>
        <span>{{ model.length }} {{ model.length === 1 ? 'arquivo' : 'arquivos' }}</span>
      </div>
      <ul class="selected-files">
        <li
          v-for="(file, index) in model"
          :key="`${index}-${file.name}-${file.size}-${file.lastModified}`"
          class="selected-file"
        >
          <span class="file-icon"><v-icon :icon="fileIcon(file.name)" size="22" /></span>
          <div class="file-info">
            <strong>{{ file.name }}</strong>
            <span
              >{{ formatFileSize(file.size) }} ·
              {{ getFileExtension(file.name)?.toUpperCase() }}</span
            >
          </div>
          <v-btn
            icon="mdi-close"
            variant="text"
            size="small"
            :aria-label="`Remover ${file.name} da seleção`"
            :title="`Remover ${file.name} da seleção`"
            :disabled="disabled"
            @click="removeFile(index)"
          />
        </li>
      </ul>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'

const props = defineProps<{
  allowedExtensions: readonly string[]
  disabled?: boolean
}>()

// O componente recebe e atualiza a lista do componente pai via v-model.
const model = defineModel<File[]>({ default: () => [] })

const fileInput = ref<HTMLInputElement | null>(null)

const fileErrors = ref<string[]>([])

const normalizedExtensions = computed(() =>
  props.allowedExtensions.map((extension) => extension.replace('.', '').toLowerCase()),
)

const accept = computed(() =>
  normalizedExtensions.value.map((extension) => `.${extension}`).join(','),
)

function openFilePicker() {
  fileInput.value?.click()
}

function getFileExtension(fileName: string): string | null {
  const lastDot = fileName.lastIndexOf('.')

  if (lastDot <= 0 || lastDot === fileName.length - 1) {
    return null
  }

  return fileName.slice(lastDot + 1).toLowerCase()
}
function fileIcon(name: string) {
  const extension = getFileExtension(name)
  if (extension === 'csv') return 'mdi-file-delimited-outline'
  if (['tif', 'tiff'].includes(extension ?? '')) return 'mdi-image-filter-hdr'
  if (extension === 'zip') return 'mdi-folder-zip-outline'
  if (extension === 'gpkg') return 'mdi-database-outline'
  return 'mdi-code-json'
}

function addFiles(event: Event) {
  if (props.disabled) return
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
  if (props.disabled) return
  model.value = model.value.filter((_, currentIndex) => currentIndex !== index)
}

function formatFileSize(sizeInBytes: number) {
  return `${Math.ceil(sizeInBytes / 1024)} KB`
}
</script>

<style scoped>
.file-picker-surface {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  padding: 44px 20px;
  border: 1px dashed rgba(var(--v-theme-primary), 0.3);
  border-radius: 16px;
  background: rgba(var(--v-theme-primary), 0.025);
  gap: 20px;
}
.picker-icon {
  display: grid;
  place-items: center;
  width: 68px;
  height: 68px;
  border: 1px solid rgba(var(--v-theme-primary), 0.15);
  border-radius: 21px;
  background: rgba(var(--v-theme-primary), 0.06);
  color: rgb(var(--v-theme-primary));
  flex-shrink: 0;
}
.picker-copy h3 {
  font-size: 16px;
  font-weight: 500;
  line-height: 1.5;
}
.picker-copy p {
  font-size: 12px;
  line-height: 1.6;
  color: rgba(var(--v-theme-on-surface), 0.6);
  margin-top: 6px;
}
.accepted-formats {
  display: flex;
  justify-content: center;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 16px;
}
.accepted-formats > span {
  border: 1px solid var(--glass-outer-border);
  border-radius: 7px;
  padding: 4px 8px;
  font-size: 10px;
  color: rgba(var(--v-theme-on-surface), 0.6);
  background: rgba(var(--v-theme-background), 0.2);
}
.file-picker-surface :deep(.v-btn) {
  text-transform: none;
  letter-spacing: 0;
  border-radius: 10px;
  font-size: 12px;
}
.has-files {
  padding: 24px 20px;
  gap: 16px;
}
.has-files .picker-icon {
  width: 48px;
  height: 48px;
  border-radius: 15px;
}
.has-files .picker-copy h3 {
  font-size: 14px;
}
.has-files .accepted-formats {
  margin-top: 10px;
}
.file-picker[aria-disabled='true'] .file-picker-surface {
  border-color: var(--glass-outer-border);
}
.file-selection {
  margin-top: 24px;
}
.selection-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 10px;
}
.selection-heading h3 {
  font-size: 12px;
  font-weight: 500;
}
.selection-heading > span {
  font-size: 10px;
  color: rgba(var(--v-theme-on-surface), 0.5);
}
.selected-files {
  list-style: none;
  padding: 0;
  margin: 0;
  max-height: 380px;
  overflow: auto;
}
.selected-file {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 0;
  border-bottom: 1px solid var(--glass-outer-border);
}
.selected-file:last-child {
  border-bottom: 0;
}
.file-icon {
  display: grid;
  place-items: center;
  width: 38px;
  height: 42px;
  border: 1px solid var(--glass-outer-border);
  border-radius: 10px;
  color: rgba(var(--v-theme-on-surface), 0.6);
  background: rgba(var(--v-theme-on-surface), 0.025);
  flex-shrink: 0;
}
.file-info {
  display: grid;
  gap: 5px;
  flex: 1;
  min-width: 0;
}
.file-info strong {
  font-size: 12px;
  font-weight: 500;
  overflow-wrap: anywhere;
}
.file-info > span {
  font-size: 10px;
  color: rgba(var(--v-theme-on-surface), 0.5);
}
</style>
