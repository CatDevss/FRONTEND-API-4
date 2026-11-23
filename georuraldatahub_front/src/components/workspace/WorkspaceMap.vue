<template>
  <div class="map-shell georural-map">
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
import { nextTick, onActivated, onDeactivated, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import axios from 'axios'
import L from 'leaflet'
import type { FeatureCollection } from 'geojson'
import {
  featuresAt,
  indexFeatures,
  type HitQuery,
  type IndexedFeature,
  type MapInspection,
} from '@/services/mapInspection'
import { isCarProperty, tooltipElement, tooltipRows } from '@/services/propertyTooltip'
import { apiError } from '@/services/contracts'
import { useWorkspaceStore } from '@/stores/workspace'
import 'leaflet/dist/leaflet.css'
import '@/assets/map.css'
import { addMapPresentation, paranaBounds } from '@/services/mapPresentation'

const props = defineProps<{
  visible: boolean
  insets?: { top: number; right: number; bottom: number; left: number }
}>()
const emit = defineEmits<{ inspect: [result: MapInspection | null] }>()
const workspace = useWorkspaceStore(),
  element = ref<HTMLElement | null>(null),
  cursor = ref(''),
  notice = ref('')
const parana = paranaBounds()
let map: L.Map | null = null,
  generation = 0,
  observer: ResizeObserver | null = null
const cache = new Map<number, L.GeoJSON>(),
  requests = new Map<number, AbortController>()
const featureIndexes = new Map<number, IndexedFeature[]>()
let inspected: L.LatLng | null = null
let inspectionMarker: L.CircleMarker | null = null
function closeInspection() {
  inspected = null
  inspectionMarker?.remove()
  inspectionMarker = null
  emit('inspect', null)
}
function hitQuery(currentMap: L.Map, point: L.LatLng, tolerance: number): HitQuery {
  const pixel = currentMap.latLngToContainerPoint(point)
  const northWest = currentMap.containerPointToLatLng([pixel.x - tolerance, pixel.y - tolerance])
  const southEast = currentMap.containerPointToLatLng([pixel.x + tolerance, pixel.y + tolerance])
  return {
    longitude: point.lng,
    latitude: point.lat,
    pixel,
    tolerance,
    bounds: [
      Math.min(northWest.lng, southEast.lng),
      Math.min(northWest.lat, southEast.lat),
      Math.max(northWest.lng, southEast.lng),
      Math.max(northWest.lat, southEast.lat),
    ],
    project: (position: number[]) =>
      currentMap.latLngToContainerPoint([position[1]!, position[0]!]),
  }
}
// Balão ao passar o mouse sobre um imóvel do CAR de qualquer camada ativa.
let hoverTooltip: L.Tooltip | null = null,
  hoveredFeature: object | null = null,
  hoverPoint: L.LatLng | null = null,
  hoverFrame = 0
function hideHover() {
  hoveredFeature = null
  if (hoverTooltip) map?.closeTooltip(hoverTooltip)
}
function featureUnderCursor(point: L.LatLng) {
  if (!map) return null
  const query = hitQuery(map, point, 3)
  for (const reference of workspace.availableReferences) {
    if (!workspace.isVisible(reference.fileId)) continue
    const index = featureIndexes.get(reference.fileId)
    if (!index) continue
    const found = featuresAt(index, query).find((feature) => isCarProperty(feature.properties))
    if (found) return found
  }
  return null
}
function updateHover(point: L.LatLng) {
  const feature = featureUnderCursor(point)
  if (!map || !feature) return hideHover()
  hoverTooltip ??= L.tooltip({
    direction: 'top',
    offset: [0, -8],
    opacity: 1,
    className: 'property-tooltip',
  })
  // Só remonta o conteúdo quando o mouse muda de imóvel.
  if (feature !== hoveredFeature) {
    hoveredFeature = feature
    hoverTooltip.setContent(tooltipElement(tooltipRows(feature.properties)))
  }
  hoverTooltip.setLatLng(point)
  map.openTooltip(hoverTooltip)
}
// No máximo uma busca por quadro, para não pesar enquanto o mouse se move.
function scheduleHover(point: L.LatLng) {
  hoverPoint = point
  if (hoverFrame) return
  hoverFrame = requestAnimationFrame(() => {
    hoverFrame = 0
    if (hoverPoint) updateHover(hoverPoint)
  })
}
function stopHover() {
  hoverPoint = null
  if (hoverFrame) cancelAnimationFrame(hoverFrame)
  hoverFrame = 0
  hideHover()
}
function refreshInspection() {
  if (!map || !inspected) return
  const currentMap = map,
    point = inspected
  const query = hitQuery(currentMap, point, 7)
  const result: MapInspection = {
    latitude: point.lat,
    longitude: point.lng,
    groups: [],
    pending: [],
    failed: [],
  }
  for (const reference of workspace.availableReferences) {
    if (workspace.runtime[reference.fileId]?.error) result.failed.push(reference.name)
    if (!workspace.isVisible(reference.fileId)) continue
    const index = featureIndexes.get(reference.fileId)
    if (!index) {
      result.pending.push(reference.name)
      continue
    }
    const features = featuresAt(index, query)
    if (features.length)
      result.groups.push({
        fileId: reference.fileId,
        name: reference.name,
        color: workspace.colorFor(reference.fileId),
        features,
      })
  }
  emit('inspect', result)
}
function inspect(event: L.LeafletMouseEvent) {
  if (!map || !active || !props.visible || workspace.loadingWorkspace) return
  inspected = event.latlng
  inspectionMarker?.remove()
  inspectionMarker = L.circleMarker(inspected, {
    radius: 9,
    color: '#FFFFFF',
    weight: 2,
    fill: false,
    interactive: false,
  }).addTo(map)
  refreshInspection()
}
function styleFor(id: number, geometryType?: string): L.PathOptions {
  const point = geometryType === 'Point' || geometryType === 'MultiPoint'
  return {
    color: point ? '#F4F7FF' : workspace.colorFor(id),
    fillColor: workspace.colorFor(id),
    weight: point ? 1.25 : 2.5,
    opacity: workspace.getOpacity(id),
    fillOpacity: workspace.getOpacity(id) * (point ? 0.95 : 0.18),
  }
}
function build(data: FeatureCollection, id: number) {
  return L.geoJSON(data, {
    interactive: false,
    pointToLayer: (_feature, latlng) =>
      L.circleMarker(latlng, { radius: 5, ...styleFor(id, 'Point'), interactive: false }),
    style: (feature) => styleFor(id, feature?.geometry?.type),
  })
}
function clear() {
  ++generation
  requests.forEach((request) => request.abort())
  requests.clear()
  cache.forEach((layer) => layer.remove())
  cache.clear()
  featureIndexes.clear()
  closeInspection()
  stopHover()
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
    featureIndexes.set(id, indexFeatures(data))
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
    if (epoch === generation) {
      inspectionMarker?.bringToFront()
      refreshInspection()
    }
  }
}
function sync() {
  if (!map) return
  hideHover()
  for (const [id, layer] of cache) {
    layer.setStyle((feature) => styleFor(id, feature?.geometry?.type))
    if (workspace.isVisible(id)) {
      if (!map.hasLayer(layer)) layer.addTo(map)
    } else layer.remove()
  }
  for (const id of workspace.visibleLayerIds) void loadLayer(id)
  inspectionMarker?.bringToFront()
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
  // Reserva espaço para o mapa em telas pequenas e com painéis sobrepostos.
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
let active = true
function resize() {
  if (active) map?.invalidateSize()
}
watch(() => workspace.revision, clear, { flush: 'sync' })
watch(() => [workspace.visibleLayerIds, workspace.availableReferences], refreshInspection, {
  deep: true,
})
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
  addMapPresentation(map)
  map.on('click', inspect)
  map.on('zoomend', refreshInspection)
  map.on('mousemove', (event: L.LeafletMouseEvent) => {
    cursor.value = `${event.latlng.lat.toFixed(5)}, ${event.latlng.lng.toFixed(5)}`
    scheduleHover(event.latlng)
  })
  map.on('mouseout', () => {
    cursor.value = ''
    stopHover()
  })
  if (typeof ResizeObserver !== 'undefined') {
    observer = new ResizeObserver(resize)
    observer.observe(element.value)
  }
  window.addEventListener('resize', resize)
  sync()
  resize()
})
onActivated(async () => {
  active = true
  await nextTick()
  resize()
})
onDeactivated(() => {
  active = false
})
onBeforeUnmount(() => {
  clear()
  observer?.disconnect()
  window.removeEventListener('resize', resize)
  map?.remove()
  map = null
  hoverTooltip = null
})
defineExpose({ fitVisibleLayers, resetView, closeInspection })
</script>
<style scoped>
.map-shell :deep(.leaflet-tooltip.property-tooltip) {
  padding: 8px 10px;
  border: 1px solid rgba(var(--v-theme-on-surface), 0.16);
  border-radius: 10px;
  background: rgba(var(--v-theme-surface), 0.97);
  color: rgb(var(--v-theme-on-surface));
  box-shadow: 0 6px 22px rgba(0, 0, 0, 0.3);
  font-size: 11px;
  line-height: 1.45;
  pointer-events: none;
}
.map-shell :deep(.property-tooltip.leaflet-tooltip-top::before) {
  border-top-color: rgba(var(--v-theme-surface), 0.97);
}
.map-shell :deep(.property-tooltip-body > div) {
  display: flex;
  justify-content: space-between;
  gap: 14px;
}
.map-shell :deep(.property-tooltip-body span) {
  opacity: 0.6;
}
.map-shell :deep(.property-tooltip-body strong) {
  max-width: 260px;
  overflow-wrap: anywhere;
  font-weight: 600;
  text-align: right;
}
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
  background: #141414;
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
</style>