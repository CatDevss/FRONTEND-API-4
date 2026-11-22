<template>
  <section class="historical-report" aria-label="Relatório dos cálculos existentes">
    <h3>Resultados salvos por indicador</h3>
    <p class="note">
      Cada linha mantém o cálculo original. Períodos e fontes podem variar; valores de áreas
      sobrepostas e percentuais não são somados.
    </p>
    <p v-if="appliedContext" class="note" data-testid="applied-history-filters">
      {{
        Object.entries(appliedContext)
          .map(([key, value]) => `${key}: ${value}`)
          .join(' · ')
      }}
    </p>
    <p v-if="loading" role="status" class="note">
      Carregando resultados salvos: {{ done }} de {{ total }}.
    </p>
    <v-btn v-if="loading" variant="text" @click="cancel">Cancelar carregamento</v-btn>
    <v-alert v-if="error" type="warning">{{ error }}</v-alert>
    <p v-if="!loading && !error && !groups.length" class="note">
      Nenhum cálculo salvo corresponde aos filtros.
    </p>
    <section v-for="group in groups" :key="group.indicator">
      <h4>{{ indicatorName(group.indicator) }} · {{ group.entries.length }} cálculo(s)</h4>
      <EnvironmentalBatchResults
        :areas="group.entries.map((entry) => entry.area)"
        :entries="group.entries"
        :indicator="group.indicator"
        :parameters="{}"
        :busy="false"
        :stopping="false"
        historical
        :report-context="appliedContext ?? {}"
        @new="$emit('new')"
      />
    </section>
  </section>
</template>
<script setup lang="ts">
import { ref, watch, onBeforeUnmount } from 'vue'
import { historicalReport, type HistoricalGroup } from '@/services/environmentalHistoryReport'
import { indicators, historySearchError } from '@/services/environmentalIndicators'
import EnvironmentalBatchResults from './EnvironmentalBatchResults.vue'
import type { HistoryFilters } from '@/services/environmentalHistoryFilters'
const props = defineProps<{
  query: {
    search: string
    indicator: string
    revision: number
    filters?: HistoryFilters
    layerLabel?: string
  }
}>()
defineEmits<{ new: [] }>()
const groups = ref<HistoricalGroup[]>([]),
  loading = ref(false),
  error = ref(''),
  done = ref(0),
  total = ref(0)
const appliedContext = ref<Record<string, string> | null>(null)
let controller: AbortController | undefined,
  epoch = 0
const indicatorName = (id: string) =>
  indicators.find((item) => item.id === id)?.name ?? (id === 'todos' ? 'Sete indicadores' : id)
function cancel() {
  epoch++
  controller?.abort()
  loading.value = false
  error.value = 'Carregamento cancelado. Os resultados anteriores foram mantidos.'
}
watch(
  () => props.query,
  async (query) => {
    const request = ++epoch
    controller?.abort()
    controller = new AbortController()
    loading.value = true
    error.value = ''
    done.value = 0
    total.value = 0
    try {
      const data = await historicalReport(
        query.search,
        query.indicator,
        controller.signal,
        (loaded, count) => {
          if (request === epoch) {
            done.value = loaded
            total.value = count
          }
        },
        query.filters,
      )
      if (request === epoch) {
        groups.value = data
        appliedContext.value = {
          'Camada da área':
            query.layerLabel ||
            (query.filters?.camadaId ? `Camada ${query.filters.camadaId}` : 'Todas'),
          'Período pesquisado': `${query.filters?.inicio || 'Sem início'} a ${query.filters?.fim || 'Sem fim'}`,
          ...(query.search ? { 'Busca por área': query.search } : {}),
        }
      }
    } catch (failure) {
      if (request === epoch) error.value = historySearchError(failure)
    } finally {
      if (request === epoch) loading.value = false
    }
  },
  { immediate: true },
)
onBeforeUnmount(() => {
  epoch++
  controller?.abort()
})
</script>
<style scoped>
.historical-report {
  margin: 24px 0;
  padding: 20px 0;
  border-block: 1px solid rgba(var(--v-theme-on-surface), 0.15);
}
.note {
  font-size: 12px;
  line-height: 1.7;
  margin: 12px 0;
}
h4 {
  margin-top: 24px;
}
</style>
