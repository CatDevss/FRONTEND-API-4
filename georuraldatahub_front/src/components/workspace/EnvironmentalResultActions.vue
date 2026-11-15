<template>
  <div class="result-actions">
    <v-btn variant="tonal" :disabled="exporting" @click="csv">CSV</v-btn
    ><v-btn variant="tonal" :loading="exporting" @click="excel">Excel</v-btn
    ><v-btn variant="tonal" @click="pdf">PDF / imprimir</v-btn
    ><v-btn
      color="primary"
      variant="tonal"
      prepend-icon="mdi-map-outline"
      :loading="mapping"
      @click="showMap"
      >Ver no mapa</v-btn
    >
  </div>
  <v-alert v-if="error" type="error" class="my-3">{{ error }}</v-alert
  ><EnvironmentalResultMap v-if="map" :data="map" />
</template>
<script setup lang="ts">
import { ref, computed, onBeforeUnmount, watch, defineAsyncComponent } from 'vue'
import {
  reportRows,
  reportCsv,
  download,
  exportExcel,
  printReport,
  type CalculationSnapshot,
} from '@/services/environmentalReport'
import { loadResultMap, type ResultMap } from '@/services/environmentalIndicators'
import { apiError } from '@/services/contracts'
const EnvironmentalResultMap = defineAsyncComponent(() => import('./EnvironmentalResultMap.vue'))
const props = defineProps<{ snapshot: CalculationSnapshot }>()
const rows = computed(() => reportRows(props.snapshot)),
  exporting = ref(false),
  mapping = ref(false),
  error = ref(''),
  map = ref<ResultMap | null>(null)
let epoch = 0
function csv() {
  download(
    new Blob([reportCsv(rows.value)], { type: 'text/csv;charset=utf-8' }),
    'indicador-ambiental.csv',
  )
}
async function excel() {
  exporting.value = true
  error.value = ''
  try {
    await exportExcel(rows.value)
  } catch {
    error.value = 'Não foi possível gerar Excel. Confira a conexão com o backend e tente novamente.'
  } finally {
    exporting.value = false
  }
}
function pdf() {
  try {
    printReport(rows.value)
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Não foi possível abrir o relatório.'
  }
}
async function showMap() {
  const request = ++epoch
  mapping.value = true
  error.value = ''
  const snapshot = props.snapshot
  try {
    const data = await loadResultMap(snapshot.featureId, snapshot.indicator, snapshot.parameters)
    if (request !== epoch) return
    if (data.type !== 'FeatureCollection' || !Array.isArray(data.features))
      throw new Error('Mapa inválido')
    map.value = data
  } catch (e) {
    if (request === epoch)
      error.value = apiError(
        e,
        'Não foi possível carregar o mapa. A rotina opcional precisa estar instalada e validada no Oracle.',
      )
  } finally {
    if (request === epoch) mapping.value = false
  }
}
watch(
  () => props.snapshot,
  () => {
    epoch++
    map.value = null
    error.value = ''
    mapping.value = false
  },
)
onBeforeUnmount(() => epoch++)
</script>
<style scoped>
.result-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin: 16px 0;
}
</style>
