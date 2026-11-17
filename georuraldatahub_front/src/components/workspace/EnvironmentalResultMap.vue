<template>
  <div>
    <div class="result-tools">
      <v-btn
        size="small"
        variant="tonal"
        prepend-icon="mdi-fit-to-screen-outline"
        @click="fitVisibleLayers"
        >Enquadrar camadas</v-btn
      ><v-btn size="small" variant="text" prepend-icon="mdi-crosshairs-gps" @click="resetView"
        >Ver Paraná</v-btn
      >
    </div>
    <div class="legend" aria-label="Camadas do resultado">
      <div v-for="group in groups" :key="group.key" class="legend-group">
        <span><i :style="{ background: group.color }" />{{ group.label }}</span>
        <label class="opacity-label"
          >Opacidade
          <input
            type="range"
            min="0"
            max="100"
            :value="Math.round((opacity[group.key] ?? 1) * 100)"
            :aria-label="`Opacidade de ${group.label}`"
            @input="changeOpacity(group.key, $event)"
        /></label>
      </div>
    </div>
    <div class="result-map-layout" :class="{ 'has-inspection': !!inspection }">
      <div class="result-map-shell georural-map">
        <div ref="element" class="result-map" aria-label="Mapa das contribuições ambientais" />
        <span v-if="cursor" class="result-cursor">{{ cursor }}</span>
      </div>
      <WorkspaceInspection v-if="inspection" :result="inspection" @close="closeInspection" />
    </div>
    <p class="note">
      {{
        data.aviso ||
        'Representação geográfica das contribuições. As medidas oficiais permanecem as do cálculo em Albers.'
      }}
    </p>
  </div>
</template>
<script setup lang="ts">
import { computed, onMounted, onBeforeUnmount, ref, watch, nextTick } from 'vue'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import '@/assets/map.css'
import { addMapPresentation, paranaBounds } from '@/services/mapPresentation'
import {
  indexFeatures,
  featuresAt,
  type MapInspection,
  type IndexedFeature,
} from '@/services/mapInspection'
import WorkspaceInspection from './WorkspaceInspection.vue'
import type { FeatureCollection } from 'geojson'
import type { ResultMap } from '@/services/environmentalIndicators'
const props = defineProps<{ data: ResultMap }>()
const element = ref<HTMLElement | null>(null)
const colors: Record<string, string> = {
  analise: '#268be8',
  ICV: '#2eaa67',
  IRL: '#a975e2',
  IAPP: '#2eaa67',
  APP: '#e5ae38',
  ISAP: '#2eaa67',
  IAE: '#e65c55',
  IFC: '#f28c28',
  IDesmat2008: '#eac149',
  IDesmat2019: '#ed8f3c',
  IDesmat2020: '#de4d48',
}
const labels: Record<string, string> = {
  analise: 'Área de análise',
  ICV: 'Vegetação no recorte',
  IRL: 'Reserva legal no recorte',
  IAPP: 'APP conservada',
  APP: 'APP total no recorte',
  ISAP: 'Áreas protegidas',
  IAE: 'Áreas embargadas',
  IFC: 'Focos no período',
  IDesmat2008: 'Desde 22/07/2008',
  IDesmat2019: 'Desde 31/07/2019',
  IDesmat2020: 'Desde 31/12/2020',
}
const groups = computed(() =>
  [...new Set(props.data.features.map((f) => String(f.properties?.papel ?? 'contribuicao')))].map(
    (key) => ({ key, label: labels[key] ?? key, color: colors[key] ?? '#2eaa67' }),
  ),
)
const opacity = ref<Record<string, number>>({}),
  cursor = ref(''),
  inspection = ref<MapInspection | null>(null)
let map: L.Map | undefined,
  control: L.Control.Layers | undefined,
  observer: ResizeObserver | undefined
let inspected: L.LatLng | null = null,
  marker: L.CircleMarker | undefined
const overlays = new Map<string, L.GeoJSON>(),
  indexes = new Map<string, IndexedFeature[]>()
function styleFor(key: string, point = false): L.PathOptions {
  const alpha = opacity.value[key] ?? 1,
    color = colors[key] ?? '#2eaa67'
  return {
    color: point ? '#F4F7FF' : color,
    fillColor: color,
    weight: point ? 1.25 : key === 'analise' ? 3 : 2.5,
    opacity: alpha,
    fillOpacity: key === 'analise' ? 0 : alpha * (point ? 0.95 : 0.18),
    dashArray: key === 'analise' ? '6 4' : undefined,
  }
}
function changeOpacity(key: string, event: Event) {
  opacity.value[key] = Number((event.target as HTMLInputElement).value) / 100
  overlays
    .get(key)
    ?.setStyle((feature) =>
      styleFor(
        key,
        feature?.geometry?.type === 'Point' || feature?.geometry?.type === 'MultiPoint',
      ),
    )
}
function closeInspection() {
  inspected = null
  marker?.remove()
  marker = undefined
  inspection.value = null
}
function refreshInspection() {
  if (!map || !inspected) return
  const current = map,
    point = inspected,
    pixel = current.latLngToContainerPoint(point),
    tolerance = 7
  const nw = current.containerPointToLatLng([pixel.x - tolerance, pixel.y - tolerance]),
    se = current.containerPointToLatLng([pixel.x + tolerance, pixel.y + tolerance])
  const query = {
    longitude: point.lng,
    latitude: point.lat,
    pixel,
    tolerance,
    bounds: [
      Math.min(nw.lng, se.lng),
      Math.min(nw.lat, se.lat),
      Math.max(nw.lng, se.lng),
      Math.max(nw.lat, se.lat),
    ] as [number, number, number, number],
    project: (position: number[]) => current.latLngToContainerPoint([position[1]!, position[0]!]),
  }
  const result: MapInspection = {
    latitude: point.lat,
    longitude: point.lng,
    groups: [],
    pending: [],
    failed: [],
  }
  groups.value.forEach((group, index) => {
    const overlay = overlays.get(group.key),
      features = indexes.get(group.key)
    if (!overlay || !features || !current.hasLayer(overlay)) return
    const hits = featuresAt(features, query)
    if (hits.length)
      result.groups.push({
        fileId: index + 1,
        name: group.label,
        color: group.color,
        features: hits,
      })
  })
  inspection.value = result
}
function inspect(event: L.LeafletMouseEvent) {
  if (!map) return
  inspected = event.latlng
  marker?.remove()
  marker = L.circleMarker(inspected, {
    radius: 9,
    color: '#FFFFFF',
    weight: 2,
    fill: false,
    interactive: false,
  }).addTo(map)
  refreshInspection()
}
function fitVisibleLayers() {
  if (!map) return
  const bounds = L.latLngBounds([])
  for (const overlay of overlays.values())
    if (map.hasLayer(overlay) && overlay.getBounds().isValid()) bounds.extend(overlay.getBounds())
  if (bounds.isValid()) map.fitBounds(bounds, { padding: [24, 24], maxZoom: 15 })
}
function resetView() {
  map?.fitBounds(paranaBounds(), { padding: [24, 24] })
}
function render() {
  if (!map) return
  closeInspection()
  for (const overlay of overlays.values()) {
    control?.removeLayer(overlay)
    overlay.remove()
  }
  overlays.clear()
  indexes.clear()
  for (const group of groups.value) {
    const key = group.key,
      data: FeatureCollection = {
        type: 'FeatureCollection',
        features: props.data.features.filter(
          (f) => String(f.properties?.papel ?? 'contribuicao') === key,
        ),
      }
    const overlay = L.geoJSON(data, {
      interactive: false,
      style: (feature) =>
        styleFor(
          key,
          feature?.geometry?.type === 'Point' || feature?.geometry?.type === 'MultiPoint',
        ),
      pointToLayer: (_, latlng) =>
        L.circleMarker(latlng, { radius: 5, ...styleFor(key, true), interactive: false }),
    })
    overlays.set(key, overlay)
    indexes.set(key, indexFeatures(data))
    overlay.addTo(map)
    control?.addOverlay(overlay, group.label)
  }
  // Mantém o contorno da área de análise acima dos preenchimentos.
  overlays.get('analise')?.bringToFront()
  fitVisibleLayers()
}
onMounted(async () => {
  await nextTick()
  if (!element.value) return
  map = L.map(element.value, { preferCanvas: true, zoomControl: false }).fitBounds(paranaBounds())
  control = addMapPresentation(map)
  map.on('click', inspect)
  map.on('zoomend', refreshInspection)
  map.on('overlayadd overlayremove', () => {
    overlays.get('analise')?.bringToFront()
    marker?.bringToFront()
    refreshInspection()
  })
  map.on('mousemove', (event: L.LeafletMouseEvent) => {
    cursor.value = `${event.latlng.lat.toFixed(5)}, ${event.latlng.lng.toFixed(5)}`
  })
  map.on('mouseout', () => {
    cursor.value = ''
  })
  render()
  if (typeof ResizeObserver !== 'undefined') {
    observer = new ResizeObserver(() => map?.invalidateSize())
    observer.observe(element.value)
  }
})
watch(() => props.data, render)
watch(
  () => !!inspection.value,
  async () => {
    await nextTick()
    map?.invalidateSize()
  },
)
onBeforeUnmount(() => {
  observer?.disconnect()
  closeInspection()
  map?.remove()
  map = undefined
})
</script>
<style scoped>
.result-map {
  height: 420px;
  min-height: 280px;
  border-radius: 12px;
}
.legend {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin: 12px 0;
  font-size: 12px;
}
.legend span {
  display: flex;
  align-items: center;
  gap: 6px;
}
.legend i {
  width: 12px;
  height: 12px;
  border-radius: 50%;
}
.note {
  font-size: 12px;
  line-height: 1.6;
  margin-top: 12px;
}
.result-tools {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  margin: 12px 0;
}
.result-map-layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 12px;
  align-items: stretch;
}
.result-map-layout.has-inspection {
  grid-template-columns: minmax(0, 1fr) minmax(260px, 340px);
}
.result-map-layout > :deep(.inspection) {
  width: 100%;
  max-height: 500px;
}
.result-map-shell {
  position: relative;
  isolation: isolate;
  min-width: 0;
  overflow: hidden;
  border-radius: 12px;
  background: #141414;
}
.result-map {
  height: 500px;
}
.result-cursor {
  position: absolute;
  bottom: 6px;
  left: 125px;
  z-index: 1000;
  padding: 4px 8px;
  border-radius: 6px;
  font-size: 10px;
  font-variant-numeric: tabular-nums;
  background: rgba(var(--v-theme-surface), 0.96);
  color: rgb(var(--v-theme-on-surface));
}
.legend-group {
  display: flex;
  align-items: center;
  gap: 16px;
  flex-wrap: wrap;
  padding: 8px 12px;
  border: 1px solid rgba(var(--v-theme-on-surface), 0.12);
  border-radius: 10px;
}
.opacity-label {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 10px;
  color: rgba(var(--v-theme-on-surface), 0.6);
}
.opacity-label input {
  width: 70px;
  accent-color: rgb(var(--v-theme-primary));
}
@media (max-width: 850px) {
  .result-map-layout.has-inspection {
    grid-template-columns: minmax(0, 1fr);
  }
  .result-map-layout > :deep(.inspection) {
    max-height: 320px;
  }
  .result-map {
    height: 400px;
  }
}
</style>
