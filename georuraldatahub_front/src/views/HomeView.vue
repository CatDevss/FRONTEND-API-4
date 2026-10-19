<template>
  <div>
    <h1 class="text-h5 mb-2">Exploração geográfica</h1>

    <p class="text-body-2 mb-6">
      Visualize as camadas dos conjuntos de dados do GeoRural DataHub.
    </p>

    <v-row>
      <v-col cols="12" md="4">
        <v-card class="pa-4" rounded="lg">
          <v-select
            :model-value="selectedDatasetId"
            :items="datasets"
            item-title="name"
            item-value="id"
            label="Conjunto"
            placeholder="Selecione um conjunto"
            variant="outlined"
            density="comfortable"
            hide-details
            clearable
            :loading="loadingDatasets"
            :disabled="loadingDatasets || datasets.length === 0"
            @update:model-value="selectDataset"
          />

          <v-alert
            v-if="errorMessage"
            type="error"
            variant="tonal"
            class="mt-4"
          >
            {{ errorMessage }}
          </v-alert>

          <v-alert
            v-else-if="!loadingDatasets && datasets.length === 0"
            type="info"
            variant="tonal"
            class="mt-4"
          >
            Nenhum conjunto cadastrado.
          </v-alert>

          <v-alert
            v-else-if="selectedDatasetId !== null && !loadingLayers && layers.length === 0"
            type="info"
            variant="tonal"
            class="mt-4"
          >
            Este conjunto não tem arquivos que possam ser exibidos no mapa.
          </v-alert>

          <v-progress-linear
            v-if="loadingLayers"
            indeterminate
            class="mt-4"
          />

          <v-list v-if="layers.length > 0" density="compact" class="mt-2">
            <v-list-item v-for="layer in layers" :key="layer.fileId">
              <template #prepend>
                <v-checkbox-btn
                  :model-value="layer.visible"
                  :color="layer.color"
                  :aria-label="`Exibir ${layer.name} no mapa`"
                  @update:model-value="toggleLayer(layer, $event as boolean)"
                />
              </template>

              <v-list-item-title>{{ layer.name }}</v-list-item-title>

              <v-list-item-subtitle>
                {{
                  layer.error ||
                  (layer.featureCount !== null
                    ? `${layer.featureCount} feições`
                    : layer.formatFile)
                }}
              </v-list-item-subtitle>

              <!-- Opacidade: aparece só quando a camada está no mapa -->
              <v-slider
                v-if="layer.visible && layer.featureCount !== null"
                :model-value="layer.opacity"
                :color="layer.color"
                :aria-label="`Opacidade de ${layer.name}`"
                min="0.1"
                max="1"
                step="0.05"
                density="compact"
                hide-details
                class="mt-1"
                @update:model-value="setOpacity(layer, $event as number)"
              />

              <template #append>
                <v-progress-circular
                  v-if="layer.loading"
                  size="18"
                  indeterminate
                />
                <v-btn
                  v-else-if="layer.visible && layer.featureCount !== null"
                  icon="mdi-crosshairs-gps"
                  size="x-small"
                  variant="text"
                  :aria-label="`Ir para ${layer.name}`"
                  title="Ir para a camada"
                  @click="zoomToLayer(layer)"
                />
              </template>
            </v-list-item>
          </v-list>
        </v-card>
      </v-col>

      <v-col cols="12" md="8">
        <v-card rounded="lg" class="overflow-hidden">
          <div class="map-wrapper">
            <div ref="mapElement" class="map-container"></div>

            <v-btn
              class="map-reset"
              icon="mdi-fit-to-screen-outline"
              size="small"
              variant="elevated"
              aria-label="Ver o Paraná inteiro"
              title="Ver o Paraná inteiro"
              @click="resetView"
            />

            <v-chip
              v-if="cursor"
              class="map-coords"
              size="small"
              variant="flat"
            >
              {{ cursor }}
            </v-chip>
          </div>
        </v-card>
      </v-col>
    </v-row>
  </div>

  <!-- Notificação no canto superior direito -->
  <AppToast
    v-model="showToast"
    title="Operação concluída"
    message="A operação foi realizada com sucesso."
    type="success"
  />
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
  opacity: number
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

const cursor = ref('') // coordenadas sob o mouse
const showToast = ref(false)

// Estes NÃO são ref de propósito: o Leaflet cuida deles, o Vue não precisa observá-los
let map: L.Map | null = null
const leafletLayers = new Map<number, L.GeoJSON>() // cache: id do arquivo -> camada do Leaflet

// Serve para descartar respostas atrasadas quando o usuário troca de conjunto
let loadEpoch = 0

const palette = ['#1976D2', '#D32F2F', '#388E3C', '#F57C00', '#7B1FA2', '#0097A7']

// Enquadramento aproximado do Paraná (recorte de todo o desafio)
const PARANA_BOUNDS = L.latLngBounds([-26.72, -54.62], [-22.5, -48.02])

// ---------- funções auxiliares ----------
function extractMessage(error: unknown, fallback: string): string {
  const body = axios.isAxiosError(error) ? error.response?.data : undefined
  return typeof body === 'string' && body ? body : fallback
}

// Um só lugar define a aparência da camada: pontos mais cheios, polígonos mais leves
function styleFor(layer: LayerState, geometryType?: string): L.PathOptions {
  const isPoint = geometryType === 'Point' || geometryType === 'MultiPoint'
  return {
    color: layer.color,
    weight: isPoint ? 1 : 1.5,
    opacity: layer.opacity,
    fillOpacity: layer.opacity * (isPoint ? 0.8 : 0.35),
  }
}

function buildLeafletLayer(geoJson: FeatureCollection, layer: LayerState): L.GeoJSON {
  const geoLayer: L.GeoJSON = L.geoJSON(geoJson, {
    pointToLayer: (_feature, latlng) =>
      L.circleMarker(latlng, { radius: 5, ...styleFor(layer, 'Point') }),

    // lê o estado atual da camada, então o slider de opacidade vale também após o hover
    style: (feature) => styleFor(layer, feature?.geometry?.type),

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

      featureLayer.bindPopup(container, { maxWidth: 320, maxHeight: 260 })

      // Destaque ao passar o mouse
      featureLayer.on({
        mouseover: (e: L.LeafletEvent) => {
          ;(e.target as L.Path).setStyle({
            weight: 3,
            fillOpacity: Math.min(1, layer.opacity * 0.7),
          })
        },
        mouseout: (e: L.LeafletEvent) => {
          geoLayer.resetStyle(e.target as L.Layer)
        },
      })
    },
  })

  return geoLayer
}

function clearMapLayers() {
  leafletLayers.forEach((layer) => layer.remove())
  leafletLayers.clear()
}

// ---------- ações do mapa ----------
function resetView() {
  map?.fitBounds(PARANA_BOUNDS)
}

function zoomToLayer(layer: LayerState) {
  const bounds = leafletLayers.get(layer.fileId)?.getBounds()
  if (map && bounds?.isValid()) {
    map.fitBounds(bounds, { padding: [20, 20], maxZoom: 14 })
  }
}

function setOpacity(layer: LayerState, value: number) {
  layer.opacity = value
  leafletLayers
    .get(layer.fileId)
    ?.setStyle((feature) => styleFor(layer, feature?.geometry?.type))
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
  loadEpoch++
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
      opacity: 1,
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
  const currentMap = map
  if (!currentMap) return

  layer.visible = visible

  if (!visible) {
    leafletLayers.get(layer.fileId)?.remove()
    return
  }

  const cached = leafletLayers.get(layer.fileId)
  if (cached) {
    cached.addTo(currentMap)
    return
  }

  const epoch = loadEpoch
  layer.loading = true
  layer.error = ''

  try {
    const { data } = await axios.get<FeatureCollection>(
      `/arquivos/${layer.fileId}/geojson`
    )

    // O mapa foi desmontado ou o usuário trocou de conjunto durante a requisição.
    if (map !== currentMap || epoch !== loadEpoch) return

    const leafletLayer = buildLeafletLayer(data, layer)
    leafletLayers.set(layer.fileId, leafletLayer)
    layer.featureCount = data.features.length

    // Se o usuário desmarcou enquanto carregava, a camada fica em cache e não aparece.
    if (!layer.visible) return

    leafletLayer.addTo(currentMap)
    zoomToLayer(layer)
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

  // preferCanvas desenha as feições num <canvas>: muito mais rápido com arquivos grandes
  const currentMap = L.map(mapElement.value, { preferCanvas: true })
  map = currentMap
  currentMap.fitBounds(PARANA_BOUNDS)

  // Mapas de fundo (o satélite é o mais útil para imóveis rurais)
  const streets = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap contributors',
    maxZoom: 19,
  })
  const satellite = L.tileLayer(
    'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    {
      attribution: 'Imagens &copy; Esri, Maxar, Earthstar Geographics',
      maxZoom: 19,
    },
  )

  streets.addTo(currentMap)
  L.control
    .layers({ Ruas: streets, Satélite: satellite }, undefined, {
      position: 'topright',
    })
    .addTo(currentMap)

  L.control.scale({ imperial: false }).addTo(currentMap)

  currentMap.on('mousemove', (e: L.LeafletMouseEvent) => {
    cursor.value = `${e.latlng.lat.toFixed(5)}, ${e.latlng.lng.toFixed(5)}`
  })
  currentMap.on('mouseout', () => {
    cursor.value = ''
  })

  await loadDatasets()
  await nextTick()

  if (map === currentMap) {
    currentMap.invalidateSize()
  }
})

onBeforeUnmount(() => {
  map?.remove()
  map = null
  leafletLayers.clear()
})
</script>

<style scoped>
/* isolation mantém os z-index do Leaflet dentro do mapa, sem passar por cima do menu e dos diálogos */
.map-wrapper {
  position: relative;
  isolation: isolate;
}

.map-container {
  width: 100%;
  height: calc(100vh - 220px);
  min-height: 480px;
  background: #e5e7eb;
}

.map-reset {
  position: absolute;
  top: 84px;
  left: 10px;
  z-index: 1001;
}

.map-coords {
  position: absolute;
  left: 10px;
  bottom: 36px;
  z-index: 1001;
  pointer-events: none;
  font-variant-numeric: tabular-nums;
}
</style>