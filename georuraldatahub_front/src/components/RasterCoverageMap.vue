<template>
  <div class="coverage-shell">
    <div
      ref="element"
      class="coverage-map"
      aria-label="Cobertura geográfica do raster, sem imagem GeoTIFF"
    />
    <p v-if="error" role="alert" class="coverage-error">{{ error }}</p>
  </div>
</template>
<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import L from 'leaflet'
import type { Feature, Polygon, MultiPolygon } from 'geojson'
import 'leaflet/dist/leaflet.css'
const props = defineProps<{ geometry: Polygon | MultiPolygon }>()
const element = ref<HTMLElement | null>(null),
  error = ref('')
let map: L.Map | null = null,
  coverage: L.GeoJSON | null = null,
  observer: ResizeObserver | null = null
function draw() {
  coverage?.remove()
  coverage = null
  error.value = ''
  if (!map) return
  try {
    if (!['Polygon', 'MultiPolygon'].includes(props.geometry.type))
      throw new Error('invalid-coverage')
    const feature: Feature<Polygon | MultiPolygon> = {
      type: 'Feature',
      properties: {},
      geometry: props.geometry,
    }
    coverage = L.geoJSON(feature, { style: { color: '#FE5000', weight: 2, fillOpacity: 0.14 } })
    if (!coverage.getBounds().isValid()) throw new Error('empty-coverage')
    coverage.addTo(map)
    map.fitBounds(coverage.getBounds(), { padding: [24, 24], maxZoom: 14 })
  } catch {
    coverage?.remove()
    coverage = null
    error.value = 'Não foi possível desenhar a cobertura informada pelo catálogo.'
  }
}
watch(() => props.geometry, draw)
onMounted(() => {
  if (!element.value) return
  map = L.map(element.value).fitBounds([
    [-26.72, -54.62],
    [-22.5, -48.02],
  ])
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap contributors',
    maxZoom: 19,
  }).addTo(map)
  if (typeof ResizeObserver !== 'undefined') {
    observer = new ResizeObserver(() => map?.invalidateSize())
    observer.observe(element.value)
  }
  draw()
})
onBeforeUnmount(() => {
  observer?.disconnect()
  coverage?.remove()
  map?.remove()
  map = null
})
</script>
<style scoped>
.coverage-shell {
  position: relative;
  border-radius: 18px;
  overflow: hidden;
  border: 1px solid var(--glass-outer-border);
}
.coverage-map {
  height: 320px;
  width: 100%;
  background: rgb(var(--v-theme-background));
}
.coverage-error {
  position: absolute;
  inset: auto 12px 12px;
  z-index: 1000;
  background: rgb(var(--v-theme-surface));
  padding: 12px;
  border-radius: 12px;
  font-size: 12px;
}
</style>
