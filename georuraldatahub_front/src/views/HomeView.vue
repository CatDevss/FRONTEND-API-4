<template>
  <div>
    <h1 class="text-h5 mb-2">Exploração geográfica</h1>

    <p class="text-body-2 mb-6">
      Visualize os arquivos geográficos armazenados no GeoRural DataHub.
    </p>

    <v-card class="pa-4 mb-4" rounded="lg">
      <v-row align="center">
        <v-col cols="12" md="8">
          <v-select v-model="selectedObject" :items="geoJsonObjects" label="Arquivo geográfico"
            placeholder="Selecione um arquivo" variant="outlined" density="comfortable" hide-details clearable
            :loading="loadingObjects" :disabled="loadingObjects || geoJsonObjects.length === 0" />
        </v-col>

        <v-col cols="12" md="4">
          <v-btn block color="primary" :disabled="!selectedObject || loadingGeoJson" :loading="loadingGeoJson"
            @click="loadGeoJson">
            Carregar no mapa
          </v-btn>
        </v-col>
      </v-row>

      <v-alert v-if="errorMessage" type="error" variant="tonal" class="mt-4">
        {{ errorMessage }}
      </v-alert>

      <v-alert v-else-if="geoJsonObjects.length === 0 && !loadingObjects" type="info" variant="tonal" class="mt-4">
        Nenhum arquivo GeoJSON foi encontrado no bucket.
      </v-alert>

      <v-alert v-else-if="loadedFeatureCount !== null" type="success" variant="tonal" class="mt-4">
        {{ loadedFeatureCount }} feição(ões) carregada(s).
      </v-alert>
    </v-card>

    <v-card rounded="lg" class="overflow-hidden">
      <div ref="mapElement" class="map-container"></div>
    </v-card>
  </div>
</template>

<script setup lang="ts">
import { nextTick, onMounted, onBeforeUnmount, ref, watch } from 'vue'
import axios from 'axios'
import L from 'leaflet'

import 'leaflet/dist/leaflet.css'

type GeoJsonFeatureCollection = GeoJSON.FeatureCollection

const mapElement = ref<HTMLElement | null>(null)

const geoJsonObjects = ref<string[]>([])
const selectedObject = ref<string | null>(null)

const loadingObjects = ref(false)
const loadingGeoJson = ref(false)

const errorMessage = ref('')
const loadedFeatureCount = ref<number | null>(null)

let map: L.Map | null = null
let geoJsonLayer: L.GeoJSON | null = null

async function loadObjects() {
  loadingObjects.value = true
  errorMessage.value = ''

  try {
    const response = await axios.get<string[]>('/bucket')

    geoJsonObjects.value = response.data.filter((objectName) => {
      const normalizedName = objectName.toLowerCase()

      return (
        normalizedName.endsWith('.geojson') ||
        normalizedName.endsWith('.json')
      )
    })
  } catch (error) {
    console.error('Erro ao listar objetos do bucket:', error)

    errorMessage.value =
      'Não foi possível listar os arquivos do bucket. Verifique a API.'
  } finally {
    loadingObjects.value = false
  }
}

async function loadGeoJson() {
  if (!selectedObject.value || !map) {
    return
  }

  loadingGeoJson.value = true
  errorMessage.value = ''

  try {
    const response = await axios.get<GeoJsonFeatureCollection>(
      '/bucket/geojson',
      {
        params: {
          objectName: selectedObject.value,
        },
      },
    )

    const geoJson = response.data

    if (
      geoJson.type !== 'FeatureCollection' ||
      !Array.isArray(geoJson.features)
    ) {
      throw new Error('O arquivo retornado não é um FeatureCollection válido.')
    }

    if (geoJsonLayer) {
      geoJsonLayer.remove()
      geoJsonLayer = null
    }

    geoJsonLayer = L.geoJSON(geoJson, {
      style: () => ({
        color: '#1976D2',
        weight: 1,
        fillOpacity: 0.25,
      }),

      onEachFeature: (feature, layer) => {
        const properties = feature.properties ?? {}

        const content = Object.entries(properties)
          .map(([key, value]) => {
            const row = document.createElement('div')
            const label = document.createElement('strong')
            const text = document.createElement('span')

            label.textContent = `${key}: `
            text.textContent =
              typeof value === 'object'
                ? JSON.stringify(value)
                : String(value ?? '')

            row.append(label, text)

            return row
          })

        layer.bindPopup(() => {
          const container = document.createElement('div')

          if (content.length === 0) {
            container.textContent = 'Esta feição não possui atributos.'
          } else {
            content.forEach((row) => container.appendChild(row))
          }

          return container
        })
      },
    })

    geoJsonLayer.addTo(map)

    const bounds = geoJsonLayer.getBounds()

    if (bounds.isValid()) {
      map.fitBounds(bounds, {
        padding: [20, 20],
        maxZoom: 12,
      })
    }

    loadedFeatureCount.value = geoJson.features.length
  } catch (error: unknown) {
    console.error('Erro ao carregar GeoJSON:', error)

    if (error instanceof Error) {
      errorMessage.value = error.message
    } else {
      errorMessage.value = 'Ocorreu um erro inesperado ao carregar o arquivo.'
    }

    loadedFeatureCount.value = null

  } finally {
    loadingGeoJson.value = false
  }
}

onMounted(async () => {
  if (!mapElement.value) {
    return
  }

  map = L.map(mapElement.value).setView([-24.5, -51.5], 7)

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap contributors',
    maxZoom: 19,
  }).addTo(map)

  await loadObjects()

  await nextTick()

  map.invalidateSize()
})

onBeforeUnmount(() => {
  map?.remove()
  map = null
  geoJsonLayer = null
})

watch(selectedObject, () => {
  errorMessage.value = ''
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