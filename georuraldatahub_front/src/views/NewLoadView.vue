<template>
  <div class="mx-auto ingestion-page">
    <div class="d-flex align-center flex-wrap ga-3 mb-2">
      <h1 class="text-h5 font-weight-bold">Nova ingestão de dados</h1>
      <v-spacer />
      <v-btn v-if="mode" variant="outlined" :disabled="locked" @click="changeMode"
        >Trocar modalidade</v-btn
      >
    </div>
    <p class="text-medium-emphasis mb-6">Escolha como os dados chegarão ao GeoRural DataHub.</p>

    <template v-if="!mode">
      <h2 class="text-h6 mb-4">Qual serviço você quer utilizar?</h2>
      <v-row>
        <v-col cols="12" md="6">
          <v-card class="pa-6 h-100" variant="outlined">
            <v-icon icon="mdi-file-upload-outline" size="40" color="primary" />
            <h3 class="text-h6 mt-3">Ingestão manual</h3>
            <p class="my-3">Envie arquivos CSV ou GeoJSON e informe a fonte de origem dos dados.</p>
            <v-btn color="primary" :disabled="locked" @click="chooseMode('manual')"
              >Enviar meus arquivos</v-btn
            >
          </v-card>
        </v-col>
        <v-col cols="12" md="6">
          <v-card class="pa-6 h-100" variant="outlined">
            <v-icon icon="mdi-cloud-download-outline" size="40" color="primary" />
            <h3 class="text-h6 mt-3">Ingestão automatizada</h3>
            <p class="my-3">Escolha um serviço oficial para coletar e validar dados do Paraná.</p>
            <v-btn color="primary" :disabled="locked" @click="chooseMode('automatic')"
              >Escolher serviço</v-btn
            >
          </v-card>
        </v-col>
      </v-row>
    </template>

    <template v-else>
      <v-chip class="mb-4" color="primary">{{
        mode === 'manual' ? 'Ingestão manual' : 'Ingestão automatizada'
      }}</v-chip>
      <v-alert v-if="resourceError" type="error" class="mb-4"
        >{{ resourceError }}
        <v-btn variant="text" :loading="loading" :disabled="locked" @click="loadResources"
          >Tentar novamente</v-btn
        ></v-alert
      >
      <v-progress-linear v-if="loading" indeterminate class="mb-4" />

      <v-card v-if="mode === 'automatic'" class="pa-4 mb-5">
        <h2 class="text-h6 mb-2">1. Escolha o serviço</h2>
        <p class="mb-4">
          Selecione o produto para localizar sua fonte cadastrada. A coleta será executada ao
          confirmar os parâmetros.
        </p>
        <v-row>
          <v-col v-for="entry in automaticConnectors" :key="entry.id" cols="12" sm="6">
            <v-btn
              block
              class="service-button"
              height="auto"
              :variant="product === entry.id ? 'flat' : 'outlined'"
              :color="product === entry.id ? 'primary' : undefined"
              :disabled="locked || loading"
              :aria-pressed="product === entry.id"
              @click="selectProduct(entry.id)"
            >
              <span>{{ entry.agency }}<br />{{ entry.product }}</span>
            </v-btn>
          </v-col>
        </v-row>
        <p v-if="!loading && !automaticConnectors.length" class="mt-3">
          Nenhum serviço automático disponível.
        </p>
      </v-card>

      <v-card v-if="mode === 'manual'" class="pa-4 mb-5" :disabled="locked">
        <h2 class="text-h6 mb-2">1. Selecione os arquivos</h2>
        <p class="mb-4">
          CSV e GeoJSON. Shapefile, GeoPackage e GeoTIFF não estão disponíveis no envio manual.
        </p>
        <FileUploadList
          v-model="uploadedFiles"
          :allowed-extensions="['csv', 'geojson']"
          :disabled="locked"
        />
      </v-card>

      <v-card v-if="mode === 'manual' || selectedConnector" class="pa-4 mb-5" :disabled="locked">
        <h2 class="text-h6 mb-3">2. Fonte de origem</h2>
        <p class="mb-3">
          {{
            mode === 'manual'
              ? 'Informe de onde vieram os dados. A fonte define o dicionário usado na validação.'
              : 'A fonte precisa corresponder ao órgão do serviço escolhido.'
          }}
        </p>
        <v-alert
          v-if="mode === 'automatic' && compatibleSources.length === 1"
          type="info"
          variant="tonal"
          class="mb-3"
          >Fonte identificada automaticamente: {{ compatibleSources[0]?.name }}.</v-alert
        >
        <v-alert
          v-else-if="mode === 'automatic' && compatibleSources.length > 1"
          type="info"
          variant="tonal"
          class="mb-3"
          >Há mais de uma fonte compatível. Escolha a origem correta para utilizar o dicionário
          correspondente.</v-alert
        >
        <v-alert
          v-else-if="mode === 'automatic' && !loading"
          type="warning"
          variant="tonal"
          class="mb-3"
          >Nenhuma fonte cadastrada corresponde a este serviço. Um gestor deve cadastrar a fonte com
          a URL oficial.</v-alert
        >
        <v-select
          v-model="sourceId"
          :items="mode === 'manual' ? sources : compatibleSources"
          item-title="name"
          item-value="id"
          label="Fonte dos dados"
          :loading="loading"
          :disabled="loading || locked"
          clearable
        />
        <p v-if="selectedSource" class="text-caption mb-3 source-url">{{ selectedSource.url }}</p>
        <p class="text-caption">Fontes e dicionários oficiais são gerenciados pelo Gestor.</p>
        <v-alert v-if="dictionaryError" type="error" class="mt-4">{{ dictionaryError }}</v-alert>
        <v-progress-linear v-if="loadingDictionary" indeterminate class="mt-4" />
        <v-alert
          v-else-if="sourceId"
          :type="latestDictionary ? 'info' : 'warning'"
          variant="tonal"
          class="mt-4"
        >
          <template v-if="latestDictionary"
            >Dicionário: {{ latestDictionary.name }}, versão {{ latestDictionary.version }}. O
            backend selecionará a versão mais recente no momento da ingestão.</template
          >
          <template v-else
            >Solicite ao Gestor um dicionário para esta fonte antes de receber dados.</template
          >
          <div class="mt-2">
            <v-btn :to="{ path: '/dictionaries', query: { source: sourceId } }" variant="text"
              >Consultar dicionários</v-btn
            ><v-btn variant="text" :disabled="locked" @click="loadDictionary"
              >Conferir novamente</v-btn
            >
          </div>
        </v-alert>
      </v-card>

      <p class="mb-4">
        Responsável: {{ sessionUser?.name || 'Sessão não disponível' }}. Os arquivos serão recebidos
        pela fonte; você pode organizá-los em conjuntos depois.
      </p>
      <v-card v-if="mode === 'manual'" class="pa-4 mb-5">
        <h2 class="text-h6 mb-3">3. Enviar e validar</h2>
        <p>Fonte: {{ selectedSource?.name || 'Não selecionada' }}</p>
        <p class="mb-4">
          {{ uploadedFiles.length }} arquivo(s). Cada arquivo gera uma ingestão própria. O resultado
          da validação será apresentado após o envio.
        </p>
        <v-btn
          color="primary"
          :disabled="!manualReady || locked"
          :loading="isUploadInProgress"
          @click="showConfirm = true"
          >Enviar e validar arquivos</v-btn
        >
        <p v-if="!manualReady" class="text-caption mt-3">
          Selecione arquivo e fonte com dicionário para continuar com o usuário da sessão.
        </p>
      </v-card>
      <CollectionForm
        v-else-if="selectedConnector"
        :key="`${product}-${sourceId}-${userId}`"
        :connector="selectedConnector"
        :source-id="sourceId"
        :source-url="selectedSource?.url || ''"
        :user-id="userId"
        :ready="collectionReady"
        @busy="collectionBusy = $event"
        @collected="loadDictionary"
      />

      <template v-if="mode === 'manual' && uploadResults.length">
        <h2 class="text-h6 mb-3">Resultado do último envio</h2>
        <v-card v-for="(result, i) in uploadResults" :key="i" class="pa-4 mb-4"
          ><strong>{{ result.name }}</strong>
          <p>{{ result.message }}</p>
          <ValidationResult v-if="result.validation" :report="result.validation"
        /></v-card>
      </template>
      <v-expansion-panels v-if="mode === 'automatic'" class="mt-4"
        ><v-expansion-panel title="Outras fontes e disponibilidade"
          ><v-expansion-panel-text
            ><div v-for="entry in otherConnectors" :key="entry.id" class="mb-3">
              <strong>{{ entry.agency }} — {{ entry.product }}</strong>
              <p>{{ entry.access === 'MANUAL' ? 'Coleta manual' : 'Aguarda homologação' }}</p>
              <p>{{ entry.limitations }}</p>
            </div></v-expansion-panel-text
          ></v-expansion-panel
        ></v-expansion-panels
      >
    </template>

    <ConfirmDialog
      v-model="showConfirm"
      title="Enviar e validar arquivos"
      message="Enviar os arquivos para a fonte selecionada com o usuário da sessão? Apenas os registros aprovados ficarão disponíveis para tratamento e visualização."
      @confirm="submitManual"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import axios from 'axios'
import ConfirmDialog from '@/components/ConfirmDialog.vue'
import FileUploadList from '@/components/upload/FileUploadList.vue'
import CollectionForm from '@/components/CollectionForm.vue'
import ValidationResult from '@/components/ValidationResult.vue'
import {
  apiError,
  sourceSupportsProduct,
  supportedProducts,
  type Connector,
  type Dictionary,
  type Source,
} from '@/services/contracts'
import { can, currentUserId as userId, sessionUser } from '@/access/session'
import { isUploadInProgress, startUpload, uploadResults } from '@/composables/uploadLock'

const mode = ref<'manual' | 'automatic' | null>(null)
const sources = ref<Source[]>([]),
  catalog = ref<Connector[]>([])
const loading = ref(false),
  resourceError = ref(''),
  dictionaryError = ref('')
const sourceId = ref<number | null>(null)
const product = ref<string | null>(null),
  uploadedFiles = ref<File[]>([])
const showConfirm = ref(false)
const collectionBusy = ref(false),
  loadingDictionary = ref(false)
const latestDictionary = ref<Dictionary | null>(null)
const locked = computed(() => isUploadInProgress.value || collectionBusy.value)
const automaticConnectors = computed(() =>
  catalog.value.filter((c) => c.access === 'AUTOMATICO' && supportedProducts.includes(c.id)),
)
const otherConnectors = computed(() =>
  catalog.value.filter((c) => c.access !== 'AUTOMATICO' || !supportedProducts.includes(c.id)),
)
const selectedConnector = computed(() =>
  automaticConnectors.value.find((c) => c.id === product.value),
)
const compatibleSources = computed(() =>
  product.value ? sources.value.filter((s) => sourceSupportsProduct(s.url, product.value!)) : [],
)
const selectedSource = computed(() => sources.value.find((s) => s.id === sourceId.value))
const baseReady = computed(
  () =>
    !!selectedSource.value &&
    can('ingestion.run') &&
    !!userId.value &&
    !!latestDictionary.value &&
    !loadingDictionary.value &&
    !loading.value,
)
const manualReady = computed(
  () => mode.value === 'manual' && baseReady.value && uploadedFiles.value.length > 0,
)
const collectionReady = computed(
  () =>
    mode.value === 'automatic' &&
    baseReady.value &&
    !!selectedConnector.value &&
    compatibleSources.value.some((s) => s.id === sourceId.value) &&
    !isUploadInProgress.value,
)

async function loadResources() {
  loading.value = true
  resourceError.value = ''
  const results = await Promise.allSettled([
    axios.get<Source[]>('/fontes'),
    axios.get<Connector[]>('/fontes/conectores'),
  ])
  const [sourceResult, catalogResult] = results
  sources.value = sourceResult.status === 'fulfilled' ? sourceResult.value.data : []
  catalog.value = catalogResult.status === 'fulfilled' ? catalogResult.value.data : []
  resourceError.value = results
    .filter((r) => r.status === 'rejected')
    .map((r) => apiError(r.reason, 'Não foi possível carregar as opções de ingestão.'))
    .join(' ')
  if (!sources.value.some((s) => s.id === sourceId.value)) sourceId.value = null
  if (mode.value === 'automatic') resolveSource()
  loading.value = false
}
function chooseMode(value: 'manual' | 'automatic') {
  if (!locked.value) mode.value = value
}
function changeMode() {
  if (locked.value) return
  mode.value = null
  product.value = null
  sourceId.value = null
  uploadedFiles.value = []
  showConfirm.value = false
}
function selectProduct(id: string) {
  if (locked.value || !automaticConnectors.value.some((c) => c.id === id)) return
  product.value = id
  sourceId.value = null
  resolveSource()
}
function resolveSource() {
  if (compatibleSources.value.length === 1) sourceId.value = compatibleSources.value[0]!.id
  else if (!compatibleSources.value.some((s) => s.id === sourceId.value)) sourceId.value = null
}
let dictionaryEpoch = 0
async function loadDictionary() {
  const epoch = ++dictionaryEpoch
  latestDictionary.value = null
  dictionaryError.value = ''
  if (!sourceId.value) {
    loadingDictionary.value = false
    return
  }
  loadingDictionary.value = true
  try {
    const { data } = await axios.get<Dictionary[]>(`/fontes/${sourceId.value}/dicionarios`)
    if (epoch === dictionaryEpoch)
      latestDictionary.value = data.sort((a, b) => b.version - a.version)[0] ?? null
  } catch (e) {
    if (epoch === dictionaryEpoch) dictionaryError.value = apiError(e)
  } finally {
    if (epoch === dictionaryEpoch) loadingDictionary.value = false
  }
}
watch(sourceId, loadDictionary)
async function submitManual() {
  if (!manualReady.value || locked.value || !sourceId.value || !userId.value) return
  await startUpload(sourceId.value, [...uploadedFiles.value], userId.value)
  await loadDictionary()
}
onMounted(loadResources)
</script>

<style scoped>
.ingestion-page {
  max-width: 1000px;
}
.source-url {
  overflow-wrap: anywhere;
}
.service-button {
  padding: 20px;
  white-space: normal;
  text-align: left;
}
.service-button :deep(.v-btn__content) {
  white-space: normal;
}
</style>
