<template>
  <div class="map-shell">
    <div ref="element" class="map-canvas" aria-label="Mapa Leaflet de registros validados"></div>
    <v-chip v-if="cursor" size="small" class="map-cursor">{{ cursor }}</v-chip>
    <v-alert
      v-if="notice"
      type="info"
      variant="flat"
      density="compact"
      class="map-notice"
      closable
      @click:close="notice = ''"
      >{{ notice }}</v-alert
    >
  </div>
</template>
<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import axios from 'axios'
import L from 'leaflet'
import type { Feature, FeatureCollection } from 'geojson'
import { apiError } from '@/services/contracts'
import { useWorkspaceStore } from '@/stores/workspace'
import 'leaflet/dist/leaflet.css'

const props = defineProps<{ visible: boolean }>()
const workspace = useWorkspaceStore(),
  element = ref<HTMLElement | null>(null),
  cursor = ref(''),
  notice = ref('')
const parana = L.latLngBounds([-26.72, -54.62], [-22.5, -48.02])
let map: L.Map | null = null,
  generation = 0,
  observer: ResizeObserver | null = null
const cache = new Map<number, L.GeoJSON>(),
  requests = new Map<number, AbortController>()
function styleFor(id: number, geometryType?: string): L.PathOptions {
  const point = geometryType === 'Point' || geometryType === 'MultiPoint'
  return {
    color: workspace.colorFor(id),
    weight: point ? 1 : 1.5,
    opacity: workspace.getOpacity(id),
    fillOpacity: workspace.getOpacity(id) * (point ? 0.8 : 0.35),
  }
}
function attributes(feature: Feature) {
  const container = document.createElement('div')
  for (const [key, value] of Object.entries(feature.properties ?? {})) {
    const row = document.createElement('div'),
      label = document.createElement('strong'),
      text = document.createElement('span')
    label.textContent = `${key}: `
    text.textContent = typeof value === 'object' ? JSON.stringify(value) : String(value ?? '')
    row.append(label, text)
    container.append(row)
  }
  if (!container.childNodes.length) container.textContent = 'Esta feição não possui atributos.'
  return container
}
function build(data: FeatureCollection, id: number) {
  return L.geoJSON(data, {
    pointToLayer: (_feature, latlng) =>
      L.circleMarker(latlng, { radius: 5, ...styleFor(id, 'Point') }),
    style: (feature) => styleFor(id, feature?.geometry?.type),
    onEachFeature: (feature, layer) =>
      layer.bindPopup(attributes(feature), { maxWidth: 340, maxHeight: 260 }),
  })
}
function clear() {
  ++generation
  requests.forEach((request) => request.abort())
  requests.clear()
  cache.forEach((layer) => layer.remove())
  cache.clear()
  cursor.value = ''
  notice.value = ''
  map?.closePopup()
  map?.fitBounds(parana)
}
async function loadLayer(id: number) {
  if (!map || requests.has(id) || cache.has(id)) return
  const request = new AbortController(),
    currentMap = map,
    epoch = generation,
    revision = workspace.revision
  requests.set(id, request)
  workspace.updateRuntime(id, { loading: true, error: '', featureCount: null }, revision)
  try {
    const { data } = await axios.get<FeatureCollection>(`/arquivos/${id}/geojson`, {
      signal: request.signal,
    })
    if (
      epoch !== generation ||
      currentMap !== map ||
      revision !== workspace.revision ||
      request.signal.aborted
    )
      return
    if (data?.type !== 'FeatureCollection' || !Array.isArray(data.features))
      throw new Error('invalid-geojson')
    const layer = build(data, id)
    cache.set(id, layer)
    workspace.updateRuntime(
      id,
      { loading: false, error: '', featureCount: data.features.length },
      revision,
    )
    if (workspace.isVisible(id)) layer.addTo(currentMap)
  } catch (e) {
    if (
      epoch !== generation ||
      currentMap !== map ||
      request.signal.aborted ||
      revision !== workspace.revision
    )
      return
    workspace.setVisibility(id, false)
    workspace.updateRuntime(
      id,
      {
        loading: false,
        error: apiError(
          e,
          'Não foi possível renderizar a camada. Verifique o GeoJSON e os atributos espaciais do arquivo.',
        ),
        featureCount: null,
      },
      revision,
    )
  } finally {
    if (requests.get(id) === request) requests.delete(id)
  }
}
function sync() {
  if (!map) return
  for (const [id, layer] of cache) {
    layer.setStyle((feature) => styleFor(id, feature?.geometry?.type))
    if (workspace.isVisible(id)) {
      if (!map.hasLayer(layer)) layer.addTo(map)
    } else layer.remove()
  }
  for (const id of workspace.visibleLayerIds) void loadLayer(id)
}
function fitVisibleLayers() {
  const bounds = L.latLngBounds([])
  for (const [id, layer] of cache)
    if (workspace.isVisible(id) && layer.getBounds().isValid()) bounds.extend(layer.getBounds())
  if (bounds.isValid()) {
    map?.fitBounds(bounds, { padding: [24, 24], maxZoom: 15 })
    notice.value = ''
  } else notice.value = 'Ative uma camada com geometrias para enquadrar sua extensão.'
}
function resetView() {
  map?.fitBounds(parana)
}
function resize() {
  map?.invalidateSize()
}
watch(() => workspace.revision, clear, { flush: 'sync' })
watch(
  () => [
    workspace.visibleLayerIds,
    workspace.availableReferences,
    workspace.visibleLayerIds.map((id) => workspace.getOpacity(id)),
  ],
  sync,
  { deep: true },
)
watch(
  () => props.visible,
  async (visible) => {
    if (visible) {
      await nextTick()
      resize()
    }
  },
)
onMounted(() => {
  if (!element.value) return
  map = L.map(element.value, { preferCanvas: true }).fitBounds(parana)
  const streets = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap contributors',
    maxZoom: 19,
  })
  const satellite = L.tileLayer(
    'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    { attribution: 'Imagens &copy; Esri, Maxar, Earthstar Geographics', maxZoom: 19 },
  )
  streets.addTo(map)
  L.control
    .layers({ Ruas: streets, Satélite: satellite }, undefined, { position: 'topright' })
    .addTo(map)
  L.control.scale({ imperial: false }).addTo(map)
  map.on('mousemove', (event: L.LeafletMouseEvent) => {
    cursor.value = `${event.latlng.lat.toFixed(5)}, ${event.latlng.lng.toFixed(5)}`
  })
  map.on('mouseout', () => {
    cursor.value = ''
  })
  if (typeof ResizeObserver !== 'undefined') {
    observer = new ResizeObserver(resize)
    observer.observe(element.value)
  }
  window.addEventListener('resize', resize)
  sync()
  resize()
})
onBeforeUnmount(() => {
  clear()
  observer?.disconnect()
  window.removeEventListener('resize', resize)
  map?.remove()
  map = null
})
defineExpose({ fitVisibleLayers, resetView })
</script>
<style scoped>
.map-shell {
  height: 100%;
  min-height: 0;
  position: relative;
  isolation: isolate;
}
.map-canvas {
  width: 100%;
  height: 100%;
  min-height: 0;
  background: rgb(var(--v-theme-background));
}
.map-cursor {
  position: absolute;
  bottom: 28px;
  left: 12px;
  z-index: 1000;
  font-variant-numeric: tabular-nums;
}
.map-notice {
  position: absolute;
  bottom: 60px;
  left: 12px;
  right: 12px;
  z-index: 1000;
}
</style>
