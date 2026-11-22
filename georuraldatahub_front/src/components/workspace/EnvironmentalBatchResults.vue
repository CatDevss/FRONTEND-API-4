<template>
  <section class="batch-results" aria-live="polite">
    <div class="batch-heading">
      <div>
        <h3>{{ historical ? 'Resultados do histórico' : 'Relatório por área' }}</h3>
        <p v-if="busy && !areas.length" class="note">Carregando as áreas da camada.</p>
        <p v-else class="note">
          {{ entries.length }} de {{ areas.length }}
          {{ historical ? 'cálculos carregados' : 'áreas processadas' }} · {{ successes }} com
          resultado · {{ failures }} sem resultado
        </p>
      </div>
      <v-btn v-if="busy" variant="tonal" :disabled="stopping" @click="$emit('stop')">{{
        stopping ? 'Interrompendo' : 'Interromper após esta área'
      }}</v-btn>
      <v-btn v-else color="primary" variant="tonal" @click="$emit('new')">Novo cálculo</v-btn>
    </div>
    <v-progress-linear
      v-if="busy"
      :model-value="areas.length ? (entries.length / areas.length) * 100 : 0"
      :indeterminate="!areas.length"
      color="primary"
    />
    <p v-if="busy && areas.length" class="note">
      Calculando: {{ areas[entries.length]?.name ?? 'Finalizando' }}
    </p>
    <p v-if="!busy && entries.length < areas.length" class="note">
      Não concluído: {{ areas.length - entries.length }} áreas ainda não têm resultado confirmado.
      Os cálculos concluídos permanecem disponíveis.
    </p>
    <p v-if="withoutData" class="note">
      {{ withoutData }} cálculo(s) retornaram sem dados. Eles não representam zero ocorrências.
    </p>
    <p class="note">
      Cada área tem seu próprio resultado. Os cálculos salvos ficam no histórico. Áreas sobrepostas
      e percentuais não são somados.
    </p>
    <div class="batch-exports">
      <v-btn variant="tonal" :disabled="busy || !entries.length" @click="csv"
        >CSV de todas as áreas</v-btn
      >
      <v-btn
        variant="tonal"
        :disabled="busy || !entries.length || rows.length > 5000"
        :loading="exporting"
        @click="excel"
        >Excel</v-btn
      >
      <v-btn variant="tonal" :disabled="busy || !entries.length" @click="pdf">PDF / imprimir</v-btn>
    </div>
    <p v-if="rows.length > 5000" class="note">
      Para mais de 5.000 linhas, exporte o relatório completo em CSV.
    </p>
    <v-alert v-if="error" type="error">{{ error }}</v-alert>
    <div class="comparison-sort">
      <v-select
        v-model="sortKey"
        :items="[
          { title: 'Área', value: 'name' },
          ...columns.map((column) => ({ title: column.label, value: column.key })),
        ]"
        label="Ordenar por"
        variant="outlined"
        hide-details
        density="compact"
      />
      <v-btn variant="text" @click="descending = !descending">{{
        descending ? 'Decrescente' : 'Crescente'
      }}</v-btn>
    </div>
    <p v-if="parameters.fim" class="note">
      {{
        parameters.inicio
          ? `Período: ${parameters.inicio} a ${parameters.fim}`
          : `Até ${parameters.fim}`
      }}
    </p>
    <p class="note">Valores ausentes ficam ao final da ordenação.</p>
    <p v-if="historical" class="note">
      Uma área pode aparecer em cálculos diferentes. Confira o período e as fontes de cada registro
      antes de comparar.
    </p>
    <div class="comparison-table">
      <table>
        <thead>
          <tr>
            <th>Área</th>
            <th v-if="historical">Cálculo</th>
            <th v-if="historical">Período</th>
            <th v-if="historical">Data do cálculo</th>
            <th v-for="column in columns" :key="column.key">
              {{ column.label }}<small>{{ column.unit }}</small>
            </th>
            <th>Disponibilidade</th>
            <th>Geometrias</th>
            <th>Resultado</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="entry in visibleEntries" :key="entry.area.id">
            <th scope="row">{{ entry.area.name }}</th>
            <td v-if="historical">#{{ entry.snapshot?.result.calculoId ?? entry.area.id }}</td>
            <td v-if="historical">{{ periodLabel(entry.snapshot?.parameters) }}</td>
            <td v-if="historical">{{ entry.snapshot?.result.calculadoEm ?? 'Não disponível' }}</td>
            <td v-for="column in columns" :key="column.key">
              {{ formatValue(comparisonValue(entry.snapshot, column.key)) }}
            </td>
            <td>
              {{
                entry.snapshot
                  ? resultAvailability(entry.snapshot.result)
                  : (entry.error ?? 'Não processada')
              }}
            </td>
            <td>
              {{
                entry.snapshot
                  ? resultRepairs(entry.snapshot.result).length
                    ? `${resultRepairs(entry.snapshot.result).length} registro(s) de reparo`
                    : Array.isArray(entry.snapshot.result.reparos)
                      ? 'Sem reparo registrado'
                      : 'Não informado'
                  : 'Não disponível'
              }}
            </td>
            <td>
              <v-btn v-if="entry.snapshot" variant="text" @click="opened = entry"
                >Ver resultado</v-btn
              ><span v-else>{{
                entry.unconfirmed ? 'Sem confirmação' : entry.error ? 'Falhou' : 'Pendente'
              }}</span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    <div v-if="areas.length > 20" class="batch-pages">
      <v-btn variant="text" :disabled="page === 0" @click="page--">Anterior</v-btn
      ><span>Página {{ page + 1 }}</span
      ><v-btn variant="text" :disabled="(page + 1) * 20 >= areas.length" @click="page++"
        >Próxima</v-btn
      >
    </div>
    <v-dialog v-model="showDetail" max-width="900" scrollable
      ><v-card v-if="opened?.snapshot" class="environmental-surface" :title="opened.area.name"
        ><v-card-text>
          <dl class="detail-metrics">
            <template v-for="(row, index) in detailRows" :key="index"
              ><dt>{{ row[0] }} · {{ row[1] }}</dt>
              <dd>{{ row[2] }} {{ row[3] }}</dd></template
            >
          </dl>
          <p class="note">
            {{
              opened.snapshot.result.calculoId
                ? `Salvo no histórico #${opened.snapshot.result.calculoId}`
                : 'Prévia não salva'
            }}
          </p>
          <EnvironmentalQuality :result="opened.snapshot.result" :area-name="opened.area.name" />
          <EnvironmentalResultActions :snapshot="opened.snapshot" /> </v-card-text
        ><v-card-actions><v-btn @click="opened = null">Fechar</v-btn></v-card-actions></v-card
      ></v-dialog
    >
  </section>
</template>
<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import {
  batchReportRows,
  reportRows,
  reportCsv,
  download,
  exportExcel,
  printReport,
  metricGroups,
} from '@/services/environmentalReport'
import type { AnalysisArea, AreaCalculation } from '@/services/environmentalBatch'
import {
  comparisonColumns,
  comparisonValue,
  sortedComparison,
  resultAvailability,
  resultRepairs,
} from '@/services/environmentalQuality'
import { formatValue } from '@/services/environmentalIndicators'
import EnvironmentalQuality from './EnvironmentalQuality.vue'
import EnvironmentalResultActions from './EnvironmentalResultActions.vue'
function periodLabel(parameters?: Record<string, unknown>) {
  if (!parameters?.fim) return 'Não informado'
  return parameters.inicio ? `${parameters.inicio} a ${parameters.fim}` : `Até ${parameters.fim}`
}
const props = defineProps<{
  historical?: boolean
  areas: AnalysisArea[]
  entries: AreaCalculation[]
  indicator: string
  parameters: Record<string, unknown>
  reportContext?: Record<string, unknown>
  busy: boolean
  stopping: boolean
}>()
defineEmits<{ stop: []; new: [] }>()
const page = ref(0),
  exporting = ref(false),
  error = ref(''),
  opened = ref<AreaCalculation | null>(null)
const showDetail = computed({
  get: () => !!opened.value,
  set: (value: boolean) => {
    if (!value) opened.value = null
  },
})
const withoutData = computed(
  () =>
    props.entries.filter(
      (entry) => entry.snapshot && resultAvailability(entry.snapshot.result) === 'Sem dados',
    ).length,
)
const successes = computed(() => props.entries.filter((e) => e.snapshot).length)
const failures = computed(() => props.entries.filter((e) => e.error).length)
const sortKey = ref('name'),
  descending = ref(false)
const columns = computed(() => comparisonColumns(props.entries))
watch([sortKey, descending], () => {
  page.value = 0
})
watch(
  () => props.entries,
  () => {
    page.value = 0
    opened.value = null
  },
)
const visibleEntries = computed(() =>
  sortedComparison(props.areas, props.entries, sortKey.value, descending.value).slice(
    page.value * 20,
    (page.value + 1) * 20,
  ),
)
const rows = computed(() =>
  props.busy
    ? []
    : batchReportRows(
        props.areas,
        props.entries,
        props.indicator,
        props.parameters,
        props.reportContext,
      ),
)
const detailRows = computed(() =>
  opened.value?.snapshot
    ? reportRows(opened.value.snapshot).filter(
        (r) => metricGroups.includes(r[0]) || (r[0] === 'Análise' && r[1] === 'Área analisada'),
      )
    : [],
)
function csv() {
  download(
    new Blob([reportCsv(rows.value)], { type: 'text/csv;charset=utf-8' }),
    'indicadores-por-area.csv',
  )
}
async function excel() {
  exporting.value = true
  error.value = ''
  try {
    await exportExcel(rows.value)
  } catch {
    error.value = 'Não foi possível exportar a planilha. Tente novamente ou use CSV.'
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
</script>
<style scoped>
.comparison-sort {
  display: flex;
  align-items: center;
  gap: 12px;
  margin: 20px 0;
}
.comparison-sort > .v-input {
  max-width: 360px;
}
.comparison-table {
  overflow-x: auto;
  border: 1px solid rgba(var(--v-theme-on-surface), 0.12);
  border-radius: 12px;
}
table {
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;
}
th,
td {
  text-align: left;
  padding: 14px;
  border-bottom: 1px solid rgba(var(--v-theme-on-surface), 0.1);
  min-width: 120px;
}
th small {
  display: block;
  font-weight: 400;
  margin-top: 4px;
}

.batch-heading,
.batch-exports,
.batch-pages {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 12px;
  margin: 20px 0;
}
h3 {
  font-size: 22px;
}
.note,
.area-row p {
  font-size: 12px;
  line-height: 1.7;
  color: rgba(var(--v-theme-on-surface), 0.65);
}
.batch-exports {
  justify-content: flex-start;
}
.detail-metrics {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 12px;
  margin-bottom: 24px;
}
</style>
