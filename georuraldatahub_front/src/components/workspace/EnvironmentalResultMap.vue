<template>
  <div>
    <div class="legend">
      <span v-for="group in groups" :key="group.label"
        ><i :style="{ background: group.color }" />{{ group.label }}</span
      >
    </div>
    <div ref="element" class="result-map" aria-label="Mapa das contribuições ambientais" />
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
    (key) => ({ label: labels[key] ?? key, color: colors[key] ?? '#2eaa67' }),
  ),
)
let map: L.Map | undefined,
  layer: L.GeoJSON | undefined,
  control: L.Control.Layers | undefined,
  observer: ResizeObserver | undefined
function render() {
  if (!map) return
  layer?.remove()
  control?.remove()
  layer = L.geoJSON(undefined)
  const overlays: Record<string, L.Layer> = {}
  for (const key of new Set(
    props.data.features.map((f) => String(f.properties?.papel ?? 'contribuicao')),
  )) {
    const color = colors[key] ?? '#2eaa67'
    const group = L.geoJSON(
      {
        type: 'FeatureCollection',
        features: props.data.features.filter(
          (f) => String(f.properties?.papel ?? 'contribuicao') === key,
        ),
      } as FeatureCollection,
      {
        style: () => ({
          color,
          weight: key === 'analise' ? 3 : 2,
          fillOpacity: key === 'analise' ? 0 : 0.3,
          dashArray: key === 'analise' ? '6 4' : undefined,
        }),
        pointToLayer: (_, latlng) => L.circleMarker(latlng, { radius: 5, color, fillOpacity: 0.8 }),
        onEachFeature: (feature, item) => {
          const text = document.createElement('span')
          text.textContent = labels[key] ?? key
          item.bindTooltip(text)
        },
      },
    )
    overlays[labels[key] ?? key] = group
    layer.addLayer(group)
  }
  layer.addTo(map)
  control = L.control.layers(undefined, overlays, { collapsed: false }).addTo(map)
  const bounds = layer.getBounds()
  if (bounds.isValid()) map.fitBounds(bounds, { padding: [20, 20] })
}
onMounted(async () => {
  await nextTick()
  if (!element.value) return
  map = L.map(element.value).setView([-24.5, -51.5], 7)
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap contributors',
    maxZoom: 19,
  }).addTo(map)
  render()
  observer = new ResizeObserver(() => map?.invalidateSize())
  observer.observe(element.value)
})
watch(() => props.data, render)
onBeforeUnmount(() => {
  observer?.disconnect()
  map?.remove()
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
</style>
