<template>
  <section
    ref="panelElement"
    class="indicators-panel environmental-surface"
    aria-label="Indicadores ambientais"
  >
    <header>
      <h2>Indicadores ambientais</h2>
      <p>Calcule um indicador para uma área, consulte o mapa e exporte o relatório.</p>
      <v-btn
        variant="text"
        size="small"
        prepend-icon="mdi-layers-outline"
        @click="$emit('manageLayers')"
        >Gerenciar camadas</v-btn
      >
    </header>
    <div class="view-switch">
      <v-btn
        :variant="view === 'calculate' ? 'tonal' : 'text'"
        :disabled="busy"
        @click="view = 'calculate'"
        >Cálculo</v-btn
      ><v-btn
        prepend-icon="mdi-history"
        :variant="view === 'history' ? 'tonal' : 'text'"
        :disabled="busy"
        @click="view = 'history'"
        >Histórico</v-btn
      >
    </div>
    <EnvironmentalHistory v-if="view === 'history'" />
    <div v-show="view === 'calculate'">
      <nav class="steps" aria-label="Etapas da análise">
        <v-btn :variant="step === 1 ? 'tonal' : 'text'" :disabled="busy" @click="step = 1"
          >1 · Indicador e área</v-btn
        >
        <v-btn
          :variant="step === 2 ? 'tonal' : 'text'"
          :disabled="!areaReady || busy"
          @click="step = 2"
          >2 · Dados</v-btn
        >
        <v-btn
          :variant="step === 3 ? 'tonal' : 'text'"
          :disabled="(!result && !batchUsed) || busy"
          @click="step = 3"
          >3 · Resultado</v-btn
        >
      </nav>
      <div v-show="step === 1" class="form-step form-card">
        <h3>O que você quer analisar?</h3>
        <p class="note">Escolha o indicador e as áreas que entrarão no relatório.</p>
        <v-select
          variant="outlined"
          :menu-props="{ contentClass: 'environmental-menu' }"
          v-model="indicator"
          :items="indicators"
          item-title="name"
          item-value="id"
          label="Indicador"
          :disabled="busy"
        />
        <EnvironmentalLayerPicker
          v-model="areaLayer"
          label="Camada da área de análise"
          polygon
          :disabled="busy"
          @layers="remember"
        />
        <p v-if="!areaLayer" class="note">
          Exemplo: escolha uma camada de municípios e depois busque o município. Se a camada ainda
          não existe, use “Gerenciar camadas”.
        </p>
        <template v-if="areaLayer">
          <v-select
            :menu-props="{ contentClass: 'environmental-menu' }"
            v-model="selectionMode"
            :items="areaModes"
            label="Áreas do relatório"
            :disabled="busy"
            variant="outlined"
          />
          <p v-if="selectionMode === 'all'" class="note">
            Todas as {{ areaTotal }} áreas poligonais desta camada serão analisadas,
            independentemente da busca. Cada uma terá seu próprio resultado.
          </p>
          <v-autocomplete
            variant="outlined"
            :menu-props="{ contentClass: 'environmental-menu' }"
            v-if="selectionMode !== 'all'"
            :model-value="selectionMode === 'multiple' ? featureIds : featureId"
            :multiple="selectionMode === 'multiple'"
            :chips="selectionMode === 'multiple'"
            :closable-chips="selectionMode === 'multiple'"
            @update:model-value="selectAreas"
            :items="featureOptions"
            item-title="name"
            item-value="id"
            label="Buscar área pelo nome"
            no-filter
            clearable
            :loading="searching"
            :disabled="busy"
            no-data-text="Nenhuma área encontrada"
            @update:search="featureSearchChanged"
          >
            <template #append-item
              ><div class="pages" @mousedown.prevent>
                <v-btn
                  variant="text"
                  size="small"
                  :disabled="featurePage === 0 || searching"
                  @click.stop="searchFeatures(featurePage - 1)"
                  >Anterior</v-btn
                ><span>{{ featureTotal }} áreas</span
                ><v-btn
                  variant="text"
                  size="small"
                  :disabled="(featurePage + 1) * 20 >= featureTotal || searching"
                  @click.stop="searchFeatures(featurePage + 1)"
                  >Próxima</v-btn
                >
              </div></template
            >
          </v-autocomplete>
        </template>
        <v-alert v-if="error" type="error" class="mb-4">{{ error }}</v-alert>
        <v-btn color="primary" :disabled="!areaReady || searching" @click="step = 2"
          >Continuar</v-btn
        >
      </div>
      <div v-show="step === 2" class="form-step form-card">
        <h3>Quais dados entram no cálculo?</h3>
        <p class="note">
          <strong>{{ selected.name }}</strong> ·
          {{ selectionSummary }}
        </p>
        <p class="note">
          Selecione camadas cujo conteúdo corresponda a cada papel. O nome do arquivo não determina
          seu uso.
        </p>
        <EnvironmentalLayerPicker
          v-for="role in selected.roles"
          :key="role"
          :model-value="inputs[role] ?? []"
          :label="roleNames[role] ?? role"
          multiple
          :disabled="busy"
          @update:model-value="inputs[role] = Array.isArray($event) ? $event : []"
          @layers="remember"
        />
        <template v-if="indicator === 'irl'"
          ><v-text-field
            variant="outlined"
            v-model.number="minimum"
            type="number"
            min="0"
            max="100"
            label="Percentual mínimo de reserva legal (%)"
            :disabled="busy" /><v-textarea
            variant="outlined"
            v-model="reason"
            label="Fundamento do percentual adotado"
            rows="2"
            :disabled="busy"
        /></template>
        <template v-if="indicator === 'ifc'">
          <v-select
            :menu-props="{ contentClass: 'environmental-menu' }"
            v-model="ifcPeriod"
            :items="[
              { title: 'Um dia', value: 'day' },
              { title: 'Período', value: 'range' },
            ]"
            label="Intervalo dos focos de calor"
            :disabled="busy"
            variant="outlined"
          />
          <v-text-field
            v-if="ifcPeriod === 'day'"
            v-model="day"
            type="date"
            label="Data do boletim"
            :disabled="busy"
            variant="outlined"
          />
          <template v-else
            ><v-text-field
              v-model="start"
              type="date"
              label="Data inicial"
              :disabled="busy"
              variant="outlined" /><v-text-field
              v-model="end"
              type="date"
              label="Data final (inclusiva)"
              :disabled="busy"
              variant="outlined"
          /></template>
          <p class="note">
            Use um dia para um boletim diário. Escolha um período ao analisar camadas de vários
            dias. A data deve corresponder ao conteúdo selecionado.
          </p>
        </template>
        <v-text-field
          v-if="indicator === 'idesmat'"
          v-model="end"
          type="date"
          label="Data final (inclusiva)"
          :disabled="busy"
          variant="outlined"
        />
        <v-alert v-if="error" type="error" class="mb-4">{{ error }}</v-alert>
        <div class="calculation-summary">
          <strong>Confira antes de calcular</strong>
          <dl>
            <dt>Indicador</dt>
            <dd>{{ selected.name }}</dd>
            <dt>Área</dt>
            <dd>{{ selectionSummary }}</dd>
            <template v-for="role in selected.roles" :key="role"
              ><dt>{{ roleNames[role] ?? role }}</dt>
              <dd>{{ inputNames(role) }}</dd></template
            >
            <template v-if="indicator === 'ifc' && ifcPeriod === 'day'"
              ><dt>Dia</dt>
              <dd>{{ day || 'Informe a data' }}</dd></template
            >
            <template v-if="indicator === 'ifc' && ifcPeriod === 'range'"
              ><dt>Período</dt>
              <dd>{{ start || 'Informe o início' }} a {{ end || 'informe o fim' }}</dd></template
            >
            <template v-if="indicator === 'idesmat'"
              ><dt>Fim</dt>
              <dd>{{ end || 'Informe a data' }}</dd></template
            >
          </dl>
        </div>
        <p v-if="selectionMode !== 'single'" class="note">
          Serão feitos {{ selectedCount }} cálculos independentes. Ao salvar, cada resultado ficará
          no histórico. Se houver falha, as outras áreas continuarão e o relatório identificará o
          problema.
        </p>
        <div class="calculation-actions">
          <v-btn variant="text" :disabled="busy" prepend-icon="mdi-arrow-left" @click="step = 1"
            >Voltar à área</v-btn
          >
          <v-btn color="primary" :loading="busy" :disabled="!valid || searching" @click="run(true)"
            >Calcular e salvar</v-btn
          >
        </div>
        <p class="note mt-3">
          O cálculo salvo poderá ser reaberto no Histórico. No resultado, escolha CSV, Excel ou PDF
          / imprimir.
        </p>
        <details class="advanced preview-options">
          <summary>Calcular sem registrar no histórico</summary>
          <p class="note">
            Use uma prévia apenas para conferir os dados. Ela também permite exportar, mas não fica
            no histórico.
          </p>
          <v-btn variant="tonal" :disabled="!valid || searching || busy" @click="run(false)"
            >Prévia sem salvar</v-btn
          >
        </details>
      </div>
      <EnvironmentalBatchResults
        v-if="batchUsed"
        v-show="step === 3"
        :areas="batchAreas"
        :entries="batchEntries"
        :indicator="indicator"
        :parameters="batchParameters"
        :busy="busy"
        :stopping="stopping"
        @stop="stopping = true"
        @new="newCalculation"
      />
      <section v-if="result" v-show="step === 3" class="results" aria-live="polite">
        <div class="result-navigation">
          <v-btn variant="text" prepend-icon="mdi-arrow-left" @click="step = 2"
            >Voltar aos dados</v-btn
          ><v-btn color="primary" variant="tonal" prepend-icon="mdi-plus" @click="newCalculation"
            >Novo cálculo</v-btn
          >
        </div>
        <div class="result-heading">
          <div>
            <span class="result-eyebrow">{{ selected.name }}</span>
            <h3>{{ featureName }}</h3>
          </div>
          <span class="history-status" :class="{ 'is-saved': result.calculoId }">{{
            result.calculoId ? `Salvo no histórico · #${result.calculoId}` : 'Prévia · não salva'
          }}</span>
        </div>
        <p>Área analisada: {{ formatValue(result.areaImovelHa) }} ha</p>
        <div v-for="group in resultGroups" :key="group.name" class="metric-card">
          <h4>{{ group.name }}</h4>
          <dl>
            <template v-for="metric in group.metrics" :key="metric.key"
              ><dt>{{ metric.label }}</dt>
              <dd>
                <span>{{ formatValue(metric.value) }}</span
                ><span v-if="typeof metric.value === 'number'" class="metric-unit">{{
                  metric.unit
                }}</span>
              </dd></template
            >
          </dl>
        </div>
        <p class="note">Calculado em {{ calculatedAt }} · {{ result.projecaoCalculo }}</p>
        <EnvironmentalResultActions v-if="snapshot" :snapshot="snapshot" />
        <details>
          <summary>Fontes utilizadas e rastreabilidade</summary>
          <ul>
            <li v-for="(source, index) in sources" :key="index">{{ source }}</li>
          </ul>
          <p class="note">Regra: {{ result.regra ?? 'Não disponível' }}</p>
        </details>
      </section>
    </div>
  </section>
</template>
<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, reactive, ref, watch } from 'vue'
import EnvironmentalHistory from './EnvironmentalHistory.vue'
import EnvironmentalBatchResults from './EnvironmentalBatchResults.vue'
import {
  allAnalysisAreas,
  calculateAreas,
  type AnalysisArea,
  type AreaCalculation,
} from '@/services/environmentalBatch'
import EnvironmentalResultActions from './EnvironmentalResultActions.vue'
import type { CalculationSnapshot } from '@/services/environmentalReport'
import EnvironmentalLayerPicker from './EnvironmentalLayerPicker.vue'
import {
  calculate,
  calculateAndSave,
  formatValue,
  indicators,
  listFeatures,
  roleNames,
  type Feature,
  type Layer,
} from '@/services/environmentalIndicators'
import { apiError } from '@/services/contracts'
defineEmits<{ manageLayers: [] }>()
const view = ref('calculate')
const panelElement = ref<HTMLElement | null>(null)
const step = ref(1),
  snapshot = ref<CalculationSnapshot | null>(null)
watch([step, view], async () => {
  await nextTick()
  const viewport = panelElement.value?.closest('.workspace-content')
  if (viewport) viewport.scrollTop = 0
})
const indicator = ref('icv'),
  areaLayer = ref<number | null>(null),
  featureId = ref<number | null>(null)
const selectionMode = ref<'single' | 'multiple' | 'all'>('single')
const featureIds = ref<number[]>([]),
  areaTotal = ref(0)
const ifcPeriod = ref('day'),
  day = ref('')
const areaModes = [
  { title: 'Uma área', value: 'single' },
  { title: 'Selecionar várias áreas', value: 'multiple' },
  { title: 'Todas as áreas da camada', value: 'all' },
]
const batchUsed = ref(false),
  stopping = ref(false)
const batchAreas = ref<AnalysisArea[]>([]),
  batchEntries = ref<AreaCalculation[]>([])
const batchParameters = ref<Record<string, unknown>>({})
const inputs = ref<Record<string, number[]>>({}),
  query = ref('')
const features = ref<Feature[]>([]),
  featurePage = ref(0),
  featureTotal = ref(0),
  searching = ref(false),
  busy = ref(false),
  error = ref('')
const minimum = ref<number | string>(''),
  reason = ref(''),
  start = ref(''),
  end = ref(''),
  result = ref<Record<string, unknown> | null>(null),
  featureName = ref('')
const featureCache = new Map<number, Feature>()
const featureOptions = computed(() => {
  const rows = new Map(features.value.map((f) => [f.id, f]))
  for (const id of [featureId.value, ...featureIds.value]) {
    const area = id ? featureCache.get(id) : null
    if (area) rows.set(area.id, area)
  }
  return [...rows.values()]
})
const selectedCount = computed(() =>
  selectionMode.value === 'all'
    ? areaTotal.value
    : selectionMode.value === 'multiple'
      ? featureIds.value.length
      : featureId.value
        ? 1
        : 0,
)
const areaReady = computed(() => !!areaLayer.value && selectedCount.value > 0)
const selectionSummary = computed(() =>
  selectionMode.value === 'all'
    ? `Todas as ${areaTotal.value} áreas da camada`
    : selectionMode.value === 'multiple'
      ? `${featureIds.value.length} áreas selecionadas`
      : (featureCache.get(featureId.value ?? 0)?.name ?? 'Selecione uma área'),
)
function selectAreas(value: number | number[] | null) {
  if (selectionMode.value === 'multiple') featureIds.value = Array.isArray(value) ? value : []
  else featureId.value = typeof value === 'number' ? value : null
}
let searchTimer: ReturnType<typeof setTimeout> | undefined
function featureSearchChanged(value: string) {
  if (busy.value || featureOptions.value.some((f) => f.name === value)) return
  clearTimeout(searchTimer)
  query.value = value || ''
  searchTimer = setTimeout(() => void searchFeatures(0), 300)
}
function newCalculation() {
  if (busy.value) return
  clearTimeout(searchTimer)
  epoch++
  featureCache.clear()
  areaLayer.value = null
  featureId.value = null
  features.value = []
  featureTotal.value = 0
  featurePage.value = 0
  query.value = ''
  featureIds.value = []
  areaTotal.value = 0
  selectionMode.value = 'single'
  ifcPeriod.value = 'day'
  day.value = ''
  batchUsed.value = false
  batchAreas.value = []
  batchEntries.value = []
  stopping.value = false
  inputs.value = {}
  minimum.value = ''
  reason.value = ''
  start.value = ''
  end.value = ''
  result.value = null
  snapshot.value = null
  featureName.value = ''
  error.value = ''
  searching.value = false
  step.value = 1
}
const layers = reactive(new Map<number, Layer>())
function remember(items: Layer[]) {
  for (const item of items) layers.set(item.id, item)
}
function inputNames(role: string) {
  const ids = inputs.value[role] ?? []
  return ids.length
    ? ids.map((id) => layers.get(id)?.name ?? 'Camada selecionada').join(', ')
    : 'Selecione ao menos uma camada'
}
const selected = computed(() => indicators.find((i) => i.id === indicator.value) ?? indicators[0])
const iso = (value: string) =>
  /^\d{4}-\d{2}-\d{2}$/.test(value) &&
  !Number.isNaN(Date.parse(value)) &&
  new Date(value).toISOString().slice(0, 10) === value
const valid = computed(
  () =>
    areaReady.value &&
    selected.value.roles.every((r) => (inputs.value[r]?.length ?? 0) > 0) &&
    (indicator.value !== 'irl' ||
      (minimum.value !== '' &&
        Number(minimum.value) >= 0 &&
        Number(minimum.value) <= 100 &&
        !!reason.value.trim())) &&
    (indicator.value !== 'idesmat' || iso(end.value)) &&
    (indicator.value !== 'ifc' ||
      (ifcPeriod.value === 'day'
        ? iso(day.value)
        : iso(start.value) && iso(end.value) && start.value <= end.value)),
)
let epoch = 0
async function searchFeatures(page: number) {
  if (!areaLayer.value) return
  const request = ++epoch
  searching.value = true
  error.value = ''
  try {
    const data = await listFeatures(areaLayer.value, query.value, '', page)
    if (request !== epoch) return
    features.value = data.items
    for (const f of data.items) featureCache.set(f.id, f)
    featurePage.value = page
    featureTotal.value = data.total
    if (!query.value) areaTotal.value = data.total
  } catch (e) {
    if (request === epoch) {
      features.value = []
      featureTotal.value = 0
      error.value = apiError(e)
    }
  } finally {
    if (request === epoch) searching.value = false
  }
}
watch(areaLayer, () => {
  epoch++
  clearTimeout(searchTimer)
  featureCache.clear()
  searching.value = false
  featureId.value = null
  features.value = []
  featureIds.value = []
  areaTotal.value = 0
  query.value = ''
  result.value = null
  void searchFeatures(0)
})
watch(selectionMode, (mode) => {
  if (mode === 'all') {
    clearTimeout(searchTimer)
    query.value = ''
    void searchFeatures(0)
  }
})
watch(
  [
    indicator,
    featureId,
    featureIds,
    selectionMode,
    inputs,
    minimum,
    reason,
    start,
    end,
    ifcPeriod,
    day,
  ],
  () => {
    result.value = null
    snapshot.value = null
    batchUsed.value = false
    batchEntries.value = []
    if (step.value === 3) step.value = 2
    error.value = ''
  },
  { deep: true },
)
onBeforeUnmount(() => {
  stopping.value = true
  epoch++
  clearTimeout(searchTimer)
})
async function run(save = false) {
  if (!valid.value || busy.value) return
  busy.value = true
  error.value = ''
  result.value = null
  const params: Record<string, unknown> = {}
  for (const role of selected.value.roles) params[role] = inputs.value[role]
  if (indicator.value === 'irl') {
    params.rlMinimoPercentual = Number(minimum.value)
    params.fundamentoRl = reason.value.trim()
  }
  if (indicator.value === 'idesmat') params.fim = end.value
  if (indicator.value === 'ifc') {
    params.inicio = ifcPeriod.value === 'day' ? day.value : start.value
    params.fim = ifcPeriod.value === 'day' ? day.value : end.value
  }
  featureName.value = featureCache.get(featureId.value ?? 0)?.name ?? 'Área selecionada'
  try {
    if (selectionMode.value !== 'single') {
      batchUsed.value = true
      batchAreas.value = []
      batchEntries.value = []
      batchParameters.value = JSON.parse(JSON.stringify(params))
      stopping.value = false
      step.value = 3
      batchAreas.value =
        selectionMode.value === 'all'
          ? await allAnalysisAreas(areaLayer.value!, () => stopping.value)
          : featureIds.value.map((id) => ({
              id,
              name: featureCache.get(id)?.name ?? 'Área selecionada',
            }))
      if (!batchAreas.value.length && !stopping.value)
        throw new Error('Nenhuma área disponível para calcular.')
      if (stopping.value && !batchAreas.value.length) {
        batchUsed.value = false
        step.value = 2
        error.value = 'Processamento interrompido antes do primeiro cálculo.'
        return
      }
      await calculateAreas(
        batchAreas.value,
        indicator.value,
        batchParameters.value,
        save,
        () => stopping.value,
        (entry) => batchEntries.value.push(entry),
      )
      return
    }
    const data = await (save ? calculateAndSave : calculate)(
      featureId.value!,
      indicator.value,
      params,
    )
    result.value = data
    snapshot.value = JSON.parse(
      JSON.stringify({
        name: featureName.value,
        indicator: indicator.value,
        featureId: featureId.value,
        parameters: params,
        result: data,
      }),
    )
    step.value = 3
  } catch (e) {
    batchUsed.value = false
    step.value = 2
    error.value = apiError(
      e,
      e instanceof Error
        ? e.message
        : 'Não foi possível calcular. Confira as camadas e a disponibilidade do serviço ambiental.',
    )
  } finally {
    busy.value = false
  }
}
const labels: Record<string, [string, string]> = {
  areaHa: ['Área', 'ha'],
  percentual: ['Percentual', '%'],
  minimoPercentual: ['Mínimo adotado', '%'],
  deficitHa: ['Déficit', 'ha'],
  excedenteHa: ['Excedente', 'ha'],
  appTotalHa: ['APP total', 'ha'],
  passivoHa: ['Passivo', 'ha'],
  quantidade: ['Focos únicos', 'focos'],
  porMilHa: ['Densidade', 'focos / 1.000 ha'],
}
const resultGroups = computed(() =>
  Object.entries(result.value ?? {})
    .filter(([k]) =>
      [
        'ICV',
        'IRL',
        'IAPP',
        'ISAP',
        'IAE',
        'IFC',
        'IDesmat2008',
        'IDesmat2019',
        'IDesmat2020',
      ].includes(k),
    )
    .map(([name, value]) => ({
      name,
      metrics: Object.entries((value ?? {}) as Record<string, unknown>)
        .filter(([k]) => labels[k])
        .map(([key, value]) => ({ key, value, label: labels[key]![0], unit: labels[key]![1] })),
    })),
)
const calculatedAt = computed(() =>
  typeof result.value?.calculadoEm === 'string'
    ? new Date(result.value.calculadoEm).toLocaleString('pt-BR')
    : 'Não disponível',
)
const sources = computed(() => {
  const trace = Array.isArray(result.value?.fontes)
    ? (result.value.fontes as Record<string, unknown>[])
    : []
  return [
    ...new Set(
      trace.map((s) => {
        const layer = layers.get(Number(s.camadaId))
        return s.nome
          ? [
              ...new Set(
                [s.fonte, s.arquivo, s.nome].filter((v) => typeof v === 'string' && v.trim()),
              ),
            ].join(' · ') + ` · versão ${s.versaoId}`
          : layer
            ? [...new Set([layer.source, layer.file, layer.name])].join(' · ') +
              ` · versão ${s.versaoId}`
            : `Camada ${s.camadaId} · arquivo ${s.arquivoId} · fonte ${s.fonteId} · versão ${s.versaoId}`
      }),
    ),
  ]
})
</script>
<style scoped>
.indicators-panel {
  width: 100%;
  max-width: 860px;
  min-height: 0;
  overflow: auto;
  pointer-events: auto;
  padding: 24px;
  border-radius: 18px;
  background: rgb(var(--v-theme-surface));
  border: 1px solid rgba(var(--v-theme-on-surface), 0.1);
  box-shadow: 0 8px 28px #0003;
}
header {
  margin-bottom: 20px;
}
header h2 {
  font-size: 24px;
  margin: 6px 0;
}
header p,
.note {
  font-size: 12px;
  line-height: 1.7;
  color: rgba(var(--v-theme-on-surface), 0.65);
}
.note {
  margin-bottom: 16px;
}
.steps {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  border-bottom: 1px solid rgba(var(--v-theme-on-surface), 0.1);
  padding-bottom: 16px;
  margin-bottom: 28px;
}
.advanced {
  margin: 16px 0;
  font-size: 12px;
}
summary {
  cursor: pointer;
  margin-bottom: 12px;
  color: rgb(var(--v-theme-primary));
}
.form-step {
  max-width: 760px;
}
.form-card {
  padding: 24px;
  border: 1px solid rgba(var(--v-theme-on-surface), 0.12);
  border-radius: 14px;
  background: rgb(var(--v-theme-surface));
}
.form-card h3 {
  font-size: 18px;
  margin-bottom: 8px;
}
.form-card > :deep(.v-input) {
  margin-bottom: 16px;
}
.indicators-panel :deep(.v-field) {
  font-size: 14px;
}
.indicators-panel :deep(.v-input) {
  --v-input-control-height: 52px;
}
.pages {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  font-size: 11px;
}
dl {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 10px;
  margin-top: 12px;
  font-size: 14px;
}
dd {
  font-weight: 600;
}
ul {
  padding-left: 20px;
  font-size: 12px;
  line-height: 1.8;
}
.calculation-summary {
  margin: 24px 0;
  padding: 16px;
  border-radius: 10px;
  background: rgba(var(--v-theme-on-surface), 0.04);
  font-size: 13px;
}
.calculation-summary dl {
  grid-template-columns: minmax(90px, 1fr) minmax(0, 2fr);
}
.calculation-summary dd {
  font-weight: 400;
  overflow-wrap: anywhere;
}
.calculation-actions {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}
.view-switch,
.result-navigation {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 10px;
  margin: 16px 0 24px;
}
.result-navigation {
  justify-content: space-between;
}
.results {
  margin-top: 24px;
  max-width: 900px;
}
.metric-card {
  max-width: 760px;
  padding: 20px;
  margin: 20px 0;
  border-radius: 12px;
  background: rgba(var(--v-theme-primary), 0.06);
}
.result-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
  margin-bottom: 16px;
}
.result-eyebrow {
  display: block;
  font-size: 12px;
  color: rgba(var(--v-theme-on-surface), 0.6);
  margin-bottom: 8px;
}
.result-heading h3 {
  font-size: 23px;
}
.history-status {
  font-size: 12px;
  padding: 8px 12px;
  border-radius: 8px;
  background: rgba(var(--v-theme-on-surface), 0.06);
  color: rgba(var(--v-theme-on-surface), 0.65);
}
.history-status.is-saved {
  color: #7cd6a5;
  background: #2eaa671a;
}
.metric-unit {
  margin-left: 0.4em;
  font-size: 12px;
  font-weight: 400;
  color: rgba(var(--v-theme-on-surface), 0.7);
}
.results > p {
  font-size: 13px;
}
.results details {
  margin-top: 24px;
  padding-top: 16px;
  border-top: 1px solid rgba(var(--v-theme-on-surface), 0.1);
}
.results dd {
  display: flex;
  justify-content: flex-end;
  align-items: baseline;
  flex-wrap: wrap;
}
.results dl {
  gap: 16px;
}
@media (max-width: 600px) {
  .indicators-panel,
  .form-card {
    padding: 16px;
  }
  .calculation-summary dl {
    grid-template-columns: 1fr;
    gap: 4px;
  }
  .calculation-summary dd {
    margin-bottom: 12px;
  }
  .calculation-actions {
    flex-direction: column-reverse;
    align-items: stretch;
  }
}
</style>
