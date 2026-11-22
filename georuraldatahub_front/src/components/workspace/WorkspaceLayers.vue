<template>
  <section class="layers-panel environmental-surface">
    <header class="page-heading">
      <div>
        <h2>Camadas</h2>
        <p>Consulte os dados preparados ou crie uma camada a partir de um arquivo tratado.</p>
      </div>
      <v-btn
        v-if="can('ingestion.run')"
        color="primary"
        prepend-icon="mdi-plus"
        :disabled="busy"
        @click="openImport"
        >Preparar camada</v-btn
      >
    </header>
    <div class="workflow-guide">
      <div>
        <strong>1. Arquivo tratado</strong
        ><span>Escolha um arquivo aprovado dentro de um conjunto.</span>
      </div>
      <div>
        <strong>2. Camada preparada</strong
        ><span>Os registros são gravados como feições no Oracle Spatial.</span>
      </div>
      <div>
        <strong>3. Indicador e relatório</strong
        ><span>Escolha uma área e as camadas de dados nos Medidores.</span>
      </div>
    </div>
    <p class="note">
      Uma camada reúne várias feições. Por exemplo: uma camada de municípios contém um polígono para
      cada município.
    </p>
    <div class="catalog-search">
      <v-text-field
        v-model="search"
        label="Buscar camada"
        prepend-inner-icon="mdi-magnify"
        density="compact"
        variant="outlined"
        hide-details
        clearable
        @keyup.enter="load(0)"
      />
      <v-btn variant="tonal" :loading="loading" @click="load(0)">Buscar</v-btn>
      <v-btn variant="text" @click="filtersOpen = !filtersOpen" :aria-expanded="filtersOpen"
        >Filtros</v-btn
      >
    </div>
    <div v-if="filtersOpen" class="filters secondary-filters">
      <v-autocomplete
        :menu-props="{ contentClass: 'environmental-menu' }"
        v-model="dataset"
        :items="datasets"
        item-title="name"
        item-value="id"
        label="Conjunto"
        density="compact"
        variant="outlined"
        clearable
        hide-details
        :disabled="busy"
      />
      <v-select
        :menu-props="{ contentClass: 'environmental-menu' }"
        v-model="type"
        :items="geometryTypes"
        label="Tipo"
        density="compact"
        variant="outlined"
        clearable
        hide-details
      />
      <v-text-field
        v-model="source"
        label="Fonte"
        density="compact"
        variant="outlined"
        hide-details
        @keyup.enter="load(0)"
      />
    </div>
    <v-btn
      v-if="can('ingestion.run') && compositionEnabled"
      variant="text"
      :disabled="!dataset || busy"
      @click="showCombine = true"
      >Combinar camadas</v-btn
    >
    <v-alert v-if="error" type="error" class="my-3">{{ error }}</v-alert>
    <v-alert v-if="success" type="success" class="my-3">{{ success }}</v-alert>
    <div v-if="success" class="completion-action">
      <v-btn color="primary" variant="tonal" @click="goToIndicators">Ir para Medidores</v-btn
      ><span class="note"
        >A camada não define seu papel no indicador. Você escolhe esse uso na próxima tela.</span
      >
    </div>
    <div v-if="!loading && !rows.length" class="empty">
      Nenhuma camada encontrada. Use “Preparar camada” ou ajuste os filtros.
    </div>
    <v-list v-else class="catalog" bg-color="transparent"
      ><v-list-item
        v-for="layer in rows"
        :key="layer.id"
        :title="layer.name"
        :subtitle="`${layer.dataset} · ${layer.source} · ${geometrySummary(layer)} · ${layer.features} feições`"
        prepend-icon="mdi-layers-outline"
        @click="details(layer.id)"
        ><template #append><v-icon icon="mdi-chevron-right" /></template></v-list-item
    ></v-list>
    <div class="pages">
      <v-btn variant="text" :disabled="!page || loading" @click="load(page - 1)">Anterior</v-btn
      ><span>{{ total }} camadas · página {{ page + 1 }}</span
      ><v-btn variant="text" :disabled="(page + 1) * 20 >= total || loading" @click="load(page + 1)"
        >Próxima</v-btn
      >
    </div>
    <v-dialog v-model="showImport" max-width="720" :persistent="busy" scrollable>
      <v-card class="import-card environmental-surface" rounded="lg">
        <v-card-title class="pt-6 px-6">Preparar camada para análise</v-card-title>
        <v-card-text class="px-6">
          <p class="import-intro">
            Selecione o conjunto e o arquivo tratado. O original será preservado; uma nova camada
            ficará disponível para os indicadores.
          </p>
          <v-autocomplete
            :menu-props="{ contentClass: 'environmental-menu' }"
            v-model="importDataset"
            :items="datasets"
            item-title="name"
            item-value="id"
            label="1. Escolha o conjunto"
            variant="outlined"
            density="comfortable"
            :disabled="busy"
          />
          <template v-if="importDataset">
            <h3 class="file-heading">2. Escolha o arquivo</h3>
            <div class="catalog-search">
              <v-text-field
                v-model="versionSearch"
                label="Buscar arquivo"
                variant="outlined"
                density="compact"
                hide-details
                :disabled="busy"
                @keyup.enter="loadVersions(0)"
              />
              <v-btn
                variant="text"
                :disabled="busy"
                :loading="versionsLoading"
                @click="loadVersions(0)"
                >Buscar</v-btn
              >
            </div>
            <v-progress-linear v-if="versionsLoading" indeterminate color="primary" class="my-3" />
            <div v-else-if="!versions.length" class="file-empty">
              Nenhum arquivo disponível para preparar. Arquivos já importados não aparecem aqui;
              confira o catálogo de camadas. Se ainda não importou, conclua o tratamento e a
              associação ao conjunto.
            </div>
            <div v-else class="file-choices" role="radiogroup" aria-label="Arquivo tratado">
              <button
                v-for="version in versions"
                :key="version.id"
                type="button"
                role="radio"
                :aria-checked="versionId === version.id"
                :disabled="busy || version.importedLayers > 0"
                :class="['file-choice', { 'is-selected': versionId === version.id }]"
                @click="versionId = version.id"
              >
                <v-icon
                  :icon="versionId === version.id ? 'mdi-radiobox-marked' : 'mdi-radiobox-blank'"
                  size="20"
                />
                <span class="file-description"
                  ><strong>{{ version.file }}</strong
                  ><small
                    >{{ version.source }} · {{ version.format }} · Versão
                    {{ version.number }}</small
                  ></span
                >
                <span v-if="version.importedLayers" class="file-status">Já criada</span>
              </button>
            </div>
            <div v-if="versionTotal > 20" class="pages">
              <v-btn
                variant="text"
                :disabled="!versionPage || busy || versionsLoading"
                @click="loadVersions(versionPage - 1)"
                >Anterior</v-btn
              ><span>Página {{ versionPage + 1 }}</span
              ><v-btn
                variant="text"
                :disabled="(versionPage + 1) * 20 >= versionTotal || busy || versionsLoading"
                @click="loadVersions(versionPage + 1)"
                >Próxima</v-btn
              >
            </div>
          </template>
          <v-alert v-if="dialogError" type="error" class="mt-3"
            ><template v-if="dialogError.includes('13349')">
              Um polígono deste arquivo tem um contorno que se cruza. A camada não foi criada. Você
              pode permitir uma tentativa de correção abaixo ou revisar o arquivo de origem.
              <details class="repair-diagnostic">
                <summary>Detalhes técnicos</summary>
                {{ dialogError }}
              </details> </template
            ><template v-else>{{ dialogError }}</template></v-alert
          >
          <div v-if="versionId" class="repair-option">
            <v-checkbox
              v-model="repairGeometry"
              :disabled="busy"
              hide-details
              density="compact"
              label="Permitir correção de contornos que se cruzam"
            />
            <p class="note">
              Opcional. O reparo pode alterar o contorno e a área utilizada nos indicadores. O
              arquivo original é preservado e a correção aplicada fica registrada nos atributos da
              feição. Confira a geometria no mapa antes de usar o resultado.
            </p>
          </div>
          <p v-if="versionId" class="import-summary">
            Uma camada será criada com as feições desse arquivo. Após preparar, use “Ir para
            Medidores” para escolher o indicador.
          </p>
          <p v-if="busy" class="import-summary" role="status">
            Preparando os registros. Isso pode levar alguns minutos.
          </p>
        </v-card-text>
        <v-card-actions class="px-6 pb-5"
          ><v-spacer /><v-btn :disabled="busy" @click="showImport = false">Cancelar</v-btn
          ><v-btn
            color="primary"
            variant="flat"
            :loading="busy"
            :disabled="!versionId || versionsLoading"
            @click="importSelected"
            >Preparar camada</v-btn
          ></v-card-actions
        >
      </v-card>
    </v-dialog>
    <v-dialog v-model="showCombine" max-width="680" :persistent="busy"
      ><v-card class="environmental-surface" title="Combinar camadas"
        ><v-card-text>
          <v-text-field
            variant="outlined"
            v-model="combinedName"
            label="Nome da camada composta"
            maxlength="200"
            :disabled="busy"
          />
          <EnvironmentalLayerPicker
            v-model="combinedIds"
            label="Camadas originais do conjunto"
            multiple
            originals-only
            :dataset="dataset ?? undefined"
            :disabled="busy"
            @layers="cacheLayers"
          />
          <p class="note">
            Escolha dados do mesmo papel ambiental e SRID. A composição copia feições sem eliminar
            duplicatas nem dissolver geometrias; não cria uma área única de análise.
          </p>
          <v-alert v-if="dialogError" type="error">{{ dialogError }}</v-alert> </v-card-text
        ><v-card-actions
          ><v-btn :disabled="busy" @click="showCombine = false">Fechar</v-btn
          ><v-btn color="primary" :loading="busy" :disabled="!canCombine" @click="combine"
            >Combinar</v-btn
          ></v-card-actions
        ></v-card
      ></v-dialog
    >
    <v-dialog v-model="showDetails" max-width="760" scrollable>
      <v-card v-if="detail" class="environmental-surface layer-detail-card">
        <header class="layer-detail-heading">
          <span class="layer-detail-icon"><v-icon icon="mdi-layers-outline" size="26" /></span>
          <div>
            <span class="detail-eyebrow">Camada pronta para análise</span>
            <h2>{{ friendlyName(detail.layer.name) }}</h2>
          </div>
        </header>
        <v-card-text class="layer-detail-body"
          ><div class="layer-facts">
            <div>
              <span>Feições</span
              ><strong>{{ detail.layer.features.toLocaleString('pt-BR') }}</strong>
            </div>
            <div>
              <span>Geometria</span><strong>{{ geometrySummary(detail.layer) }}</strong>
            </div>
          </div>
          <p class="detail-explanation">
            Cada feição representa uma área ou um registro. Nos indicadores, você pode escolher uma,
            várias ou todas as áreas poligonais.
          </p>
          <dl class="layer-context">
            <dt>Conjunto</dt>
            <dd>{{ detail.layer.dataset }}</dd>
            <dt>Coordenadas</dt>
            <dd>
              EPSG:{{ detail.layer.srid
              }}<span v-if="detail.layer.srid === 4326"> · WGS84, longitude e latitude</span>
            </dd>
          </dl>
          <p v-if="metadataError" class="detail-explanation">{{ metadataError }}</p>
          <template v-if="metadata">
            <p class="detail-explanation">
              {{ metadata.repairedFeatures }} feição(ões) com reparo registrado na importação.
            </p>
            <details v-if="metadata.repairs.length">
              <summary>Consultar reparos (até 20 registros)</summary>
              <p v-for="repair in metadata.repairs" :key="repair.featureId">{{ repair.name }}</p>
            </details>
            <details v-if="metadata.days.length">
              <summary>Datas com registros ({{ metadata.days.length }} dias)</summary>
              <p class="detail-explanation">
                {{ metadata.days.map((day) => day.date).join(', ') }}. Dias com registros não
                comprovam cobertura contínua.
              </p>
            </details>
            <p v-if="metadata.undatedRecords" class="detail-explanation">
              {{ metadata.undatedRecords }} registro(s) sem data de evento válida.
            </p>
          </template>
          <h3 class="origins-heading">Arquivos e fontes</h3>
          <article
            v-for="origin in detail.origins.length ? detail.origins : [detail.layer]"
            :key="origin.id"
            class="origin-card"
          >
            <v-icon icon="mdi-file-document-outline" size="22" />
            <div>
              <strong>{{ origin.file || origin.name }}</strong
              ><span>{{ origin.source }}</span
              ><small v-if="origin.name && origin.name !== origin.file">{{ origin.name }}</small>
            </div>
          </article> </v-card-text
        ><v-card-actions class="detail-actions"
          ><v-btn @click="showDetails = false">Fechar</v-btn
          ><v-btn color="primary" variant="flat" prepend-icon="mdi-gauge" @click="goToIndicators"
            >Ir para Medidores</v-btn
          ></v-card-actions
        >
      </v-card>
    </v-dialog>
  </section>
</template>
<script setup lang="ts">
import { computed, onMounted, onBeforeUnmount, ref, watch } from 'vue'
import axios from 'axios'
import { can } from '@/access/session'
import { apiError } from '@/services/contracts'
import {
  listLayers,
  listVersions,
  importLayer,
  layerDetails,
  layerData,
  type LayerData,
  combineLayers,
  type Layer,
  type ImportableVersion,
} from '@/services/environmentalIndicators'
import EnvironmentalLayerPicker from './EnvironmentalLayerPicker.vue'
const emit = defineEmits<{ useIndicators: [] }>()
const filtersOpen = ref(false)
const props = defineProps<{ initialDataset?: number | null }>()
const dataset = ref<number | null>(props.initialDataset ?? null),
  datasets = ref<{ id: number; name: string }[]>([]),
  search = ref(''),
  type = ref<string | null>(null),
  source = ref('')
const rows = ref<Layer[]>([]),
  page = ref(0),
  total = ref(0),
  loading = ref(false),
  busy = ref(false),
  error = ref(''),
  success = ref(''),
  dialogError = ref('')
const repairGeometry = ref(false)
const importDataset = ref<number | null>(null)
const showImport = ref(false),
  versions = ref<ImportableVersion[]>([]),
  versionId = ref<number | null>(null),
  versionSearch = ref(''),
  versionPage = ref(0),
  versionTotal = ref(0),
  versionsLoading = ref(false)
const metadata = ref<LayerData | null>(null),
  metadataError = ref('')
const showDetails = ref(false),
  detail = ref<{ layer: Layer; origins: Layer[] } | null>(null),
  showCombine = ref(false),
  compositionEnabled = ref(false),
  combinedName = ref(''),
  combinedIds = ref<number[]>([])
const geometryTypes = [
  { title: 'Pontos', value: 'POINT' },
  { title: 'Polígonos', value: 'POLYGON' },
  { title: 'Multipolígonos', value: 'MULTIPOLYGON' },
  { title: 'Linhas', value: 'LINESTRING' },
  { title: 'Multipontos', value: 'MULTIPOINT' },
  { title: 'Multilinhas', value: 'MULTILINESTRING' },
  { title: 'Mista', value: 'MIXED' },
]
const geometryLabel = (value: string) =>
  geometryTypes.find((t) => t.value === value)?.title ?? value
function friendlyName(name: string) {
  return name.replace(/\.(geojson|json|csv|zip|gpkg)$/i, '').replace(/_/g, ' ')
}
function geometrySummary(layer: Layer) {
  return layer.geometry === 'MIXED' && layer.features > 0 && layer.polygons === layer.features
    ? 'Polígonos e multipolígonos'
    : geometryLabel(layer.geometry)
}
const cache = new Map<number, Layer>()
function cacheLayers(items: Layer[]) {
  for (const item of items) cache.set(item.id, item)
}
const canCombine = computed(
  () =>
    combinedName.value.trim() &&
    combinedIds.value.length >= 2 &&
    combinedIds.value.length <= 100 &&
    combinedIds.value.every((id) => {
      const l = cache.get(id)
      return (
        l &&
        !l.composed &&
        l.datasetId === dataset.value &&
        l.srid === cache.get(combinedIds.value[0]!)?.srid
      )
    }),
)
let epoch = 0,
  versionEpoch = 0,
  detailEpoch = 0
async function load(next: number) {
  const request = ++epoch
  loading.value = true
  error.value = ''
  try {
    const data = await listLayers(search.value, next, {
      conjunto: dataset.value ?? undefined,
      tipo: type.value ?? undefined,
      fonte: source.value || undefined,
    })
    if (request !== epoch) return
    rows.value = data.items
    page.value = next
    total.value = data.total
  } catch (e) {
    if (request === epoch) error.value = apiError(e)
  } finally {
    if (request === epoch) loading.value = false
  }
}
async function loadVersions(next: number) {
  if (!importDataset.value) return
  const request = ++versionEpoch
  versionsLoading.value = true
  versionId.value = null
  dialogError.value = ''
  try {
    const data = await listVersions(importDataset.value, versionSearch.value, next)
    if (request !== versionEpoch) return
    versions.value = data.items
    versionPage.value = next
    versionTotal.value = data.total
  } catch (e) {
    if (request === versionEpoch) dialogError.value = apiError(e)
  } finally {
    if (request === versionEpoch) versionsLoading.value = false
  }
}
function openImport() {
  showImport.value = true
  versionSearch.value = ''
  versionId.value = null
  repairGeometry.value = false
  dialogError.value = ''
  if (importDataset.value === dataset.value && dataset.value) void loadVersions(0)
  else importDataset.value = dataset.value
}
async function details(id: number) {
  const request = ++detailEpoch
  metadata.value = null
  metadataError.value = ''
  try {
    const data = await layerDetails(id)
    if (request !== detailEpoch) return
    detail.value = data
    showDetails.value = true
    void layerData(id)
      .then((value) => {
        if (request === detailEpoch) metadata.value = value
      })
      .catch(() => {
        if (request === detailEpoch)
          metadataError.value = 'Datas e registros de reparo indisponíveis para consulta.'
      })
  } catch (e) {
    if (request === detailEpoch) error.value = apiError(e)
  }
}
async function completed(id: number, count: number) {
  success.value = `Camada criada com ${count} feições.`
  showImport.value = false
  showCombine.value = false
  await load(0)
  await details(id)
}
async function importSelected() {
  if (!importDataset.value || !versionId.value || busy.value || !can('ingestion.run')) return
  busy.value = true
  dialogError.value = ''
  try {
    const data = await importLayer(importDataset.value, versionId.value, repairGeometry.value)
    await completed(data.camadaId, data.quantidade)
  } catch (e) {
    dialogError.value = apiError(e)
  } finally {
    busy.value = false
  }
}
async function combine() {
  if (!dataset.value || !canCombine.value || busy.value || !can('ingestion.run')) return
  busy.value = true
  dialogError.value = ''
  try {
    const data = await combineLayers(dataset.value, combinedName.value.trim(), combinedIds.value)
    await completed(data.camadaId, data.quantidade)
  } catch (e) {
    dialogError.value = apiError(e)
  } finally {
    busy.value = false
  }
}
function goToIndicators() {
  showDetails.value = false
  emit('useIndicators')
}
watch(dataset, () => {
  combinedIds.value = []
  void load(0)
})
watch(versionId, () => {
  repairGeometry.value = false
  dialogError.value = ''
})
watch(importDataset, () => {
  versionEpoch++
  versions.value = []
  versionId.value = null
  versionSearch.value = ''
  versionTotal.value = 0
  versionsLoading.value = false
  dialogError.value = ''
  if (showImport.value && importDataset.value) void loadVersions(0)
})
watch(showCombine, () => {
  dialogError.value = ''
})
onMounted(async () => {
  void load(0)
  try {
    datasets.value = (await axios.get('/conjuntos')).data
    compositionEnabled.value =
      (await axios.get('/ambiental/recursos')).data.compositionEnabled === true
  } catch (e) {
    error.value = apiError(e)
  }
})
onBeforeUnmount(() => {
  epoch++
  versionEpoch++
  detailEpoch++
})
</script>
<style scoped>
.layers-panel {
  width: 100%;
  max-width: 1000px;
  min-height: 0;
  overflow: auto;
  pointer-events: auto;
  padding: 24px;
  border-radius: 18px;
  background: rgba(var(--v-theme-surface), 0.97);
  border: 1px solid rgba(var(--v-theme-on-surface), 0.1);
}
header {
  margin-bottom: 24px;
}
header h2 {
  margin: 6px 0;
}
.eyebrow {
  font-size: 10px;
  letter-spacing: 0.14em;
  color: rgb(var(--v-theme-primary));
}
header p,
.note {
  font-size: 12px;
  line-height: 1.7;
  color: rgba(var(--v-theme-on-surface), 0.65);
  margin: 12px 0;
}
.filters {
  display: flex;
  gap: 12px;
  align-items: center;
  flex-wrap: wrap;
}
.filters > * {
  flex: 1;
  min-width: 130px;
}
.filters > .v-btn {
  flex: 0;
}
.catalog {
  margin-top: 20px;
}
.catalog :deep(.v-list-item) {
  border-bottom: 1px solid rgba(var(--v-theme-on-surface), 0.08);
  padding: 16px 4px;
}
.pages {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 12px;
}
.empty {
  padding: 32px 0;
  color: rgba(var(--v-theme-on-surface), 0.6);
}
dl {
  display: grid;
  grid-template-columns: 100px 1fr;
  gap: 10px;
}
ul {
  padding-left: 20px;
  line-height: 1.8;
}
.page-heading {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 20px;
  margin-bottom: 28px;
}
.page-heading h2 {
  font-size: 24px;
  margin: 0 0 6px;
}
.page-heading p {
  margin: 0;
}
.catalog-search {
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 12px 0 20px;
}
.catalog-search > .v-input {
  flex: 1;
  min-width: 0;
}
.secondary-filters {
  margin-bottom: 20px;
}
.import-intro {
  font-size: 14px;
  line-height: 1.6;
  margin: 0 0 24px;
  color: rgba(var(--v-theme-on-surface), 0.7);
}
.file-heading {
  font-size: 14px;
  margin: 8px 0 16px;
}
.file-choices {
  display: grid;
  gap: 10px;
  margin: 16px 0;
}
.file-choice {
  display: flex;
  align-items: center;
  gap: 14px;
  width: 100%;
  padding: 16px;
  text-align: left;
  border: 1px solid rgba(var(--v-theme-on-surface), 0.15);
  border-radius: 12px;
  color: inherit;
  background: transparent;
  cursor: pointer;
}
.file-choice:hover {
  background: rgba(var(--v-theme-on-surface), 0.04);
}
.file-choice.is-selected {
  border-color: rgb(var(--v-theme-primary));
  background: rgba(var(--v-theme-primary), 0.06);
}
.file-choice:disabled {
  opacity: 0.45;
  cursor: default;
}
.file-description {
  display: grid;
  gap: 6px;
  min-width: 0;
}
.file-description strong {
  font-size: 14px;
  overflow-wrap: anywhere;
}
.file-description small,
.file-status {
  font-size: 12px;
  color: rgba(var(--v-theme-on-surface), 0.6);
}
.file-status {
  margin-left: auto;
}
.file-empty {
  padding: 24px 0;
  color: rgba(var(--v-theme-on-surface), 0.6);
}
.import-summary {
  font-size: 12px;
  line-height: 1.6;
  margin: 20px 0 0;
  color: rgba(var(--v-theme-on-surface), 0.65);
}
@media (max-width: 600px) {
  .page-heading {
    align-items: flex-start;
  }
  .catalog-search {
    flex-wrap: wrap;
  }
  .page-heading h2 {
    font-size: 22px;
  }
}

.workflow-guide {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
  margin: 0 0 16px;
}
.workflow-guide > div {
  display: grid;
  align-content: start;
  gap: 8px;
  padding: 16px;
  border: 1px solid rgba(var(--v-theme-on-surface), 0.12);
  border-radius: 12px;
  background: rgb(var(--v-theme-surface));
}
.workflow-guide strong {
  font-size: 13px;
}
.workflow-guide span {
  font-size: 12px;
  line-height: 1.6;
  color: rgba(var(--v-theme-on-surface), 0.65);
}
.completion-action {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 12px;
  margin: 12px 0;
}
.detail-actions {
  justify-content: space-between;
  flex-wrap: wrap;
}
.repair-option {
  margin-top: 20px;
  padding: 12px 16px;
  border: 1px solid rgba(var(--v-theme-on-surface), 0.12);
  border-radius: 12px;
}
.repair-option .note {
  margin-bottom: 0;
}
.repair-diagnostic {
  font-size: 12px;
  margin-top: 12px;
  overflow-wrap: anywhere;
}
.repair-diagnostic summary {
  cursor: pointer;
}
.layer-detail-heading {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 28px 28px 20px;
  margin: 0;
}
.layer-detail-icon {
  display: grid;
  place-items: center;
  width: 52px;
  height: 52px;
  flex-shrink: 0;
  border-radius: 14px;
  background: rgba(var(--v-theme-primary), 0.12);
  color: rgb(var(--v-theme-primary));
}
.detail-eyebrow {
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: rgba(var(--v-theme-on-surface), 0.6);
}
.layer-detail-heading h2 {
  font-size: 23px;
  line-height: 1.3;
  margin: 6px 0 0;
  overflow-wrap: anywhere;
}
.layer-detail-body {
  padding: 0 28px 20px;
}
.layer-facts {
  display: grid;
  grid-template-columns: minmax(100px, 1fr) minmax(0, 2fr);
  gap: 12px;
}
.layer-facts > div {
  display: grid;
  gap: 8px;
  padding: 18px;
  background: rgba(var(--v-theme-on-surface), 0.04);
  border: 1px solid rgba(var(--v-theme-on-surface), 0.08);
  border-radius: 12px;
}
.layer-facts span {
  font-size: 12px;
  color: rgba(var(--v-theme-on-surface), 0.6);
}
.layer-facts strong {
  font-size: 20px;
  font-weight: 600;
}
.detail-explanation {
  margin: 16px 0 24px;
  font-size: 12px;
  line-height: 1.7;
  color: rgba(var(--v-theme-on-surface), 0.6);
}
.layer-context {
  grid-template-columns: 100px minmax(0, 1fr);
  font-size: 13px;
  line-height: 1.7;
}
.layer-context dt {
  color: rgba(var(--v-theme-on-surface), 0.6);
}
.layer-context dd {
  margin: 0;
  overflow-wrap: anywhere;
}
.origins-heading {
  font-size: 14px;
  margin: 24px 0 12px;
}
.origin-card {
  display: flex;
  gap: 12px;
  align-items: flex-start;
  padding: 16px;
  border: 1px solid rgba(var(--v-theme-on-surface), 0.1);
  border-radius: 12px;
  margin-bottom: 8px;
}
.origin-card > div {
  display: grid;
  gap: 6px;
  min-width: 0;
  overflow-wrap: anywhere;
}
.origin-card strong {
  font-size: 13px;
  font-weight: 500;
}
.origin-card span,
.origin-card small {
  font-size: 12px;
  color: rgba(var(--v-theme-on-surface), 0.6);
}
.layer-detail-card .detail-actions {
  padding: 16px 28px 24px;
}
@media (max-width: 700px) {
  .workflow-guide {
    grid-template-columns: 1fr;
  }
  .page-heading {
    flex-wrap: wrap;
  }
  .catalog-search > .v-input {
    flex-basis: 100%;
  }
  .pages {
    gap: 8px;
    flex-wrap: wrap;
  }
}
@media (max-width: 600px) {
  .layer-detail-heading {
    padding: 20px 16px;
  }
  .layer-detail-body {
    padding: 0 16px 16px;
  }
  .layer-detail-card .detail-actions {
    padding: 16px;
  }
  .layer-facts {
    grid-template-columns: 1fr;
  }
}
</style>
