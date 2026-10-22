<template>
  <div class="map-shell">
    <div ref="element" class="map-canvas" aria-label="Mapa Leaflet de registros validados"></div>
    <v-chip v-if="cursor" size="small" class="map-cursor">{{ cursor }}</v-chip>
    <v-alert
      v-if="notice"
      type="info"
      variant="tonal"
      color="primary"
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

const props = defineProps<{
  visible: boolean
  insets?: { top: number; right: number; bottom: number; left: number }
}>()
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
  resetView()
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
    const padding = visiblePadding()
    map?.fitBounds(bounds, { ...padding, maxZoom: 15 })
    notice.value = ''
  } else notice.value = 'Ative uma camada com geometrias para enquadrar sua extensão.'
}
function visiblePadding() {
  let left = (props.insets?.left ?? 0) + 24,
    top = (props.insets?.top ?? 0) + 24,
    right = (props.insets?.right ?? 0) + 24,
    bottom = (props.insets?.bottom ?? 0) + 24
  const width = element.value?.clientWidth ?? 0,
    height = element.value?.clientHeight ?? 0
  // Keep a usable viewport even on small screens or when the overlays wrap.
  if (width > 0 && left + right > width - 96) {
    const ratio = Math.max(0, width - 96) / (left + right)
    left *= ratio
    right *= ratio
  }
  if (height > 0 && top + bottom > height - 96) {
    const ratio = Math.max(0, height - 96) / (top + bottom)
    top *= ratio
    bottom *= ratio
  }
  return {
    paddingTopLeft: [left, top] as L.PointTuple,
    paddingBottomRight: [right, bottom] as L.PointTuple,
  }
}
function resetView() {
  map?.fitBounds(parana, visiblePadding())
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
  map = L.map(element.value, { preferCanvas: true, zoomControl: false }).fitBounds(parana)
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
    .layers({ Ruas: streets, Satélite: satellite }, undefined, { position: 'bottomright' })
    .addTo(map)
  L.control.zoom({ position: 'bottomright' }).addTo(map)
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
  bottom: 5px;
  left: 130px;
  z-index: 1000;
  font-variant-numeric: tabular-nums;
  font-size: 10px;
  background: rgba(var(--v-theme-surface), 0.96);
  border: 1px solid var(--glass-outer-border);
}
.map-notice {
  position: absolute;
  bottom: 160px;
  right: 16px;
  max-width: min(380px, calc(100% - 32px));
  z-index: 1000;
  border-radius: 16px;
  background: rgba(var(--v-theme-surface), 0.97);
}
.map-shell :deep(.leaflet-right) {
  right: 6px;
}
.map-shell :deep(.leaflet-bar),
.map-shell :deep(.leaflet-control-layers) {
  background: rgba(var(--v-theme-surface), 0.97);
  color: rgb(var(--v-theme-on-surface));
  border: 1px solid rgba(var(--v-theme-on-surface), 0.12);
  border-radius: 12px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.2);
  overflow: hidden;
}
.map-shell :deep(.leaflet-bar a) {
  background: transparent;
  color: rgb(var(--v-theme-on-surface));
  border-color: var(--glass-outer-border);
  width: 34px;
  height: 34px;
  line-height: 34px;
}
.map-shell :deep(.leaflet-bar a:hover),
.map-shell :deep(.leaflet-bar a:focus-visible) {
  background: rgba(var(--v-theme-primary), 0.12);
  color: rgb(var(--v-theme-primary));
}
.map-shell :deep(.leaflet-bar a.leaflet-disabled) {
  color: rgba(var(--v-theme-on-surface), 0.3);
}
.map-shell :deep(.leaflet-control-layers-toggle) {
  width: 36px;
  height: 36px;
  filter: invert(0.85);
}
.map-shell :deep(.leaflet-control-layers-expanded) {
  padding: 10px 14px;
}
.map-shell :deep(.leaflet-control-layers label) {
  line-height: 2;
  font-family: inherit;
  accent-color: rgb(var(--v-theme-primary));
}
.map-shell :deep(.leaflet-control-attribution) {
  background: rgba(var(--v-theme-surface), 0.9);
  color: rgba(var(--v-theme-on-surface), 0.65);
  border-radius: 6px 0 0 0;
  font-size: 9px;
}
.map-shell :deep(.leaflet-control-attribution a) {
  color: rgb(var(--v-theme-primary));
}
.map-shell :deep(.leaflet-control-scale-line) {
  background: rgba(var(--v-theme-surface), 0.9);
  color: rgba(var(--v-theme-on-surface), 0.8);
  border-color: rgba(var(--v-theme-on-surface), 0.4);
  text-shadow: none;
  border-radius: 4px;
}
.map-shell :deep(.leaflet-popup-content-wrapper),
.map-shell :deep(.leaflet-popup-tip) {
  background: rgb(var(--v-theme-surface));
  color: rgb(var(--v-theme-on-surface));
  box-shadow: 0 6px 24px rgba(0, 0, 0, 0.25);
}
.map-shell :deep(.leaflet-popup-content-wrapper) {
  border: 1px solid var(--glass-outer-border);
  border-radius: 16px;
}
.map-shell :deep(.leaflet-popup-content) {
  line-height: 1.7;
  overflow-wrap: anywhere;
}
.map-shell :deep(.leaflet-popup-close-button) {
  color: rgba(var(--v-theme-on-surface), 0.65);
}
</style>
