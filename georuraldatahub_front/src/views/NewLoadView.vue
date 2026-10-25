<template>
  <div class="mx-auto ingestion-page" :class="{ 'ingestion-page--expanded': !!mode }">
    <header class="ingestion-heading">
      <div>
        <p v-if="mode" class="eyebrow">
          {{ mode === 'automatic' ? 'CONECTORES OFICIAIS' : 'ENVIO DE ARQUIVOS' }}
        </p>
        <h1 class="text-h5 font-weight-bold">
          {{
            mode === 'automatic'
              ? 'Ingestão automatizada'
              : mode === 'manual'
                ? 'Ingestão manual'
                : 'Nova ingestão de dados'
          }}
        </h1>
        <p class="text-medium-emphasis mt-1">
          {{
            mode === 'automatic'
              ? 'Escolha o serviço, confira a origem e configure sua coleta.'
              : mode === 'manual'
                ? 'Selecione seus arquivos, confira a origem e acompanhe a validação.'
                : 'Escolha como os dados chegarão ao GeoRural DataHub.'
          }}
        </p>
      </div>
      <v-btn
        v-if="mode"
        variant="outlined"
        prepend-icon="mdi-swap-horizontal"
        :disabled="locked"
        @click="changeMode"
        >Trocar modalidade</v-btn
      >
    </header>
    <template v-if="!mode">
      <h2 class="text-h6 mb-4">Qual serviço você quer utilizar?</h2>
      <v-row>
        <v-col cols="12" md="6">
          <v-card class="pa-6 h-100" variant="outlined">
            <v-icon icon="mdi-file-upload-outline" size="40" color="primary" />
            <h3 class="text-h6 mt-3">Ingestão manual</h3>
            <p class="my-3">
              Envie CSV ou GeoJSON (.geojson ou .json) e informe a fonte de origem dos dados.
            </p>
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
      <v-alert v-if="resourceError" type="error" variant="tonal" class="mb-4" role="alert"
        >{{ resourceError
        }}<v-btn variant="text" :loading="loading" :disabled="locked" @click="loadResources"
          >Tentar novamente</v-btn
        ></v-alert
      >
      <v-progress-linear v-if="loading" indeterminate color="primary" class="mb-4" />
      <div v-if="mode === 'automatic'" class="automatic-layout">
        <aside class="service-catalog" aria-label="Serviços de coleta">
          <div class="catalog-heading">
            <span class="catalog-heading-icon"
              ><v-icon icon="mdi-cloud-download-outline" size="21"
            /></span>
            <div>
              <h2>Serviços disponíveis</h2>
              <p>
                {{ automaticConnectors.length }}
                {{ automaticConnectors.length === 1 ? 'serviço' : 'serviços' }} · Paraná
              </p>
            </div>
          </div>
          <p class="catalog-instruction">Escolha o produto que deseja receber.</p>
          <div class="service-list">
            <v-btn
              v-for="entry in automaticConnectors"
              :key="entry.id"
              block
              class="service-button"
              :class="{ 'is-selected': product === entry.id }"
              height="auto"
              variant="text"
              :disabled="locked || loading"
              :aria-pressed="product === entry.id"
              :data-product="entry.id"
              @click="selectProduct(entry.id)"
            >
              <span class="service-icon"><v-icon :icon="serviceIcon(entry.id)" size="22" /></span
              ><span class="service-label"
                ><small>{{ entry.agency }}</small
                ><strong>{{ entry.product }}</strong></span
              ><v-icon
                :icon="product === entry.id ? 'mdi-check-circle-outline' : 'mdi-chevron-right'"
                size="17"
                class="service-indicator"
              />
            </v-btn>
          </div>
          <p v-if="!loading && !automaticConnectors.length" class="catalog-empty">
            Nenhum serviço automático disponível.
          </p>
          <details v-if="otherConnectors.length" class="other-services">
            <summary>
              <v-icon icon="mdi-information-outline" size="16" /><span
                >Outras fontes e disponibilidade</span
              ><v-icon class="details-chevron" icon="mdi-chevron-down" size="16" />
            </summary>
            <div v-for="entry in otherConnectors" :key="entry.id" class="other-service">
              <strong>{{ entry.agency }} — {{ entry.product }}</strong
              ><span>{{
                entry.access === 'MANUAL' ? 'Coleta manual' : 'Aguarda homologação'
              }}</span>
              <p>{{ entry.limitations }}</p>
            </div>
          </details>
          <div class="catalog-footer">
            <v-icon icon="mdi-map-marker-outline" size="16" />
            <p>As coletas encaminhadas à validação são restritas ao Paraná.</p>
          </div>
        </aside>

        <main class="collection-workspace" aria-label="Configuração da coleta">
          <template v-if="selectedConnector">
            <div class="selected-service-heading">
              <div>
                <p class="eyebrow">{{ selectedConnector.agency }} · COLETA SOB DEMANDA</p>
                <h2 class="text-h6 font-weight-bold">{{ selectedConnector.product }}</h2>
              </div>
              <span class="scope-badge"><v-icon icon="mdi-map-outline" size="14" />Paraná</span>
            </div>
            <section class="origin-panel" aria-label="Fonte e dicionário da coleta">
              <div class="section-heading">
                <span class="step-number">01</span>
                <div>
                  <h3>Fonte de origem</h3>
                  <p>A origem define os dicionários disponíveis para validação.</p>
                </div>
              </div>
              <p v-if="compatibleSources.length === 1" class="source-resolution" role="status">
                <v-icon icon="mdi-link-variant" size="15" />Fonte identificada automaticamente:
                {{ compatibleSources[0]?.name }}.
              </p>
              <p v-else-if="compatibleSources.length > 1" class="source-resolution" role="status">
                Há mais de uma fonte compatível. Escolha a origem correta para utilizar o dicionário
                correspondente.
              </p>
              <v-alert
                v-else-if="!loading"
                type="warning"
                variant="tonal"
                density="compact"
                class="mb-4"
                >Nenhuma fonte cadastrada corresponde a este serviço. Um gestor deve cadastrar a
                fonte com a URL oficial.</v-alert
              >
              <v-select
                v-model="sourceId"
                :items="compatibleSources"
                item-title="name"
                item-value="id"
                label="Fonte dos dados"
                variant="outlined"
                density="compact"
                :loading="loading"
                :disabled="loading || locked"
                hide-details
                clearable
              />
              <p v-if="selectedSource" class="source-url">
                <v-icon icon="mdi-web" size="14" />{{ selectedSource.url }}
              </p>
              <v-progress-linear
                v-if="loadingDictionary"
                indeterminate
                color="primary"
                class="mt-4"
                aria-label="Consultando dicionário"
              />
              <v-alert
                v-if="dictionaryError"
                type="error"
                variant="tonal"
                density="compact"
                class="mt-4"
                role="alert"
                >{{ dictionaryError }}</v-alert
              >
              <IngestionDictionarySelect
                v-if="sourceId"
                :key="sourceId"
                v-model="dictionaryId"
                :dictionaries="dictionaries"
                :loading="loadingDictionary"
                :error="dictionaryError"
                :disabled="locked || loading"
              />
              <div v-if="sourceId" class="dictionary-actions">
                <v-btn
                  :to="{ path: '/dictionaries', query: { source: sourceId } }"
                  variant="text"
                  size="small"
                  prepend-icon="mdi-book-search-outline"
                  :disabled="locked"
                  >Consultar dicionários</v-btn
                ><v-btn
                  variant="text"
                  size="small"
                  prepend-icon="mdi-refresh"
                  :disabled="locked || loadingDictionary"
                  @click="loadDictionary"
                  >Conferir novamente</v-btn
                >
              </div>
              <p class="governance-note">
                Fontes e dicionários oficiais são gerenciados pelo Gestor.
              </p>
            </section>
            <CollectionForm
              :key="`${product}-${sourceId}-${userId}`"
              :connector="selectedConnector"
              :source-id="sourceId"
              :source-url="selectedSource?.url || ''"
              :user-id="userId"
              :dictionary-id="dictionaryId"
              :ready="collectionReady"
              @busy="collectionBusy = $event"
              @collected="loadDictionary"
            />
            <div class="collection-owner">
              <v-icon icon="mdi-account-circle-outline" size="18" />
              <p>
                Responsável: <strong>{{ sessionUser?.name || 'Sessão não disponível' }}</strong
                >. Os arquivos serão recebidos pela fonte e podem ser organizados em conjuntos
                depois.
              </p>
            </div>
          </template>
          <div v-else class="collection-empty">
            <span class="empty-symbol"><v-icon icon="mdi-cloud-download-outline" size="38" /></span>
            <p class="eyebrow mt-5">DADOS OFICIAIS, NA SUA FONTE</p>
            <h2>Qual serviço vamos coletar?</h2>
            <p>
              Escolha um produto na lista ao lado. Depois, confira a fonte e defina os parâmetros
              para receber e validar os arquivos.
            </p>
            <div class="flow-preview">
              <span>Serviço</span><v-icon icon="mdi-chevron-right" size="14" /><span>Fonte</span
              ><v-icon icon="mdi-chevron-right" size="14" /><span>Coleta e validação</span>
            </div>
          </div>
        </main>
      </div>
      <div v-else class="manual-layout">
        <section class="manual-files-panel" aria-label="Arquivos para envio">
          <div class="section-heading">
            <span class="step-number">01</span>
            <div>
              <h2>Arquivos para envio</h2>
              <p>Selecione os arquivos que pertencem à mesma fonte de origem.</p>
            </div>
          </div>
          <FileUploadList
            v-model="uploadedFiles"
            :allowed-extensions="['csv', 'geojson', 'json']"
            :disabled="locked"
          />
          <div class="manual-guidance">
            <v-icon icon="mdi-information-outline" size="17" />
            <div>
              <strong>O conteúdo também será validado</strong>
              <p>
                A extensão aceita não garante aprovação. Shapefile, GeoPackage e GeoTIFF não estão
                disponíveis no envio manual.
              </p>
            </div>
          </div>
          <div class="collection-owner manual-owner">
            <v-icon icon="mdi-account-circle-outline" size="18" />
            <p>
              Responsável: <strong>{{ sessionUser?.name || 'Sessão não disponível' }}</strong
              >. Os arquivos serão recebidos pela fonte e podem ser organizados em conjuntos depois.
            </p>
          </div>
        </section>

        <aside class="manual-configuration" aria-label="Configuração do envio">
          <section class="origin-panel" aria-label="Fonte e dicionário do envio">
            <div class="section-heading">
              <span class="step-number">02</span>
              <div>
                <h2>Fonte de origem</h2>
                <p>A origem define os dicionários disponíveis para validação.</p>
              </div>
            </div>
            <v-select
              v-model="sourceId"
              :items="sources"
              item-title="name"
              item-value="id"
              label="Fonte dos dados"
              variant="outlined"
              density="compact"
              :loading="loading"
              :disabled="loading || locked"
              hide-details
              clearable
            />
            <p v-if="selectedSource" class="source-url">
              <v-icon icon="mdi-web" size="14" />{{ selectedSource.url }}
            </p>
            <p v-else-if="!loading && !sources.length && !resourceError" class="governance-note">
              Nenhuma fonte disponível. Solicite ao Gestor o cadastro da origem dos dados.
            </p>
            <v-progress-linear
              v-if="loadingDictionary"
              indeterminate
              color="primary"
              class="mt-4"
              aria-label="Consultando dicionário"
            />
            <v-alert
              v-if="dictionaryError"
              type="error"
              variant="tonal"
              density="compact"
              class="mt-4"
              role="alert"
              >{{ dictionaryError }}</v-alert
            >
            <IngestionDictionarySelect
              v-if="sourceId"
              :key="sourceId"
              v-model="dictionaryId"
              :dictionaries="dictionaries"
              :loading="loadingDictionary"
              :error="dictionaryError"
              :disabled="locked || loading"
            />
            <div v-if="sourceId" class="dictionary-actions">
              <v-btn
                :to="{ path: '/dictionaries', query: { source: sourceId } }"
                variant="text"
                size="small"
                prepend-icon="mdi-book-search-outline"
                :disabled="locked"
                >Consultar dicionários</v-btn
              ><v-btn
                variant="text"
                size="small"
                prepend-icon="mdi-refresh"
                :disabled="locked || loadingDictionary"
                @click="loadDictionary"
                >Conferir novamente</v-btn
              >
            </div>
            <p class="governance-note">
              Fontes e dicionários oficiais são gerenciados pelo Gestor.
            </p>
          </section>

          <section class="manual-review" aria-label="Revisão do envio">
            <div class="section-heading">
              <span class="step-number">03</span>
              <div>
                <h2>Conferir e enviar</h2>
                <p>Cada arquivo gera uma ingestão própria.</p>
              </div>
            </div>
            <dl class="upload-summary">
              <div>
                <dt>Fonte</dt>
                <dd>{{ selectedSource?.name || 'Não selecionada' }}</dd>
              </div>
              <div>
                <dt>Seleção</dt>
                <dd>
                  {{ uploadedFiles.length }}
                  {{ uploadedFiles.length === 1 ? 'arquivo' : 'arquivos' }}
                </dd>
              </div>
              <div>
                <dt>Dicionário</dt>
                <dd>{{ dictionarySelectionSummary }}</dd>
              </div>
            </dl>
            <div v-if="isUploadInProgress" class="manual-progress" role="status" aria-live="polite">
              <p>
                Enviando e validando: <strong>{{ currentFileName }}</strong>
              </p>
              <v-progress-linear
                :model-value="overallProgress"
                color="primary"
                rounded
                height="4"
              />
              <span>{{ completedFiles }} de {{ totalFiles }} arquivos concluídos.</span>
            </div>
            <p v-else class="manual-readiness">
              {{
                manualReady
                  ? 'Tudo pronto para enviar. O resultado da validação será apresentado por arquivo.'
                  : 'Selecione arquivo e fonte com dicionário para continuar com o usuário da sessão.'
              }}
            </p>
            <v-btn
              block
              color="primary"
              prepend-icon="mdi-file-upload-outline"
              :disabled="!manualReady || locked"
              :loading="isUploadInProgress"
              @click="showConfirm = true"
              >Enviar e validar arquivos</v-btn
            >
          </section>
        </aside>

        <section
          v-if="uploadResults.length"
          class="manual-results"
          aria-label="Resultado do último envio"
          aria-live="polite"
          :aria-busy="isUploadInProgress"
        >
          <div class="results-heading">
            <div>
              <p class="eyebrow">RETORNO DA VALIDAÇÃO</p>
              <h2>Resultado do último envio</h2>
            </div>
            <span class="scope-badge">
              {{ uploadResults.length }}
              {{ uploadResults.length === 1 ? 'resultado' : 'resultados' }}
            </span>
          </div>
          <article v-for="(result, i) in uploadResults" :key="i" class="manual-result">
            <div class="upload-result-heading">
              <span class="dictionary-icon"
                ><v-icon icon="mdi-file-document-outline" size="20"
              /></span>
              <h3>{{ result.name }}</h3>
              <span v-if="!result.validation" class="scope-badge">Sem relatório</span>
            </div>
            <ValidationResult
              v-if="result.validation"
              :report="result.validation"
              :file-id="result.fileId"
            />
            <v-alert
              v-else
              type="warning"
              variant="tonal"
              density="compact"
              class="mt-4"
              role="alert"
            >
              {{ result.message }}
            </v-alert>
          </article>
        </section>
      </div>
    </template>
    <ConfirmDialog
      v-model="showConfirm"
      title="Enviar e validar arquivos"
      :message="`Enviar ${uploadedFiles.length} arquivo(s) para a fonte ${selectedSource?.name || 'selecionada'} com o usuário da sessão? Dicionário: ${dictionarySelectionSummary}. Apenas os registros aprovados ficarão disponíveis para tratamento e visualização.`"
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
import IngestionDictionarySelect from '@/components/IngestionDictionarySelect.vue'
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
import {
  isUploadInProgress,
  startUpload,
  uploadResults,
  currentFileName,
  overallProgress,
  completedFiles,
  totalFiles,
} from '@/composables/uploadLock'

function serviceIcon(id: string) {
  const icons: Record<string, string> = {
    IBGE_MUNICIPIOS: 'mdi-map-marker-radius-outline',
    IBGE_BIOMAS: 'mdi-forest-outline',
    INPE_PRODES: 'mdi-tree-outline',
    INPE_QUEIMADAS: 'mdi-fire',
  }
  return icons[id] ?? 'mdi-cloud-download-outline'
}

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
const dictionaries = ref<Dictionary[]>([])
const dictionaryId = ref<number | null>(null)
const selectedDictionary = computed(() =>
  dictionaryId.value === null
    ? dictionaries.value[0]
    : dictionaries.value.find((dictionary) => dictionary.id === dictionaryId.value),
)
const dictionarySelectionSummary = computed(() =>
  dictionaryId.value === null
    ? 'Automático · versão mais recente'
    : selectedDictionary.value
      ? `${selectedDictionary.value.name} · v${selectedDictionary.value.version} · #${selectedDictionary.value.id}`
      : 'Dicionário indisponível',
)
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
    selectedDictionary.value?.sourceId === sourceId.value &&
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
  if (product.value === id) return
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
  dictionaries.value = []
  dictionaryError.value = ''
  const requestedSourceId = sourceId.value
  if (!requestedSourceId) {
    loadingDictionary.value = false
    return
  }
  loadingDictionary.value = true
  try {
    const { data } = await axios.get<Dictionary[]>(`/fontes/${requestedSourceId}/dicionarios`)
    if (epoch === dictionaryEpoch)
      dictionaries.value = data
        .filter((dictionary) => dictionary.sourceId === requestedSourceId)
        .sort((a, b) => b.version - a.version)
  } catch (e) {
    if (epoch === dictionaryEpoch) dictionaryError.value = apiError(e)
  } finally {
    if (epoch === dictionaryEpoch) loadingDictionary.value = false
  }
}
watch(
  sourceId,
  () => {
    dictionaryId.value = null
    void loadDictionary()
  },
  { flush: 'sync' },
)
async function submitManual() {
  if (!manualReady.value || locked.value || !sourceId.value || !userId.value) return
  await startUpload(sourceId.value, [...uploadedFiles.value], userId.value, dictionaryId.value)
  await loadDictionary()
}
onMounted(loadResources)
</script>

<style scoped>
.ingestion-page {
  max-width: 1000px;
}
.ingestion-page--expanded {
  max-width: 1500px;
}
.ingestion-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
  margin-bottom: 24px;
}
.ingestion-heading > div > p:last-child {
  font-size: 13px;
}
.eyebrow {
  font-size: 10px;
  letter-spacing: 0.12em;
  font-weight: 700;
  color: rgb(var(--v-theme-primary));
  margin-bottom: 6px;
}
.automatic-layout {
  display: grid;
  grid-template-columns: 290px minmax(0, 1fr);
  gap: 24px;
  align-items: start;
}
.service-catalog {
  border: 1px solid var(--glass-outer-border);
  border-radius: 18px;
  background: rgba(var(--v-theme-surface), 0.45);
  overflow: hidden;
}
.catalog-heading {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 20px 16px 12px;
}
.catalog-heading-icon,
.service-icon,
.dictionary-icon,
.empty-symbol {
  display: grid;
  place-items: center;
  flex-shrink: 0;
  color: rgb(var(--v-theme-primary));
  background: rgba(var(--v-theme-primary), 0.08);
  border-radius: 12px;
  width: 40px;
  height: 40px;
}
.catalog-heading h2 {
  font-size: 13px;
  font-weight: 600;
}
.catalog-heading p {
  font-size: 10px;
  margin-top: 4px;
  color: rgba(var(--v-theme-on-surface), 0.5);
}
.catalog-instruction {
  font-size: 11px;
  padding: 0 16px 16px;
  color: rgba(var(--v-theme-on-surface), 0.6);
}
.service-list {
  display: grid;
  gap: 6px;
  padding: 0 10px 16px;
}
.service-button {
  padding: 14px 10px;
  border: 1px solid transparent;
  border-radius: 12px;
  text-align: left;
  text-transform: none;
  letter-spacing: 0;
}
.service-button :deep(.v-btn__content) {
  display: flex;
  justify-content: flex-start;
  width: 100%;
  gap: 10px;
  white-space: normal;
}
.service-icon {
  width: 36px;
  height: 36px;
  background: rgba(var(--v-theme-on-surface), 0.035);
  color: rgba(var(--v-theme-on-surface), 0.6);
  border-radius: 10px;
}
.service-label {
  display: grid;
  gap: 4px;
  flex: 1;
  min-width: 0;
}
.service-label small {
  font-size: 9px;
  letter-spacing: 0.08em;
  color: rgba(var(--v-theme-on-surface), 0.5);
}
.service-label strong {
  font-size: 12px;
  font-weight: 500;
  line-height: 1.5;
}
.service-indicator {
  color: rgba(var(--v-theme-on-surface), 0.3);
}
.service-button.is-selected {
  border-color: rgba(var(--v-theme-primary), 0.3);
  background: rgba(var(--v-theme-primary), 0.08);
}
.is-selected .service-icon {
  background: rgba(var(--v-theme-primary), 0.1);
  color: rgb(var(--v-theme-primary));
}
.is-selected .service-indicator {
  color: rgb(var(--v-theme-primary));
}
.catalog-empty {
  padding: 16px;
  font-size: 12px;
  color: rgba(var(--v-theme-on-surface), 0.6);
}
.other-services {
  border-top: 1px solid var(--glass-outer-border);
}
.other-services > summary {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 16px;
  font-size: 10px;
  cursor: pointer;
  list-style: none;
  color: rgba(var(--v-theme-on-surface), 0.65);
}
.other-services > summary::-webkit-details-marker {
  display: none;
}
.other-services > summary > span {
  flex: 1;
}
.other-services[open] .details-chevron {
  transform: rotate(180deg);
}
.other-service {
  display: grid;
  gap: 5px;
  margin: 0 16px 16px;
}
.other-service strong {
  font-size: 11px;
  font-weight: 500;
}
.other-service span {
  font-size: 10px;
  color: rgb(var(--v-theme-primary));
}
.other-service p {
  font-size: 10px;
  line-height: 1.6;
  color: rgba(var(--v-theme-on-surface), 0.5);
}
.catalog-footer {
  display: flex;
  align-items: flex-start;
  gap: 7px;
  padding: 14px 16px;
  border-top: 1px solid var(--glass-outer-border);
  color: rgba(var(--v-theme-on-surface), 0.5);
}
.catalog-footer :deep(.v-icon) {
  flex-shrink: 0;
  margin-top: 1px;
}
.catalog-footer p {
  font-size: 10px;
  line-height: 1.6;
}
.collection-workspace {
  min-width: 0;
  display: grid;
  gap: 18px;
}
.selected-service-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}
.scope-badge {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  border: 1px solid var(--glass-outer-border);
  border-radius: 8px;
  padding: 5px 8px;
  font-size: 10px;
  color: rgba(var(--v-theme-on-surface), 0.65);
}
.origin-panel,
.manual-files-panel,
.manual-review,
.manual-result {
  padding: 24px;
  border: 1px solid var(--glass-outer-border);
  border-radius: 18px;
  background: rgba(var(--v-theme-surface), 0.45);
}
.section-heading {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 20px;
}
.step-number {
  display: grid;
  place-items: center;
  width: 32px;
  height: 32px;
  border: 1px solid rgba(var(--v-theme-primary), 0.2);
  border-radius: 10px;
  color: rgb(var(--v-theme-primary));
  font-size: 11px;
  font-weight: 600;
  flex-shrink: 0;
}
.section-heading h2,
.section-heading h3 {
  font-size: 14px;
  font-weight: 600;
}
.section-heading p {
  font-size: 11px;
  color: rgba(var(--v-theme-on-surface), 0.55);
  margin-top: 4px;
}
.source-resolution {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  color: rgba(var(--v-theme-on-surface), 0.65);
  margin-bottom: 16px;
  line-height: 1.6;
}
.source-url {
  overflow-wrap: anywhere;
}
.origin-panel > .source-url {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 10px;
  color: rgba(var(--v-theme-on-surface), 0.5);
  margin-top: 10px;
}
.dictionary-icon {
  width: 34px;
  height: 34px;
  border-radius: 10px;
}
.dictionary-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin: 10px -6px 0;
}
.dictionary-actions :deep(.v-btn) {
  text-transform: none;
  letter-spacing: 0;
  font-size: 10px;
}
.governance-note {
  font-size: 10px;
  color: rgba(var(--v-theme-on-surface), 0.45);
  margin-top: 14px;
}
.collection-owner {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 0 4px;
  color: rgba(var(--v-theme-on-surface), 0.5);
}
.collection-owner :deep(.v-icon) {
  flex-shrink: 0;
  margin-top: 2px;
}
.collection-owner p {
  font-size: 10px;
  line-height: 1.7;
}
.collection-owner strong {
  font-weight: 500;
  color: rgba(var(--v-theme-on-surface), 0.75);
}
.collection-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  text-align: center;
  min-height: 460px;
  padding: 36px;
  border: 1px dashed var(--glass-outer-border);
  border-radius: 18px;
}
.empty-symbol {
  width: 76px;
  height: 76px;
  border-radius: 24px;
}
.collection-empty h2 {
  font-size: 19px;
  font-weight: 500;
  margin: 4px 0 12px;
}
.collection-empty > p:not(.eyebrow) {
  font-size: 12px;
  color: rgba(var(--v-theme-on-surface), 0.6);
  line-height: 1.8;
  max-width: 400px;
}
.flow-preview {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  flex-wrap: wrap;
  margin-top: 28px;
  font-size: 10px;
  color: rgba(var(--v-theme-on-surface), 0.5);
}
.flow-preview > span {
  border: 1px solid var(--glass-outer-border);
  border-radius: 7px;
  padding: 6px 9px;
}
.manual-layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 380px;
  align-items: start;
  gap: 24px;
}
.manual-files-panel,
.manual-configuration {
  min-width: 0;
}
.manual-configuration {
  display: grid;
  gap: 18px;
}
.manual-guidance {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 20px 0;
  margin-top: 8px;
}
.manual-guidance > :deep(.v-icon) {
  color: rgba(var(--v-theme-on-surface), 0.5);
  flex-shrink: 0;
  margin-top: 2px;
}
.manual-guidance strong {
  font-size: 11px;
  font-weight: 500;
  color: rgba(var(--v-theme-on-surface), 0.8);
}
.manual-guidance p {
  font-size: 11px;
  line-height: 1.7;
  color: rgba(var(--v-theme-on-surface), 0.55);
  margin-top: 5px;
}
.manual-owner {
  border-top: 1px solid var(--glass-outer-border);
  padding-top: 18px;
}
.upload-summary {
  display: grid;
  gap: 12px;
  padding-bottom: 18px;
  border-bottom: 1px solid var(--glass-outer-border);
}
.upload-summary > div {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  font-size: 12px;
}
.upload-summary dt {
  color: rgba(var(--v-theme-on-surface), 0.5);
  flex-shrink: 0;
}
.upload-summary dd {
  min-width: 0;
  text-align: right;
  overflow-wrap: anywhere;
}
.manual-readiness,
.manual-progress {
  margin: 18px 0;
  font-size: 11px;
  color: rgba(var(--v-theme-on-surface), 0.6);
  line-height: 1.7;
}
.manual-progress p {
  overflow-wrap: anywhere;
  margin-bottom: 12px;
}
.manual-progress strong {
  font-weight: 500;
  color: rgba(var(--v-theme-on-surface), 0.8);
}
.manual-progress > span {
  display: block;
  margin-top: 8px;
  font-size: 10px;
}
.manual-review > :deep(.v-btn) {
  border-radius: 10px;
  text-transform: none;
  letter-spacing: 0;
  font-size: 12px;
}
.manual-results {
  grid-column: 1 / -1;
  min-width: 0;
  display: grid;
  gap: 16px;
  margin-top: 4px;
}
.results-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}
.results-heading h2 {
  font-size: 16px;
  font-weight: 500;
}
.upload-result-heading {
  display: flex;
  align-items: center;
  gap: 12px;
}
.upload-result-heading h3 {
  min-width: 0;
  flex: 1;
  font-size: 13px;
  font-weight: 500;
  overflow-wrap: anywhere;
}
@media (max-width: 1100px) {
  .automatic-layout {
    grid-template-columns: 250px minmax(0, 1fr);
    gap: 16px;
  }
  .manual-layout {
    grid-template-columns: minmax(0, 1fr) 340px;
    gap: 16px;
  }
  .origin-panel,
  .manual-files-panel,
  .manual-review,
  .manual-result {
    padding: 20px;
  }
}
@media (max-width: 1000px) {
  .manual-layout {
    grid-template-columns: 1fr;
  }
}
@media (max-width: 850px) {
  .automatic-layout {
    grid-template-columns: 1fr;
  }
  .service-list {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .collection-empty {
    min-height: 300px;
  }
}
@media (max-width: 500px) {
  .service-list {
    grid-template-columns: 1fr;
  }
  .origin-panel,
  .manual-files-panel,
  .manual-review,
  .manual-result {
    padding: 16px;
  }
  .collection-empty {
    padding: 24px;
  }
}
</style>
