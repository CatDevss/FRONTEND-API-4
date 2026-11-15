<template>
  <section class="layers-panel">
    <header>
      <span class="eyebrow">DADOS PARA ANÁLISE</span>
      <h2>Camadas</h2>
      <p>
        Uma camada reúne feições: municípios, imóveis ou pontos. Nos medidores, você escolhe uma
        feição como área de análise.
      </p>
    </header>
    <div class="filters">
      <v-autocomplete
        v-model="dataset"
        :items="datasets"
        item-title="name"
        item-value="id"
        label="Conjunto"
        clearable
        :disabled="busy"
      /><v-text-field v-model="search" label="Nome da camada" @keyup.enter="load(0)" /><v-select
        v-model="type"
        :items="geometryTypes"
        label="Tipo"
        clearable
      /><v-text-field v-model="source" label="Fonte" @keyup.enter="load(0)" /><v-btn
        variant="tonal"
        :loading="loading"
        @click="load(0)"
        >Buscar</v-btn
      >
    </div>
    <v-btn
      v-if="can('ingestion.run')"
      color="primary"
      prepend-icon="mdi-plus"
      :disabled="!dataset || busy"
      @click="openImport"
      >Criar camada de arquivo tratado</v-btn
    >
    <v-btn
      v-if="can('ingestion.run') && compositionEnabled"
      class="ml-2"
      variant="tonal"
      :disabled="!dataset || busy"
      @click="showCombine = true"
      >Combinar camadas</v-btn
    >
    <p v-if="!dataset" class="note">Escolha um conjunto para criar camadas.</p>
    <p v-if="!compositionEnabled" class="note">
      Você pode usar várias camadas diretamente em um indicador. A composição aguarda habilitação
      após validação no banco.
    </p>
    <v-alert v-if="error" type="error" class="my-3">{{ error }}</v-alert>
    <v-alert v-if="success" type="success" class="my-3">{{ success }}</v-alert>
    <div v-if="!loading && !rows.length" class="empty">
      Nenhuma camada encontrada. Importe uma versão tratada ou ajuste os filtros.
    </div>
    <v-list v-else class="catalog" bg-color="transparent"
      ><v-list-item
        v-for="layer in rows"
        :key="layer.id"
        :title="layer.name"
        :subtitle="`${layer.dataset} · ${layer.source} · ${geometryLabel(layer.geometry)} · ${layer.features} feições`"
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
    <v-dialog v-model="showImport" max-width="680" :persistent="busy"
      ><v-card title="Criar camada"
        ><v-card-text>
          <p class="note">
            Escolha uma versão tratada do conjunto. CSV deve conter focos com id, lat, lon e
            data_hora_gmt. GeoJSON deve conter geometrias válidas.
          </p>
          <div class="filters">
            <v-text-field
              v-model="versionSearch"
              label="Buscar arquivo tratado"
              :disabled="busy"
              @keyup.enter="loadVersions(0)"
            /><v-btn
              variant="text"
              :disabled="busy"
              :loading="versionsLoading"
              @click="loadVersions(0)"
              >Buscar</v-btn
            >
          </div>
          <v-select
            v-model="versionId"
            :items="
              versions.map((v) => ({
                ...v,
                label: `${v.file} · versão ${v.number} · ${v.source}${v.importedLayers ? ' · já importada' : ''}`,
                props: { disabled: v.importedLayers > 0 },
              }))
            "
            item-title="label"
            item-value="id"
            label="Arquivo e versão"
            :disabled="busy"
            no-data-text="Nenhuma versão tratada importável"
          />
          <div class="pages">
            <v-btn
              variant="text"
              :disabled="!versionPage || busy || versionsLoading"
              @click="loadVersions(versionPage - 1)"
              >Anterior</v-btn
            ><span>{{ versionTotal }} versões</span
            ><v-btn
              variant="text"
              :disabled="(versionPage + 1) * 20 >= versionTotal || busy || versionsLoading"
              @click="loadVersions(versionPage + 1)"
              >Próxima</v-btn
            >
          </div>
          <v-alert v-if="dialogError" type="error">{{ dialogError }}</v-alert>
          <p class="note">
            A importação pode demorar alguns minutos. Após erro de conexão, confira o catálogo antes
            de tentar novamente.
          </p> </v-card-text
        ><v-card-actions
          ><v-btn :disabled="busy" @click="showImport = false">Fechar</v-btn
          ><v-btn
            color="primary"
            :loading="busy"
            :disabled="!versionId || versionsLoading"
            @click="importSelected"
            >Criar camada</v-btn
          ></v-card-actions
        ></v-card
      ></v-dialog
    >
    <v-dialog v-model="showCombine" max-width="680" :persistent="busy"
      ><v-card title="Combinar camadas"
        ><v-card-text>
          <v-text-field
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
    <v-dialog v-model="showDetails" max-width="680"
      ><v-card :title="detail?.layer.name ?? 'Camada'"
        ><v-card-text v-if="detail"
          ><dl>
            <dt>Tipo</dt>
            <dd>{{ geometryLabel(detail.layer.geometry) }}</dd>
            <dt>Feições</dt>
            <dd>{{ detail.layer.features }}</dd>
            <dt>Conjunto</dt>
            <dd>{{ detail.layer.dataset }}</dd>
            <dt>SRID</dt>
            <dd>{{ detail.layer.srid }}</dd>
          </dl>
          <h4 class="mt-4">Origem</h4>
          <ul>
            <li
              v-for="origin in detail.origins.length ? detail.origins : [detail.layer]"
              :key="origin.id"
            >
              {{ origin.name }} · {{ origin.file }} · {{ origin.source }}
            </li>
          </ul></v-card-text
        ><v-card-actions><v-btn @click="showDetails = false">Fechar</v-btn></v-card-actions></v-card
      ></v-dialog
    >
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
  combineLayers,
  type Layer,
  type ImportableVersion,
} from '@/services/environmentalIndicators'
import EnvironmentalLayerPicker from './EnvironmentalLayerPicker.vue'
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
const showImport = ref(false),
  versions = ref<ImportableVersion[]>([]),
  versionId = ref<number | null>(null),
  versionSearch = ref(''),
  versionPage = ref(0),
  versionTotal = ref(0),
  versionsLoading = ref(false)
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
  if (!dataset.value) return
  const request = ++versionEpoch
  versionsLoading.value = true
  versionId.value = null
  dialogError.value = ''
  try {
    const data = await listVersions(dataset.value, versionSearch.value, next)
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
  void loadVersions(0)
}
async function details(id: number) {
  const request = ++detailEpoch
  try {
    const data = await layerDetails(id)
    if (request !== detailEpoch) return
    detail.value = data
    showDetails.value = true
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
  if (!dataset.value || !versionId.value || busy.value || !can('ingestion.run')) return
  busy.value = true
  dialogError.value = ''
  try {
    const data = await importLayer(dataset.value, versionId.value)
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
watch(dataset, () => {
  versionEpoch++
  versions.value = []
  versionId.value = null
  combinedIds.value = []
  success.value = ''
  void load(0)
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
</style>
