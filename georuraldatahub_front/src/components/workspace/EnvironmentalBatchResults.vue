<template>
  <section class="batch-results" aria-live="polite">
    <div class="batch-heading">
      <div>
        <h3>Relatório por área</h3>
        <p v-if="busy && !areas.length" class="note">Carregando as áreas da camada.</p>
        <p v-else class="note">
          {{ entries.length }} de {{ areas.length }} áreas processadas · {{ successes }} com
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
      Interrompido: {{ areas.length - entries.length }} áreas não foram processadas. Os cálculos
      concluídos permanecem disponíveis.
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
    <div class="batch-list">
      <article v-for="entry in visibleEntries" :key="entry.area.id" class="area-row">
        <div>
          <strong>{{ entry.area.name }}</strong>
          <p>
            {{
              entry.snapshot
                ? entry.snapshot.result.calculoId
                  ? `Salvo no histórico #${entry.snapshot.result.calculoId}`
                  : 'Prévia não salva'
                : entry.error
            }}
          </p>
        </div>
        <v-btn v-if="entry.snapshot" variant="text" @click="opened = entry">Ver resultado</v-btn
        ><span v-else class="failed">{{ entry.unconfirmed ? 'Sem confirmação' : 'Falhou' }}</span>
      </article>
    </div>
    <div v-if="entries.length > 20" class="batch-pages">
      <v-btn variant="text" :disabled="page === 0" @click="page--">Anterior</v-btn
      ><span>Página {{ page + 1 }}</span
      ><v-btn variant="text" :disabled="(page + 1) * 20 >= entries.length" @click="page++"
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
          <EnvironmentalResultActions :snapshot="opened.snapshot" /> </v-card-text
        ><v-card-actions><v-btn @click="opened = null">Fechar</v-btn></v-card-actions></v-card
      ></v-dialog
    >
  </section>
</template>
<script setup lang="ts">
import { computed, ref } from 'vue'
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
import EnvironmentalResultActions from './EnvironmentalResultActions.vue'
const props = defineProps<{
  areas: AnalysisArea[]
  entries: AreaCalculation[]
  indicator: string
  parameters: Record<string, unknown>
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
const successes = computed(() => props.entries.filter((e) => e.snapshot).length)
const failures = computed(() => props.entries.filter((e) => e.error).length)
const visibleEntries = computed(() => props.entries.slice(page.value * 20, (page.value + 1) * 20))
const rows = computed(() =>
  props.busy ? [] : batchReportRows(props.areas, props.entries, props.indicator, props.parameters),
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
.batch-list {
  border: 1px solid rgba(var(--v-theme-on-surface), 0.12);
  border-radius: 12px;
  overflow: hidden;
}
.area-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 12px;
  padding: 16px;
  border-bottom: 1px solid rgba(var(--v-theme-on-surface), 0.1);
}
.area-row:last-child {
  border-bottom: 0;
}
.area-row > div {
  flex: 1;
  min-width: 0;
  overflow-wrap: anywhere;
}
.failed {
  color: rgb(var(--v-theme-error));
  font-size: 12px;
}
.detail-metrics {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 12px;
  margin-bottom: 24px;
}
</style>
