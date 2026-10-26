<template>
  <div
    class="dictionary-choice"
    :class="{ 'dictionary-choice--missing': !loading && !error && !dictionaries.length }"
  >
    <div class="dictionary-heading">
      <span class="dictionary-icon"><v-icon icon="mdi-book-open-outline" size="20" /></span>
      <div>
        <span class="context-label">DICIONÁRIO DE VALIDAÇÃO</span>
        <p>Escolha como os arquivos serão validados.</p>
      </div>
    </div>
    <v-autocomplete
      v-model="selection"
      :items="options"
      item-title="title"
      item-value="id"
      label="Dicionário de validação"
      :custom-filter="filterDictionary"
      :loading="loading"
      :disabled="disabled || loading || !!error || !dictionaries.length"
      :error-messages="
        invalidSelection
          ? 'A versão selecionada não está mais disponível. Escolha outro dicionário ou o modo automático.'
          : undefined
      "
      no-data-text="Nenhum dicionário encontrado para essa busca."
      hint="Pesquise por nome, versão ou ID. Limpar volta ao modo automático."
      persistent-hint
      variant="outlined"
      density="compact"
      clearable
    >
      <template #item="{ props: itemProps, item }">
        <v-list-item
          v-bind="itemProps"
          :subtitle="item.subtitle"
          :prepend-icon="item.id === 'latest' ? 'mdi-autorenew' : 'mdi-book-open-outline'"
        />
      </template>
    </v-autocomplete>
    <p v-if="loading" class="dictionary-description" role="status">
      Consultando as versões desta fonte…
    </p>
    <template v-else-if="!error && !invalidSelection">
      <div v-if="current" class="dictionary-preview">
        <strong>{{ current.name }} · v{{ current.version }} · #{{ current.id }}</strong>
        <p class="dictionary-description">
          {{
            model === null
              ? 'O backend selecionará a versão mais recente no momento da ingestão.'
              : 'Esta versão será usada na validação. Confira a versão registrada no relatório retornado.'
          }}
        </p>
      </div>
      <p v-else class="dictionary-description" role="status">
        Solicite ao Gestor um dicionário para esta fonte antes de receber dados.
      </p>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { Dictionary } from '@/services/contracts'

const props = defineProps<{
  dictionaries: Dictionary[]
  loading: boolean
  error: string
  disabled: boolean
}>()
const model = defineModel<number | null>({ default: null })
const selection = computed({
  get: (): number | 'latest' => model.value ?? 'latest',
  set: (value: number | 'latest' | null) => {
    model.value = typeof value === 'number' ? value : null
  },
})
const options = computed(() => [
  {
    id: 'latest' as const,
    title: 'Automático · versão mais recente',
    subtitle: 'Usar a última versão disponível desta fonte no momento da ingestão.',
  },
  ...props.dictionaries.map((dictionary) => ({
    id: dictionary.id,
    title: `${dictionary.name} · v${dictionary.version} · #${dictionary.id}`,
    subtitle:
      dictionary.status === 'RASCUNHO'
        ? 'Rascunho'
        : dictionary.status === 'UTILIZADO'
          ? 'Utilizado'
          : dictionary.status,
  })),
])
const current = computed(() =>
  model.value === null
    ? props.dictionaries[0]
    : props.dictionaries.find((dictionary) => dictionary.id === model.value),
)
const invalidSelection = computed(
  () => model.value !== null && !props.loading && !props.error && !current.value,
)
const normalize = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
function filterDictionary(value: string, query: string) {
  return normalize(value).includes(normalize(query).trim())
}
</script>

<style scoped>
.dictionary-choice {
  border: 1px solid var(--glass-outer-border);
  border-radius: 12px;
  padding: 16px;
  margin-top: 20px;
  background: rgba(var(--v-theme-background), 0.2);
}
.dictionary-choice--missing {
  border-color: rgba(var(--v-theme-warning), 0.25);
}
.dictionary-heading {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 18px;
}
.dictionary-icon {
  display: grid;
  place-items: center;
  width: 34px;
  height: 34px;
  border-radius: 10px;
  flex-shrink: 0;
  color: rgb(var(--v-theme-primary));
  background: rgba(var(--v-theme-primary), 0.08);
}
.context-label {
  font-size: 9px;
  letter-spacing: 0.1em;
  color: rgba(var(--v-theme-on-surface), 0.55);
}
.dictionary-heading p,
.dictionary-description {
  font-size: 10px;
  line-height: 1.7;
  color: rgba(var(--v-theme-on-surface), 0.6);
}
.dictionary-heading p {
  margin-top: 3px;
}
.dictionary-preview,
.dictionary-choice > .dictionary-description {
  margin-top: 16px;
}
.dictionary-preview strong {
  display: block;
  font-size: 11px;
  font-weight: 500;
  overflow-wrap: anywhere;
  margin-bottom: 4px;
}
.dictionary-choice :deep(.v-messages) {
  font-size: 10px;
  line-height: 1.6;
}
@media (max-width: 500px) {
  .dictionary-choice {
    padding: 12px;
  }
}
</style>
