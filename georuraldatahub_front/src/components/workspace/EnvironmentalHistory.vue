<template>
  <section
    ref="panelElement"
    class="history-panel environmental-surface"
    aria-label="Histórico de cálculos"
  >
    <template v-if="!detail">
      <h3>Cálculos salvos</h3>
      <p class="note">Abra um registro para consultar e exportar o resultado armazenado.</p>
      <div class="history-filters">
        <v-text-field
          v-model="search"
          label="Buscar área"
          prepend-inner-icon="mdi-magnify"
          variant="outlined"
          density="compact"
          hide-details
          @keyup.enter="load(0)"
        /><v-select
          :menu-props="{ contentClass: 'environmental-menu' }"
          v-model="indicator"
          :items="filters"
          label="Indicador"
          variant="outlined"
          density="compact"
          hide-details
          clearable
        /><v-btn variant="tonal" :loading="loading" @click="load(0)">Buscar</v-btn>
      </div>
      <v-alert v-if="error" type="error" class="my-3">{{ error }}</v-alert>
      <p v-if="!loading && !items.length" class="note">Nenhum cálculo salvo encontrado.</p>
      <v-list bg-color="transparent"
        ><v-list-item
          v-for="item in items"
          :key="item.id"
          :title="item.name"
          :subtitle="`${indicatorName(item.indicator)} · ${dateLabel(item.calculatedAt)} · #${item.id}`"
          prepend-icon="mdi-history"
          @click="open(item.id)"
          ><template #append
            ><v-btn
              variant="text"
              size="small"
              :loading="opening === item.id"
              @click.stop="open(item.id)"
              >Abrir</v-btn
            ></template
          ></v-list-item
        ></v-list
      >
      <div class="history-pages">
        <v-btn variant="text" :disabled="page === 0 || loading" @click="load(page - 1)"
          >Anterior</v-btn
        ><span>{{ total }} cálculo(s) · página {{ page + 1 }}</span
        ><v-btn
          variant="text"
          :disabled="(page + 1) * 20 >= total || loading"
          @click="load(page + 1)"
          >Próxima</v-btn
        >
      </div>
    </template>
    <template v-else>
      <div class="detail-nav">
        <v-btn variant="text" prepend-icon="mdi-arrow-left" @click="close"
          >Voltar ao histórico</v-btn
        ><span class="note">Registro #{{ detail.calculation.id }}</span>
      </div>
      <p class="note">
        {{ indicatorName(detail.calculation.indicator) }} ·
        {{ dateLabel(detail.calculation.calculatedAt) }}
      </p>
      <h3>{{ detail.calculation.name }}</h3>
      <p class="note">
        Resultado salvo · área analisada: {{ formatValue(detail.result.areaImovelHa) }} ha
      </p>
      <div v-for="group in groups" :key="group.name" class="saved-metric">
        <h4>{{ group.name }}</h4>
        <dl>
          <template v-for="metric in group.metrics" :key="metric.key"
            ><dt>{{ metric.label }}</dt>
            <dd>
              {{ formatValue(metric.value)
              }}<span v-if="typeof metric.value === 'number'"> {{ metric.unit }}</span>
            </dd></template
          >
        </dl>
      </div>
      <EnvironmentalResultActions v-if="snapshot" :snapshot="snapshot" />
      <details>
        <summary>Parâmetros e rastreabilidade</summary>
        <dl class="trace">
          <template v-for="(value, key) in detail.parameters" :key="key"
            ><dt>{{ key }}</dt>
            <dd>
              {{ Array.isArray(value) ? value.join(', ') : (value ?? 'Não disponível') }}
            </dd></template
          >
        </dl>
        <p class="note">Regra: {{ detail.calculation.rule }}</p>
        <ul>
          <li v-for="(source, index) in sources" :key="index">{{ source }}</li>
        </ul>
      </details>
      <p class="note">
        Abrir e exportar usa os valores salvos. “Ver no mapa” refaz a visualização com os insumos
        referenciados; a geometria não foi armazenada no histórico.
      </p>
    </template>
  </section>
</template>
<script setup lang="ts">
import { computed, nextTick, onMounted, onBeforeUnmount, ref, watch } from 'vue'
import {
  listHistory,
  getHistory,
  indicators,
  formatValue,
  type HistoryEntry,
  type HistoryDetail,
} from '@/services/environmentalIndicators'
import {
  metricGroups,
  metricLabels,
  type CalculationSnapshot,
} from '@/services/environmentalReport'
import { apiError } from '@/services/contracts'
import EnvironmentalResultActions from './EnvironmentalResultActions.vue'
const search = ref(''),
  indicator = ref<string | null>(null),
  items = ref<HistoryEntry[]>([]),
  total = ref(0),
  page = ref(0),
  loading = ref(false),
  opening = ref<number | null>(null),
  error = ref(''),
  detail = ref<HistoryDetail | null>(null)
const panelElement = ref<HTMLElement | null>(null)
watch(detail, async () => {
  await nextTick()
  const viewport = panelElement.value?.closest('.workspace-content')
  if (viewport) viewport.scrollTop = 0
})
const filters = [
  ...indicators.map((i) => ({ title: i.name, value: i.id })),
  { title: 'Todos os indicadores', value: 'todos' },
]
const indicatorName = (id: string) =>
  id === 'todos' ? 'Todos os indicadores' : (indicators.find((i) => i.id === id)?.name ?? id)
const dateLabel = (value: string) => {
  const parsed = new Date(value.replace(' ', 'T'))
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleString('pt-BR')
}
const snapshot = computed<CalculationSnapshot | null>(() =>
  detail.value
    ? {
        name: detail.value.calculation.name,
        indicator: detail.value.calculation.indicator,
        featureId: detail.value.calculation.featureId,
        parameters: detail.value.parameters,
        result: detail.value.result,
      }
    : null,
)
const groups = computed(() =>
  metricGroups
    .filter((name) => detail.value?.result[name] && typeof detail.value.result[name] === 'object')
    .map((name) => ({
      name,
      metrics: Object.entries(detail.value!.result[name] as Record<string, unknown>)
        .filter(([key]) => metricLabels[key])
        .map(([key, value]) => ({
          key,
          value,
          label: metricLabels[key]![0],
          unit: metricLabels[key]![1],
        })),
    })),
)
const sources = computed(() =>
  Array.isArray(detail.value?.result.fontes)
    ? [
        ...new Set(
          (detail.value.result.fontes as Record<string, unknown>[]).map(
            (source) =>
              [
                ...new Set(
                  [source.fonte, source.arquivo, source.nome].filter((v) => typeof v === 'string'),
                ),
              ].join(' · ') + ` · versão ${source.versaoId ?? 'não disponível'}`,
          ),
        ),
      ]
    : [],
)
let epoch = 0,
  openEpoch = 0
async function load(next: number) {
  const request = ++epoch
  loading.value = true
  error.value = ''
  try {
    const data = await listHistory(search.value, indicator.value ?? '', next)
    if (request !== epoch) return
    items.value = data.items
    total.value = data.total
    page.value = next
  } catch (e) {
    if (request === epoch) error.value = apiError(e)
  } finally {
    if (request === epoch) loading.value = false
  }
}
async function open(id: number) {
  const request = ++openEpoch
  opening.value = id
  error.value = ''
  try {
    const data = await getHistory(id)
    if (request === openEpoch) detail.value = data
  } catch (e) {
    if (request === openEpoch) error.value = apiError(e)
  } finally {
    if (request === openEpoch) opening.value = null
  }
}
function close() {
  openEpoch++
  detail.value = null
  opening.value = null
}
onMounted(() => load(0))
onBeforeUnmount(() => {
  epoch++
  openEpoch++
})
</script>
<style scoped>
.history-panel {
  max-width: 1000px;
}
.history-panel h3 {
  font-size: 22px;
  margin: 12px 0;
}
.note {
  font-size: 12px;
  line-height: 1.7;
  color: rgba(var(--v-theme-on-surface), 0.65);
  margin: 12px 0;
}
.history-filters {
  display: flex;
  gap: 12px;
  align-items: center;
  margin: 24px 0;
}
.history-filters > .v-input {
  flex: 1;
  min-width: 0;
}
.history-pages,
.detail-nav {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  font-size: 12px;
}
.saved-metric {
  padding: 20px;
  border-radius: 12px;
  background: rgba(var(--v-theme-primary), 0.06);
  margin: 16px 0;
}
dl {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 14px;
  font-size: 14px;
  margin-top: 16px;
}
dd {
  font-weight: 600;
}
dd span {
  font-size: 12px;
  font-weight: 400;
  color: rgba(var(--v-theme-on-surface), 0.65);
}
summary {
  cursor: pointer;
  color: rgb(var(--v-theme-primary));
  margin-top: 24px;
}
.trace {
  grid-template-columns: minmax(120px, 1fr) 2fr;
  overflow-wrap: anywhere;
}
.trace dd {
  font-weight: 400;
}
ul {
  padding-left: 20px;
  font-size: 12px;
  line-height: 1.8;
}
@media (max-width: 600px) {
  .history-filters {
    flex-wrap: wrap;
  }
  .history-filters > .v-input {
    min-width: 100%;
  }
}
</style>
