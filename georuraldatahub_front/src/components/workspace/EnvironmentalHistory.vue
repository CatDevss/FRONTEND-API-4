<template>
  <section
    ref="panelElement"
    class="history-panel environmental-surface"
    aria-label="Histórico de cálculos"
  >
    <v-alert v-if="notice" type="success" variant="tonal" class="mb-4">{{ notice }}</v-alert>
    <div class="history-tabs">
      <v-btn :variant="mode === 'calculations' ? 'tonal' : 'text'" @click="mode = 'calculations'"
        >Todos os cálculos</v-btn
      >
      <v-btn :variant="mode === 'reports' ? 'tonal' : 'text'" @click="mode = 'reports'"
        >Gerar relatório</v-btn
      >
      <v-btn v-if="grouped" :variant="mode === 'saved' ? 'tonal' : 'text'" @click="mode = 'saved'"
        >Execuções salvas</v-btn
      >
    </div>
    <EnvironmentalReports
      v-if="reportsVisited"
      v-show="mode === 'reports'"
      :active="mode === 'reports'"
      view="history"
      @new="$emit('new')"
      @calculations="mode = 'calculations'"
    />
    <EnvironmentalReports
      v-if="savedVisited"
      v-show="mode === 'saved'"
      :active="mode === 'saved'"
      view="saved"
      @new="$emit('new')"
      @calculations="mode = 'calculations'"
    />
    <div v-show="mode === 'calculations'" class="history-calculations">
      <template v-if="!detail">
        <h3>Cálculos salvos</h3>
        <p class="note">
          Inclui os cálculos antigos e os vinculados a relatórios. Abra um registro para consultar
          ou exportar.
        </p>
        <p class="note">Escolha os filtros e clique em Buscar para atualizar a lista.</p>
        <div class="history-filters">
          <v-text-field
            v-model="search"
            label="Buscar área"
            :disabled="loading || !!deleting"
            prepend-inner-icon="mdi-magnify"
            variant="outlined"
            density="compact"
            hide-details
            @keyup.enter="!loading && !deleting && load(0)"
          /><v-select
            :menu-props="{ contentClass: 'environmental-menu', closeOnContentClick: true }"
            v-model:menu="filterMenu"
            @update:model-value="filterChanged"
            v-model="indicator"
            :items="filters"
            label="Indicador"
            :disabled="loading || !!deleting"
            variant="outlined"
            density="compact"
            hide-details
            clearable
          /><v-btn
            variant="tonal"
            :loading="loading"
            :disabled="loading || !!deleting"
            @click="load(0)"
            >Buscar</v-btn
          >
        </div>
        <EnvironmentalHistoryFilters v-model="historyFilters" :disabled="loading || !!deleting" />
        <v-alert v-if="error" type="error" class="my-3">{{ error }}</v-alert>
        <p v-if="error && items.length" class="note">
          Os resultados da última busca concluída foram mantidos.
        </p>
        <p v-if="loading" class="note" role="status">Buscando cálculos…</p>
        <p v-if="!loading && !error && !items.length" class="note">
          Nenhum cálculo salvo encontrado.
        </p>
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
              ><v-btn
                v-if="canRemove"
                color="error"
                variant="text"
                :disabled="!!deleting || loading"
                :loading="deleting === item.id"
                @click.stop="askDelete(item)"
                >Excluir</v-btn
              ></template
            ></v-list-item
          ></v-list
        >
        <div v-if="!error" class="history-pages">
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
        <EnvironmentalQuality :result="detail.result" :area-name="detail.calculation.name" />
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
    </div>
    <ConfirmDialog
      v-if="confirmDeletion"
      v-model="confirmDeletion"
      title="Excluir cálculo?"
      :message="`Excluir o cálculo #${pendingDeletion?.id ?? ''} (${pendingDeletion?.name ?? ''}) do histórico individual? Os dados originais, a auditoria e o conteúdo de relatórios já salvos serão preservados.`"
      @confirm="removeCalculation"
    />
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
import { historySearchError } from '@/services/environmentalIndicators'
import EnvironmentalReports from './EnvironmentalReports.vue'
import EnvironmentalHistoryFilters from './EnvironmentalHistoryFilters.vue'
import { historyFilterError, type HistoryFilters } from '@/services/environmentalHistoryFilters'
import EnvironmentalQuality from './EnvironmentalQuality.vue'
import { deleteCalculation, calculationDeletionAvailable } from '@/services/environmentalReports'
import ConfirmDialog from '@/components/ConfirmDialog.vue'
import { can, currentUserId } from '@/access/session'
import { reportsAvailable } from '@/services/environmentalReports'
const grouped = ref(false),
  reportsVisited = ref(false),
  savedVisited = ref(false),
  mode = ref('calculations')
defineEmits<{ new: [] }>()
import EnvironmentalResultActions from './EnvironmentalResultActions.vue'
const search = ref(''),
  indicator = ref<string | null>(''),
  filterMenu = ref(false),
  items = ref<HistoryEntry[]>([]),
  total = ref(0),
  page = ref(0),
  loading = ref(false),
  opening = ref<number | null>(null),
  error = ref(''),
  detail = ref<HistoryDetail | null>(null)
const historyFilters = ref<HistoryFilters>({})
let appliedSearch = { search: '', indicator: '', filters: {} as HistoryFilters }
const deletionEnabled = ref(false),
  confirmDeletion = ref(false),
  deleting = ref<number | null>(null),
  pendingDeletion = ref<HistoryEntry | null>(null),
  notice = ref('')
const canRemove = computed(
  () => deletionEnabled.value && can('reports.delete') && !!currentUserId.value,
)
function askDelete(item: HistoryEntry) {
  if (!canRemove.value || deleting.value) return
  pendingDeletion.value = item
  confirmDeletion.value = true
}
async function removeCalculation() {
  const item = pendingDeletion.value,
    user = currentUserId.value
  if (!item || !user || !canRemove.value || deleting.value) return
  openEpoch++
  opening.value = null
  deleting.value = item.id
  error.value = ''
  notice.value = ''
  try {
    await deleteCalculation(item.id, user)
    items.value = items.value.filter((row) => row.id !== item.id)
    total.value = Math.max(0, total.value - 1)
    if (detail.value?.calculation.id === item.id) close()
    notice.value =
      'Cálculo excluído do histórico individual. A exclusão foi registrada na auditoria; relatórios já salvos foram preservados.'
    if (!items.value.length && page.value > 0) await load(page.value - 1)
  } catch (e) {
    error.value = apiError(
      e,
      'Não foi possível confirmar a exclusão. Atualize a lista antes de tentar novamente.',
    )
  } finally {
    deleting.value = null
    pendingDeletion.value = null
  }
}
const panelElement = ref<HTMLElement | null>(null)
watch(mode, (value) => {
  filterMenu.value = false
  if (value === 'reports') reportsVisited.value = true
  if (value === 'saved') savedVisited.value = true
})
watch(detail, async () => {
  await nextTick()
  const viewport = panelElement.value?.closest('.workspace-content')
  if (viewport) viewport.scrollTop = 0
})
const filters = [
  { title: 'Todos os indicadores', value: '' },
  ...indicators.map((i) => ({ title: i.name, value: i.id })),
  { title: 'Sete indicadores no mesmo cálculo', value: 'todos' },
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
function filterChanged(value: string | null) {
  indicator.value = value
  filterMenu.value = false
}
let listRequest: AbortController | undefined
let epoch = 0,
  openEpoch = 0
async function load(next: number) {
  if (loading.value) return
  const query =
    next === 0
      ? {
          search: search.value,
          indicator: indicator.value ?? '',
          filters: { ...historyFilters.value },
        }
      : appliedSearch
  error.value = historyFilterError(query.filters)
  if (error.value) return
  const request = ++epoch
  listRequest?.abort()
  listRequest = new AbortController()
  filterMenu.value = false
  loading.value = true
  error.value = ''
  try {
    const data = await listHistory(
      query.search,
      query.indicator,
      next,
      listRequest.signal,
      query.filters,
    )
    if (request !== epoch) return
    items.value = data.items
    total.value = data.total
    page.value = next
    appliedSearch = query
  } catch (e) {
    if (request === epoch) {
      error.value = historySearchError(e)
    }
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
onMounted(async () => {
  void load(0)
  void calculationDeletionAvailable()
    .then((enabled) => {
      deletionEnabled.value = enabled
    })
    .catch(() => {
      deletionEnabled.value = false
    })
  try {
    grouped.value = await reportsAvailable()
  } catch {
    grouped.value = false
  }
})
onBeforeUnmount(() => {
  listRequest?.abort()
  epoch++
  openEpoch++
})
</script>
<style scoped>
.history-tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 20px;
}
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
