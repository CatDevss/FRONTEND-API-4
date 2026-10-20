<template>
  <v-card class="mb-6 pa-4" title="3. Parâmetros da coleta">
    <p class="mb-3">
      O agendamento é configurado no backend. A coleta abaixo é executada sob demanda.
    </p>
    <v-alert v-if="error" type="error" class="mb-3">{{ error }}</v-alert>
    <p class="mb-3 text-subtitle-1">{{ connector.agency }} — {{ connector.product }}</p>
    <v-alert v-if="!ready" type="info" variant="tonal" class="mb-3"
      >Selecione fonte com dicionário para coletar com o usuário da sessão.</v-alert
    >
    <template v-if="selected">
      <v-alert type="info" class="mb-3"
        >{{ selected.limitations }} A URL da fonte deve corresponder ao órgão do conector.</v-alert
      >
      <v-select
        v-if="product === 'IBGE_BIOMAS'"
        v-model="competence"
        :items="['2019', '2025']"
        label="Edição"
        :disabled="busy"
      />
      <v-text-field
        v-else
        v-model="competence"
        :type="product === 'INPE_QUEIMADAS' ? 'date' : 'text'"
        :label="
          product === 'INPE_QUEIMADAS' ? 'Dia encerrado (AAAA-MM-DD)' : 'Ano publicado (AAAA)'
        "
        :disabled="busy"
      />
      <v-text-field
        v-if="product === 'IBGE_MUNICIPIOS'"
        v-model="municipality"
        label="Código IBGE opcional (7 dígitos, iniciado por 41)"
        :disabled="busy"
      />
      <template v-if="product === 'INPE_PRODES'">
        <v-select
          v-model="biome"
          :items="['CERRADO', 'MATA_ATLANTICA']"
          label="Bioma"
          :disabled="busy"
        />
        <v-text-field
          v-model="bbox"
          label="Recorte opcional: oeste,sul,leste,norte"
          :disabled="busy"
        />
      </template>
    </template>
    <v-btn :disabled="!ready || !selected || !competence || busy" :loading="busy" @click="collect"
      >Coletar e validar</v-btn
    >
    <template v-if="result">
      <p class="mt-4">Arquivo: {{ result.file.name }}</p>
      <ValidationResult v-if="result.file.validation" :report="result.file.validation" />
      <v-alert v-else type="warning"
        >Validação indisponível. Consulte o relatório antes de utilizar os dados.</v-alert
      >
      <p>{{ result.collection.scope }} — {{ result.collection.competence }}</p>
      <p v-for="limitation in result.collection.limitations" :key="limitation">{{ limitation }}</p>
    </template>
  </v-card>
</template>
<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import axios from 'axios'
import { isCollectionInProgress } from '@/composables/uploadLock'
import { can, currentUserId } from '@/access/session'
import ValidationResult from '@/components/ValidationResult.vue'
import {
  apiError,
  sourceSupportsProduct,
  type Connector,
  type IngestedFile,
  type CollectionMetadata,
} from '@/services/contracts'
const props = defineProps<{
  connector: Connector
  sourceId: number | null
  sourceUrl: string
  userId: number | null
  ready: boolean
}>()
const emit = defineEmits<{ collected: []; busy: [value: boolean] }>()
const busy = ref(false),
  error = ref('')
const product = computed(() => props.connector.id)
const competence = ref(''),
  municipality = ref(''),
  biome = ref(''),
  bbox = ref('')
const result = ref<{ file: IngestedFile; collection: CollectionMetadata } | null>(null)
const selected = computed(() => props.connector)
watch(product, () => {
  competence.value = ''
  municipality.value = ''
  biome.value = ''
  bbox.value = ''
  result.value = null
  error.value = ''
})
watch(
  () => [props.sourceId, props.userId],
  () => {
    result.value = null
    error.value = ''
  },
)
async function collect() {
  if (
    !can('ingestion.run') ||
    currentUserId.value !== props.userId ||
    !props.ready ||
    !props.sourceId ||
    !props.userId ||
    busy.value ||
    isCollectionInProgress.value ||
    !sourceSupportsProduct(props.sourceUrl, product.value)
  )
    return
  error.value = ''
  result.value = null
  const body: Record<string, unknown> = {
    product: product.value,
    competence: competence.value.trim(),
    userId: props.userId,
  }
  if (product.value === 'IBGE_MUNICIPIOS' && municipality.value.trim()) {
    if (!/^41\d{5}$/.test(municipality.value.trim())) {
      error.value = 'Informe um código IBGE do Paraná válido.'
      return
    }
    body.municipality = municipality.value.trim()
  }
  if (product.value === 'INPE_PRODES') {
    if (!biome.value) {
      error.value = 'Selecione o bioma.'
      return
    }
    body.biome = biome.value
    if (bbox.value.trim()) {
      const coordinates = bbox.value.split(',').map((v) => (v.trim() ? Number(v) : NaN))
      if (coordinates.length !== 4 || coordinates.some((v) => !Number.isFinite(v))) {
        error.value = 'Informe quatro coordenadas numéricas.'
        return
      }
      body.bbox = coordinates
    }
  }
  busy.value = true
  isCollectionInProgress.value = true
  emit('busy', true)
  try {
    result.value = (await axios.post(`/fontes/${props.sourceId}/coletas`, body)).data
    emit('collected')
  } catch (e) {
    error.value = apiError(e)
  } finally {
    busy.value = false
    isCollectionInProgress.value = false
    emit('busy', false)
  }
}
</script>
