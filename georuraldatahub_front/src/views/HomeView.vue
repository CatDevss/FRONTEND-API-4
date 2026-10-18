<template>
  <div>
    <h1 class="text-h5 mb-2">Exploração geográfica</h1>

    <p class="text-body-2 mb-6">
      Visualize as camadas dos conjuntos de dados do GeoRural DataHub.
    </p>

    <v-row>
      <!-- Coluna esquerda: escolha do conjunto + lista de camadas -->
      <v-col cols="12" md="4">
        <v-card class="pa-4" rounded="lg">
          <v-select :model-value="selectedDatasetId" :items="datasets" item-title="name" item-value="id"
            label="Conjunto" placeholder="Selecione um conjunto" variant="outlined" density="comfortable" hide-details
            clearable :loading="loadingDatasets" :disabled="loadingDatasets || datasets.length === 0"
            @update:model-value="selectDataset" />

          <v-alert v-if="errorMessage" type="error" variant="tonal" class="mt-4">
            {{ errorMessage }}
          </v-alert>

          <v-alert v-else-if="!loadingDatasets && datasets.length === 0" type="info" variant="tonal" class="mt-4">
            Nenhum conjunto cadastrado.
          </v-alert>

          <v-alert v-else-if="selectedDatasetId !== null && !loadingLayers && layers.length === 0" type="info"
            variant="tonal" class="mt-4">
            Este conjunto não tem arquivos que possam ser exibidos no mapa.
          </v-alert>

          <v-progress-linear v-if="loadingLayers" indeterminate class="mt-4" />

          <v-list v-if="layers.length > 0" density="compact" class="mt-2">
            <v-list-item v-for="layer in layers" :key="layer.fileId">
              <template #prepend>
                <v-checkbox-btn :model-value="layer.visible" :color="layer.color"
                  @update:model-value="toggleLayer(layer, $event as boolean)" />
              </template>

              <v-list-item-title>{{ layer.name }}</v-list-item-title>
              <v-list-item-subtitle>
                {{
                  layer.error ||
                  (layer.featureCount !== null ? `${layer.featureCount} feições` : layer.formatFile)
                }}
              </v-list-item-subtitle>

              <template #append>
                <v-progress-circular v-if="layer.loading" size="18" indeterminate />
              </template>
            </v-list-item>
          </v-list>
        </v-card>
      </v-col>

      <!-- Coluna direita: o mapa (igual ao que você já tinha) -->
      <v-col cols="12" md="8">
        <v-card rounded="lg" class="overflow-hidden">
          <div ref="mapElement" class="map-container"></div>
        </v-card>
      </v-col>
    </v-row>
  </div>
</template>

<script setup lang="ts">
import { nextTick, onMounted, onBeforeUnmount, ref } from 'vue'
import axios from 'axios'
import L from 'leaflet'
import type { FeatureCollection } from 'geojson'

import 'leaflet/dist/leaflet.css'

// ---------- tipos ----------
interface DatasetOption {
  id: number
  name: string
}

interface LayerInfo {
  fileId: number
  name: string
  formatFile: string
}

interface LayerState extends LayerInfo {
  color: string
  visible: boolean
  loading: boolean
  error: string
  featureCount: number | null
}

// ---------- estado ----------
const mapElement = ref<HTMLElement | null>(null)

const datasets = ref<DatasetOption[]>([])
const selectedDatasetId = ref<number | null>(null)
const layers = ref<LayerState[]>([])

const loadingDatasets = ref(false)
const loadingLayers = ref(false)
const errorMessage = ref('')

// Estes dois NÃO são ref de propósito: o Leaflet cuida deles, o Vue não precisa observá-los
let map: L.Map | null = null
const leafletLayers = new Map<number, L.GeoJSON>() // cache: id do arquivo -> camada do Leaflet

const palette = ['#1976D2', '#D32F2F', '#388E3C', '#F57C00', '#7B1FA2', '#0097A7']

// ---------- funções auxiliares ----------
function extractMessage(error: unknown, fallback: string): string {
  const body = axios.isAxiosError(error) ? error.response?.data : undefined
  return typeof body === 'string' && body ? body : fallback
}

// É o L.geoJSON que antes ficava dentro do loadGeoJson, agora com a cor como parâmetro
function buildLeafletLayer(geoJson: FeatureCollection, color: string): L.GeoJSON {
  return L.geoJSON(geoJson, {
    pointToLayer: (_feature, latlng) =>
      L.circleMarker(latlng, { radius: 5, color, fillOpacity: 0.8 }),

    style: () => ({ color, weight: 1, fillOpacity: 0.25 }),

    onEachFeature: (feature, featureLayer) => {
      const properties = feature.properties ?? {}
      const container = document.createElement('div')

      for (const [key, value] of Object.entries(properties)) {
        const row = document.createElement('div')
        const label = document.createElement('strong')
        const text = document.createElement('span')

        label.textContent = `${key}: `
        text.textContent =
          typeof value === 'object' ? JSON.stringify(value) : String(value ?? '')

        row.append(label, text)
        container.appendChild(row)
      }

      if (container.childNodes.length === 0) {
        container.textContent = 'Esta feição não possui atributos.'
      }

      featureLayer.bindPopup(container)
    },
  })
}

function clearMapLayers() {
  leafletLayers.forEach((layer) => layer.remove())
  leafletLayers.clear()
}

// ---------- chamadas à API ----------
async function loadDatasets() {
  loadingDatasets.value = true
  errorMessage.value = ''
  try {
    const { data } = await axios.get<DatasetOption[]>('/conjuntos')
    datasets.value = data
  } catch (error) {
    console.error('Erro ao listar conjuntos:', error)
    errorMessage.value = 'Não foi possível listar os conjuntos. Verifique a API.'
  } finally {
    loadingDatasets.value = false
  }
}

async function selectDataset(datasetId: number | null) {
  selectedDatasetId.value = datasetId
  clearMapLayers()
  layers.value = []
  errorMessage.value = ''

  if (datasetId === null) return // o usuário limpou o select

  loadingLayers.value = true
  try {
    const { data } = await axios.get<LayerInfo[]>(`/conjuntos/${datasetId}/camadas`)
    layers.value = data.map((info, i) => ({
      ...info,
      color: palette[i % palette.length] ?? '#1976D2',
      visible: false,
      loading: false,
      error: '',
      featureCount: null,
    }))
  } catch (error) {
    console.error('Erro ao listar camadas:', error)
    errorMessage.value = extractMessage(error, 'Não foi possível carregar as camadas do conjunto.')
  } finally {
    loadingLayers.value = false
  }
}

async function toggleLayer(layer: LayerState, visible: boolean) {
  if (!map) return
  layer.visible = visible

  if (!visible) {
    leafletLayers.get(layer.fileId)?.remove()
    return
  }

  // já foi baixada antes? só volta para o mapa, sem chamar a API de novo
  const cached = leafletLayers.get(layer.fileId)
  if (cached) {
    cached.addTo(map)
    return
  }

  layer.loading = true
  layer.error = ''
  try {
    const { data } = await axios.get<FeatureCollection>(`/arquivos/${layer.fileId}/geojson`)
    const leafletLayer = buildLeafletLayer(data, layer.color)
    leafletLayer.addTo(map)
    leafletLayers.set(layer.fileId, leafletLayer)
    layer.featureCount = data.features.length

    const bounds = leafletLayer.getBounds()
    if (bounds.isValid()) {
      map.fitBounds(bounds, { padding: [20, 20], maxZoom: 12 })
    }
  } catch (error) {
    console.error('Erro ao carregar camada:', error)
    layer.visible = false
    layer.error = extractMessage(error, 'Não foi possível carregar a camada.')
  } finally {
    layer.loading = false
  }
}

// ---------- ciclo de vida ----------
onMounted(async () => {
  if (!mapElement.value) return

  map = L.map(mapElement.value).setView([-24.5, -51.5], 7)

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap contributors',
    maxZoom: 19,
  }).addTo(map)

  await loadDatasets()
  await nextTick()
  map.invalidateSize()
})

onBeforeUnmount(() => {
  map?.remove()
  map = null
  leafletLayers.clear()
})
</script>

<style scoped>
.map-container {
  width: 100%;
  height: 600px;
  min-height: 400px;
  background: #e5e7eb;
}
</style>