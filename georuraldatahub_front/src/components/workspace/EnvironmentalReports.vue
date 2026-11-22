<template>
  <section>
    <v-alert v-if="notice" type="success" variant="tonal" class="mb-4">{{ notice }}</v-alert>
    <template v-if="!detail">
      <h3>{{ view === 'history' ? 'Gerar relatório do histórico' : 'Execuções salvas' }}</h3>
      <p v-if="view === 'history'" class="note">
        Reúna e exporte cálculos existentes por indicador. Cada linha mantém o resultado original;
        nenhum cálculo será executado novamente.
      </p>
      <p v-else class="note">
        Cada execução reúne as áreas escolhidas em "Calcular e salvar", com resultados, falhas e
        pendências.
      </p>
      <div class="filters">
        <v-text-field
          v-model="search"
          :label="view === 'history' ? 'Buscar área' : 'Buscar execução ou área'"
          :disabled="loading || !!deleting"
          variant="outlined"
          hide-details
          @keyup.enter="!loading && !deleting && load(0)"
        />
        <v-select
          v-model="indicator"
          :items="filters"
          v-model:menu="filterMenu"
          :menu-props="{ contentClass: 'environmental-menu', closeOnContentClick: true }"
          @update:model-value="filterChanged"
          label="Indicador"
          :disabled="loading || !!deleting"
          variant="outlined"
          hide-details
          clearable
        />
        <v-btn :loading="loading" :disabled="loading || !!deleting" @click="load(0)">Buscar</v-btn>
      </div>
      <EnvironmentalHistoryFilters
        v-model="historyFilters"
        :disabled="loading || !!deleting"
        @layer-label="layerLabel = $event"
      />
      <EnvironmentalHistoryReport v-if="historyQuery" :query="historyQuery" @new="$emit('new')" />
      <template v-if="view === 'saved'">
        <v-list bg-color="transparent"
          ><v-list-item
            v-for="report in items"
            :key="report.id"
            :title="report.name"
            :subtitle="`${dateLabel(report.createdAt)} · ${report.completed}/${report.total} concluídas · ${report.failed} falhas`"
            @click="open(report.id)"
            ><template #append
              ><v-btn :loading="opening === report.id" @click.stop="open(report.id)">Abrir</v-btn
              ><v-btn
                v-if="canRemove"
                color="error"
                variant="text"
                :disabled="!!deleting || loading"
                :loading="deleting === report.id"
                @click.stop="askDelete(report)"
                >Excluir</v-btn
              ></template
            ></v-list-item
          ></v-list
        >
        <p v-if="error && items.length" class="note">
          Os resultados da última busca concluída foram mantidos.
        </p>
        <p v-if="loading" class="note" role="status">Buscando relatórios…</p>
        <div v-if="!loading && !error && !items.length" class="note">
          <p>Nenhuma execução encontrada. Para reunir cálculos antigos, use "Gerar relatório".</p>
          <v-btn variant="text" @click="$emit('calculations')">Ver cálculos individuais</v-btn>
          <v-btn variant="tonal" @click="$emit('new')">Novo cálculo</v-btn>
        </div>
      </template>
      <div v-if="view === 'saved' && !error" class="filters">
        <v-btn :disabled="!page || loading" @click="load(page - 1)">Anterior</v-btn
        ><span>{{ total }} execuções · página {{ page + 1 }}</span
        ><v-btn :disabled="(page + 1) * 20 >= total || loading" @click="load(page + 1)"
          >Próxima</v-btn
        >
      </div>
    </template>
    <template v-else>
      <v-btn prepend-icon="mdi-arrow-left" variant="text" @click="close">Voltar às execuções</v-btn>
      <h3>{{ detail.report.name }}</h3>
      <p class="note">
        {{ dateLabel(detail.report.createdAt) }} · {{ detail.report.indicator.toUpperCase() }}
      </p>
      <EnvironmentalBatchResults
        :areas="detail.areas"
        :entries="detail.entries"
        :indicator="detail.report.indicator"
        :parameters="detail.report.parameters"
        :busy="false"
        :stopping="false"
        @new="$emit('new')"
      />
    </template>
    <ConfirmDialog
      v-if="confirmDeletion"
      v-model="confirmDeletion"
      title="Excluir relatório?"
      :message="`Excluir ${pendingDeletion?.name ?? 'este relatório'} da listagem? Os cálculos individuais e os registros de auditoria serão preservados.`"
      @confirm="remove"
    />
    <v-alert v-if="error" type="error">{{ error }}</v-alert>
  </section>
</template>
<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref, watch, computed } from 'vue'
import { indicators } from '@/services/environmentalIndicators'
import { listReports, loadWholeReport, type SavedReport } from '@/services/environmentalReports'
import { apiError } from '@/services/contracts'
import { historySearchError } from '@/services/environmentalIndicators'
import ConfirmDialog from '@/components/ConfirmDialog.vue'
import { can, currentUserId } from '@/access/session'
import { deleteReport, reportDeletionAvailable } from '@/services/environmentalReports'
import EnvironmentalHistoryReport from './EnvironmentalHistoryReport.vue'
import EnvironmentalBatchResults from './EnvironmentalBatchResults.vue'
import EnvironmentalHistoryFilters from './EnvironmentalHistoryFilters.vue'
import { historyFilterError, type HistoryFilters } from '@/services/environmentalHistoryFilters'
const props = withDefaults(defineProps<{ active?: boolean; view?: 'history' | 'saved' }>(), {
  active: true,
  view: 'saved',
})
defineEmits<{ new: []; calculations: [] }>()
const deletionEnabled = ref(false),
  confirmDeletion = ref(false),
  deleting = ref<string | null>(null),
  pendingDeletion = ref<SavedReport | null>(null),
  notice = ref('')
const canRemove = computed(
  () => deletionEnabled.value && can('reports.delete') && !!currentUserId.value,
)
function askDelete(report: SavedReport) {
  if (!canRemove.value || deleting.value) return
  pendingDeletion.value = report
  confirmDeletion.value = true
}
async function remove() {
  const report = pendingDeletion.value,
    user = currentUserId.value
  if (!report || !user || !canRemove.value || deleting.value) return
  openEpoch++
  opening.value = null
  deleting.value = report.id
  error.value = ''
  notice.value = ''
  try {
    await deleteReport(report.id, user)
    items.value = items.value.filter((item) => item.id !== report.id)
    total.value = Math.max(0, total.value - 1)
    if (detail.value?.report.id === report.id) close()
    notice.value =
      'Relatório excluído. Os cálculos individuais foram preservados e a exclusão foi registrada na auditoria.'
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
const historyFilters = ref<HistoryFilters>({})
let appliedSearch = { search: '', indicator: '', filters: {} as HistoryFilters }
const layerLabel = ref('')
const historyQuery = ref<{
  search: string
  indicator: string
  revision: number
  filters: HistoryFilters
  layerLabel: string
} | null>(null)
let historyRevision = 0
const search = ref(''),
  indicator = ref<string | null>(''),
  filterMenu = ref(false),
  page = ref(0),
  total = ref(0),
  loading = ref(false),
  error = ref(''),
  opening = ref<string | null>(null)
watch(
  () => props.active,
  (active) => {
    if (!active) filterMenu.value = false
  },
)
const items = ref<SavedReport[]>([]),
  detail = ref<Awaited<ReturnType<typeof loadWholeReport>> | null>(null)
const filters = [
  { title: 'Todos os indicadores', value: '' },
  ...indicators.map((item) => ({ title: item.name, value: item.id })),
]
function filterChanged(value: string | null) {
  indicator.value = value
  filterMenu.value = false
}
let listRequest: AbortController | undefined
let epoch = 0,
  openEpoch = 0
const dateLabel = (date: string) => new Date(date).toLocaleString('pt-BR')
async function load(next: number, includeHistory = true) {
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
  if (props.view === 'history' && next === 0 && includeHistory) {
    historyQuery.value = {
      search: search.value,
      indicator: indicator.value ?? '',
      revision: ++historyRevision,
      filters: { ...historyFilters.value },
      layerLabel: layerLabel.value,
    }
    return
  }
  const request = ++epoch
  listRequest?.abort()
  listRequest = new AbortController()
  filterMenu.value = false
  loading.value = true
  error.value = ''
  try {
    const data = await listReports(
      query.search,
      query.indicator,
      next,
      listRequest.signal,
      query.filters,
    )
    if (request === epoch) {
      items.value = data.items
      total.value = data.total
      page.value = next
      appliedSearch = query
    }
  } catch (e) {
    if (request === epoch) {
      error.value = historySearchError(e)
    }
  } finally {
    if (request === epoch) loading.value = false
  }
}
async function open(id: string) {
  const request = ++openEpoch
  opening.value = id
  error.value = ''
  try {
    const data = await loadWholeReport(id)
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
}
onMounted(() => {
  if (props.view === 'history') return
  void load(0, false)
  void reportDeletionAvailable()
    .then((enabled) => {
      deletionEnabled.value = enabled
    })
    .catch(() => {
      deletionEnabled.value = false
    })
})
onBeforeUnmount(() => {
  listRequest?.abort()
  epoch++
  openEpoch++
})
</script>
<style scoped>
.filters {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
  margin: 20px 0;
}
.filters > .v-input {
  flex: 1;
  min-width: 180px;
}
.note {
  font-size: 12px;
  line-height: 1.7;
  margin: 12px 0;
  color: rgba(var(--v-theme-on-surface), 0.65);
}
</style>
