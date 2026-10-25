<template>
  <div class="rasters-page">
    <header class="raster-heading">
      <div>
        <p class="eyebrow">CATÁLOGO GEOESPACIAL</p>
        <h1 class="text-h5 font-weight-bold">Rasters</h1>
        <p class="text-body-2 text-medium-emphasis mt-2">
          Metadados e cobertura dos rasters catalogados pelo tratamento.
        </p>
      </div>
      <v-btn
        variant="outlined"
        prepend-icon="mdi-refresh"
        :loading="loading"
        :disabled="loading"
        @click="load"
        >Atualizar</v-btn
      >
    </header>
    <v-alert type="info" variant="tonal" class="mb-5"
      >Este catálogo apresenta metadados e o contorno da cobertura. A imagem e os valores dos pixels
      do GeoTIFF não são exibidos no mapa.</v-alert
    >
    <section class="raster-panel">
      <form class="raster-filter" @submit.prevent="applyFilter">
        <v-text-field
          v-model="bbox"
          label="Filtrar cobertura por extensão (EPSG:4326)"
          placeholder="oeste,sul,leste,norte"
          hint="Coordenadas separadas por vírgulas; deixe vazio para consultar todo o catálogo."
          persistent-hint
          variant="outlined"
          density="compact"
          :disabled="loading"
          :error-messages="filterError"
        />
        <v-btn type="submit" color="primary" variant="tonal" :disabled="loading">Filtrar</v-btn>
        <v-btn v-if="appliedBbox" variant="text" :disabled="loading" @click="clearFilter"
          >Limpar</v-btn
        >
      </form>
      <v-progress-linear v-if="loading" indeterminate aria-label="Carregando catálogo raster" />
      <v-alert v-if="error" type="error" variant="tonal" class="ma-4" role="alert"
        >{{ error }}<v-btn variant="text" @click="load">Tentar novamente</v-btn></v-alert
      >
      <v-table v-if="items.length"
        ><thead>
          <tr>
            <th>Raster / versão</th>
            <th>Dimensões</th>
            <th>Bandas</th>
            <th>Sistema de origem</th>
            <th>Objeto no bucket</th>
            <th>Consulta</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="item in items"
            :key="item.id"
            :class="{ 'selected-raster': selectedId === item.id }"
          >
            <td>
              <strong>Raster {{ item.id }}</strong>
              <p class="text-caption">Versão ID {{ item.versionId }}</p>
            </td>
            <td>{{ item.width }} × {{ item.height }}</td>
            <td>{{ item.bandCount }}</td>
            <td>EPSG:{{ item.sourceSrid }}</td>
            <td>
              <code>{{ item.location }}</code>
            </td>
            <td>
              <v-btn
                size="small"
                variant="tonal"
                color="primary"
                :aria-label="`Consultar raster ${item.id}`"
                @click="select(item.id)"
                >Metadados e cobertura</v-btn
              >
            </td>
          </tr>
        </tbody></v-table
      >
      <p v-else-if="!loading && !error" class="raster-empty">
        Nenhum raster encontrado{{ appliedBbox ? ' para a extensão selecionada' : '' }}.
      </p>
      <div class="d-flex align-center justify-space-between flex-wrap pa-4">
        <span class="text-caption text-medium-emphasis">{{ totalElements }} raster(s)</span
        ><v-pagination
          v-if="totalPages > 1"
          :model-value="page + 1"
          :length="totalPages"
          :total-visible="5"
          :disabled="loading"
          aria-label="Páginas do catálogo raster"
          @update:model-value="page = $event - 1"
        />
      </div>
    </section>
    <section
      v-if="selectedId !== null"
      class="raster-panel mt-5"
      aria-label="Detalhes do raster"
      aria-live="polite"
    >
      <div class="d-flex align-center justify-space-between ga-3 mb-4">
        <h2 class="text-h6">Raster {{ selectedId }}</h2>
        <v-btn size="small" variant="text" @click="select(null)">Fechar detalhes</v-btn>
      </div>
      <v-progress-linear
        v-if="detailLoading"
        indeterminate
        aria-label="Carregando metadados raster"
      />
      <v-alert v-if="detailError" type="error" variant="tonal" role="alert"
        >{{ detailError
        }}<v-btn variant="text" @click="select(selectedId)">Tentar novamente</v-btn></v-alert
      >
      <template v-if="detail">
        <div class="raster-metrics">
          <div>
            <span>Versão ID</span><strong>{{ detail.versionId }}</strong>
          </div>
          <div>
            <span>SRID de origem</span><strong>EPSG:{{ detail.sourceSrid }}</strong>
          </div>
          <div>
            <span>SRID da cobertura</span><strong>EPSG:{{ detail.coverageSrid }}</strong>
          </div>
          <div>
            <span>Resolução do pixel</span
            ><strong
              >{{ detail.metadata?.summary?.pixelWidth ?? '—' }} ×
              {{ detail.metadata?.summary?.pixelHeight ?? '—' }}
              {{ detail.metadata?.summary?.pixelUnit ?? '' }}</strong
            >
          </div>
        </div>
        <p class="text-body-2 mb-4">
          Objeto no bucket: <code>{{ detail.location }}</code>
        </p>
        <p class="text-caption text-medium-emphasis mb-3">
          O caminho identifica o objeto armazenado; não é um link público de download.
        </p>
        <RasterCoverageMap
          v-if="detail.metadata?.summary?.footprint"
          :geometry="detail.metadata.summary.footprint"
        />
        <p v-else class="text-body-2 text-medium-emphasis">
          Cobertura geográfica não informada pelo catálogo.
        </p>
        <v-table v-if="detail.metadata?.bands?.length" class="mt-4"
          ><thead>
            <tr>
              <th>Banda</th>
              <th>Tipo</th>
              <th>NoData</th>
              <th>Unidade</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="band in detail.metadata.bands" :key="band.number">
              <td>{{ band.number }}</td>
              <td>{{ band.dataType }}</td>
              <td>{{ band.noData ?? 'Não informado' }}</td>
              <td>{{ band.unit ?? 'Não informada' }}</td>
            </tr>
          </tbody></v-table
        >
        <details class="mt-4">
          <summary>Metadados originais</summary>
          <pre>{{ JSON.stringify(detail.metadata, null, 2) }}</pre>
        </details>
      </template>
    </section>
  </div>
</template>
<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import axios from 'axios'
import { apiError } from '@/services/contracts'
import type { ApiPage, RasterEntry, RasterDetail } from '@/services/processing'
import RasterCoverageMap from '@/components/RasterCoverageMap.vue'
const route = useRoute()
const items = ref<RasterEntry[]>([]),
  page = ref(0),
  totalElements = ref(0),
  totalPages = ref(0)
const loading = ref(false),
  error = ref(''),
  bbox = ref(''),
  appliedBbox = ref(''),
  filterError = ref('')
const selectedId = ref<number | null>(null),
  detail = ref<RasterDetail | null>(null),
  detailLoading = ref(false),
  detailError = ref('')
let epoch = 0,
  detailEpoch = 0,
  disposed = false
async function load() {
  const current = ++epoch
  loading.value = true
  error.value = ''
  items.value = []
  try {
    const { data } = await axios.get<ApiPage<RasterEntry>>('/rasters', {
      params: {
        page: page.value,
        size: 20,
        ...(appliedBbox.value ? { bbox: appliedBbox.value } : {}),
      },
    })
    if (disposed || current !== epoch) return
    if (!Array.isArray(data.content)) throw new Error('invalid-page')
    items.value = data.content
    totalElements.value = data.totalElements
    totalPages.value = data.totalPages
    if (data.totalPages > 0 && page.value >= data.totalPages) page.value = data.totalPages - 1
  } catch (e) {
    if (!disposed && current === epoch)
      error.value = apiError(e, 'Não foi possível carregar o catálogo raster.')
  } finally {
    if (!disposed && current === epoch) loading.value = false
  }
}
function applyFilter() {
  const raw = bbox.value.trim(),
    parts = raw.split(',').map((item) => item.trim()),
    values = parts.map(Number)
  if (
    raw &&
    (parts.length !== 4 ||
      parts.some((item) => !item) ||
      values.some((item) => !Number.isFinite(item)) ||
      values[0]! < -180 ||
      values[2]! > 180 ||
      values[1]! < -90 ||
      values[3]! > 90 ||
      values[0]! >= values[2]! ||
      values[1]! >= values[3]!)
  ) {
    filterError.value = 'Informe oeste,sul,leste,norte válidos em EPSG:4326.'
    return
  }
  filterError.value = ''
  appliedBbox.value = raw ? values.join(',') : ''
  void select(null)
  if (page.value !== 0) page.value = 0
  else void load()
}
function clearFilter() {
  bbox.value = ''
  applyFilter()
}
async function select(id: number | null) {
  const current = ++detailEpoch
  selectedId.value = id
  detail.value = null
  detailError.value = ''
  detailLoading.value = id !== null
  if (id === null) return
  try {
    const { data } = await axios.get<RasterDetail>(`/rasters/${id}`)
    if (!disposed && current === detailEpoch) detail.value = data
  } catch (e) {
    if (!disposed && current === detailEpoch)
      detailError.value = apiError(e, 'Não foi possível consultar este raster.')
  } finally {
    if (!disposed && current === detailEpoch) detailLoading.value = false
  }
}
watch(page, () => void load())
watch(
  () => route.query.raster,
  (value) => {
    const id = Number(value)
    void select(Number.isSafeInteger(id) && id > 0 ? id : null)
  },
  { immediate: true },
)
void load()
onBeforeUnmount(() => {
  disposed = true
  ++epoch
  ++detailEpoch
})
</script>
<style scoped>
.rasters-page {
  width: 100%;
  max-width: 1450px;
  padding: 28px;
  margin: 0 auto;
}
.raster-heading {
  display: flex;
  gap: 20px;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
}
.eyebrow {
  font-size: 10px;
  letter-spacing: 0.14em;
  font-weight: 700;
  color: rgb(var(--v-theme-primary));
  margin-bottom: 6px;
}
.raster-panel {
  border: 1px solid var(--glass-outer-border);
  border-radius: 22px;
  padding: 20px;
  background: rgba(var(--v-theme-surface), 0.9);
  overflow: hidden;
}
.raster-filter {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  margin-bottom: 16px;
}
.raster-filter :deep(.v-input) {
  min-width: 0;
}
.raster-empty {
  text-align: center;
  padding: 50px 12px;
  color: rgba(var(--v-theme-on-surface), 0.6);
}
.raster-metrics {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  gap: 16px;
  margin: 16px 0;
}
.raster-metrics > div {
  display: grid;
  gap: 6px;
}
.raster-metrics span {
  font-size: 11px;
  opacity: 0.65;
}
.raster-metrics strong {
  font-size: 13px;
}
.selected-raster {
  background: rgba(var(--v-theme-primary), 0.06);
}
code,
pre {
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  font-size: 11px;
}
pre {
  padding: 16px;
  border-radius: 14px;
  margin-top: 12px;
  max-height: 350px;
  overflow: auto;
  background: rgba(var(--v-theme-background), 0.6);
}
@media (max-width: 700px) {
  .rasters-page {
    padding: 16px;
  }
  .raster-heading,
  .raster-filter {
    flex-wrap: wrap;
  }
  .raster-filter :deep(.v-input) {
    flex-basis: 100%;
  }
  .raster-panel {
    padding: 16px;
  }
}
</style>
