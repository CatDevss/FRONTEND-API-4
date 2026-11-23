<template>
  <details class="template-panel mb-5">
    <summary>Começar com um modelo de conector oficial</summary>
    <p class="text-body-2 my-3">
      Consulte as regras sugeridas para a edição. Revise os campos antes de salvar o dicionário.
    </p>
    <v-btn
      variant="text"
      size="small"
      :loading="loading"
      :disabled="disabled || loading"
      @click="loadCatalog"
      >Carregar conectores compatíveis</v-btn
    >
    <v-select
      v-if="catalogLoaded"
      v-model="product"
      :items="compatible"
      item-title="product"
      item-value="id"
      label="Produto do conector"
      :disabled="disabled || loading"
      variant="outlined"
      density="compact"
    />
    <p v-if="catalogLoaded && !compatible.length" class="text-body-2">
      Não há conector automático compatível com a URL desta fonte.
    </p>
    <v-text-field
      v-if="product"
      v-model="competence"
      label="Competência do modelo"
      hint="Biomas exige 2019 ou 2025. Malhas municipais incluem atributos específicos desde 2023."
      persistent-hint
      :disabled="disabled || loading"
      variant="outlined"
      density="compact"
    />
    <v-btn
      v-if="product"
      variant="tonal"
      class="my-3"
      :loading="loading"
      :disabled="disabled || loading"
      @click="loadTemplate"
      >Consultar modelo</v-btn
    >
    <v-alert v-if="error" type="error" variant="tonal" role="alert">{{ error }}</v-alert>
    <section v-if="template" aria-label="Modelo sugerido">
      <h3 class="text-subtitle-2">{{ template.name }}</h3>
      <p class="text-body-2 my-2">{{ template.description }}</p>
      <ul class="ml-5">
        <li v-for="rule in template.rules" :key="rule.name">
          {{ rule.name }} · {{ rule.type }} · {{ rule.required ? 'Obrigatório' : 'Opcional' }}
        </li>
      </ul>
      <v-btn
        class="mt-3"
        color="primary"
        variant="tonal"
        :disabled="disabled || loading"
        @click="$emit('apply', template)"
        >Usar modelo no editor</v-btn
      >
      <p class="text-caption mt-2">
        Substitui os campos do editor. O cadastro só ocorre ao salvar o dicionário.
      </p>
    </section>
  </details>
</template>
<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import axios from 'axios'
import {
  apiError,
  sourceSupportsProduct,
  supportedProducts,
  type Connector,
  type FieldRule,
} from '@/services/contracts'
export interface DictionaryDraft {
  name: string
  description: string | null
  rules: FieldRule[]
}
const props = defineProps<{ sourceUrl: string; disabled?: boolean }>()
defineEmits<{ apply: [draft: DictionaryDraft] }>()
const catalog = ref<Connector[]>([]),
  catalogLoaded = ref(false),
  product = ref(''),
  competence = ref('')
const loading = ref(false),
  error = ref(''),
  template = ref<DictionaryDraft | null>(null)
const compatible = computed(() =>
  catalog.value.filter(
    (c) =>
      c.access === 'AUTOMATICO' &&
      supportedProducts.includes(c.id) &&
      sourceSupportsProduct(props.sourceUrl, c.id),
  ),
)
let epoch = 0
watch(
  () => props.sourceUrl,
  () => {
    ++epoch
    product.value = ''
    template.value = null
    loading.value = false
    error.value = ''
  },
)
watch([product, competence], () => {
  ++epoch
  template.value = null
  error.value = ''
  loading.value = false
})
onBeforeUnmount(() => {
  ++epoch
})
async function loadCatalog() {
  if (props.disabled || loading.value) return
  const current = ++epoch
  loading.value = true
  error.value = ''
  try {
    const { data } = await axios.get<Connector[]>('/fontes/conectores')
    if (current === epoch) {
      catalog.value = data
      catalogLoaded.value = true
    }
  } catch (e) {
    if (current === epoch) error.value = apiError(e)
  } finally {
    if (current === epoch) loading.value = false
  }
}
async function loadTemplate() {
  if (props.disabled || loading.value || !compatible.value.some((c) => c.id === product.value))
    return
  const current = ++epoch
  loading.value = true
  error.value = ''
  template.value = null
  try {
    const { data } = await axios.get<DictionaryDraft>(
      `/fontes/conectores/${product.value}/dicionario`,
      {
        params: competence.value.trim()
          ? { competence: competence.value.trim().toUpperCase() }
          : {},
      },
    )
    if (current === epoch) template.value = data
  } catch (e) {
    if (current === epoch) error.value = apiError(e)
  } finally {
    if (current === epoch) loading.value = false
  }
}
</script>
<style scoped>
.template-panel {
  border: 1px solid var(--glass-outer-border);
  border-radius: 12px;
  padding: 16px;
}
summary {
  cursor: pointer;
  font-weight: 600;
}
ul {
  max-height: 220px;
  overflow: auto;
  font-size: 13px;
}
</style>
