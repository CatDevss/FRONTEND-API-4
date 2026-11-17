<template>
  <section ref="panelElement" class="indicators-panel" aria-label="Indicadores ambientais">
    <header>
      <h2>Indicadores ambientais</h2>
      <p>Escolha a área, informe os dados e consulte o resultado.</p>
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
          >1 · Área</v-btn
        >
        <v-btn
          :variant="step === 2 ? 'tonal' : 'text'"
          :disabled="!featureId || busy"
          @click="step = 2"
          >2 · Dados</v-btn
        >
        <v-btn
          :variant="step === 3 ? 'tonal' : 'text'"
          :disabled="!result || busy"
          @click="step = 3"
          >3 · Resultado</v-btn
        >
      </nav>
      <div v-show="step === 1" class="form-step">
        <v-select
          v-model="indicator"
          :items="indicators"
          item-title="name"
          item-value="id"
          label="Indicador"
          :disabled="busy"
        />
        <EnvironmentalLayerPicker
          v-model="areaLayer"
          label="Onde está a área que você quer analisar?"
          polygon
          :disabled="busy"
          @layers="remember"
        />
        <template v-if="areaLayer">
          <details class="advanced">
            <summary>Ajustar campo do nome</summary>
            <v-select
              v-model="field"
              :items="fields"
              label="Campo usado como nome"
              clearable
              hint="Automático quando vazio. Os campos disponíveis vêm de uma amostra da camada."
              persistent-hint
              :disabled="busy"
            />
          </details>
          <v-autocomplete
            v-model="featureId"
            :items="featureOptions"
            item-title="name"
            item-value="id"
            label="Buscar município, imóvel ou bioma"
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
        <v-btn color="primary" :disabled="!featureId || searching" @click="step = 2"
          >Continuar</v-btn
        >
      </div>
      <div v-show="step === 2" class="form-step">
        <p class="note">
          <strong>{{ selected.name }}</strong> ·
          {{ featureOptions.find((f) => f.id === featureId)?.name }}
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
            v-model.number="minimum"
            type="number"
            min="0"
            max="100"
            label="Percentual mínimo de reserva legal (%)"
            :disabled="busy" /><v-textarea
            v-model="reason"
            label="Fundamento do percentual adotado"
            rows="2"
            :disabled="busy"
        /></template>
        <v-text-field
          v-if="indicator === 'ifc'"
          v-model="start"
          type="date"
          label="Data inicial"
          :disabled="busy"
        />
        <v-text-field
          v-if="indicator === 'ifc' || indicator === 'idesmat'"
          v-model="end"
          type="date"
          label="Data final (inclusiva)"
          :disabled="busy"
        />
        <v-alert v-if="error" type="error" class="mb-4">{{ error }}</v-alert>
        <div class="calculation-actions">
          <v-btn color="primary" :loading="busy" :disabled="!valid || searching" @click="run(true)"
            >Calcular e salvar</v-btn
          >
          <v-btn variant="text" :disabled="!valid || searching || busy" @click="run(false)"
            >Prévia sem salvar</v-btn
          >
        </div>
        <p class="note mt-3">
          Salvar registra este indicador, os parâmetros e o resultado no histórico.
        </p>
      </div>
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
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import EnvironmentalHistory from './EnvironmentalHistory.vue'
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
const inputs = ref<Record<string, number[]>>({}),
  query = ref(''),
  field = ref<string | null>(null),
  fields = ref<string[]>([])
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
  const selected = featureId.value ? featureCache.get(featureId.value) : null
  if (selected) rows.set(selected.id, selected)
  return [...rows.values()]
})
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
  field.value = null
  fields.value = []
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
const layers = new Map<number, Layer>()
function remember(items: Layer[]) {
  for (const item of items) layers.set(item.id, item)
}
const selected = computed(() => indicators.find((i) => i.id === indicator.value) ?? indicators[0])
const iso = (value: string) =>
  /^\d{4}-\d{2}-\d{2}$/.test(value) &&
  !Number.isNaN(Date.parse(value)) &&
  new Date(value).toISOString().slice(0, 10) === value
const valid = computed(
  () =>
    !!featureId.value &&
    selected.value.roles.every((r) => (inputs.value[r]?.length ?? 0) > 0) &&
    (indicator.value !== 'irl' ||
      (minimum.value !== '' &&
        Number(minimum.value) >= 0 &&
        Number(minimum.value) <= 100 &&
        !!reason.value.trim())) &&
    (!['ifc', 'idesmat'].includes(indicator.value) || iso(end.value)) &&
    (indicator.value !== 'ifc' || (iso(start.value) && start.value <= end.value)),
)
let epoch = 0
async function searchFeatures(page: number) {
  if (!areaLayer.value) return
  const request = ++epoch
  searching.value = true
  error.value = ''
  try {
    const data = await listFeatures(areaLayer.value, query.value, field.value ?? '', page)
    if (request !== epoch) return
    features.value = data.items
    for (const f of data.items) featureCache.set(f.id, f)
    featurePage.value = page
    featureTotal.value = data.total
    const keys = new Set(fields.value)
    for (const f of data.items) {
      try {
        const attrs = JSON.parse(f.attributes ?? '{}')
        for (const [k, v] of Object.entries(attrs))
          if (/^[\p{L}\p{N}_]{1,100}$/u.test(k) && ['string', 'number'].includes(typeof v))
            keys.add(k)
      } catch {
        /* Os atributos podem estar ausentes. */
      }
    }
    fields.value = [...keys].sort()
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
  fields.value = []
  query.value = ''
  field.value = null
  result.value = null
  void searchFeatures(0)
})
watch(field, () => {
  void searchFeatures(0)
})
watch(
  [indicator, featureId, inputs, minimum, reason, start, end],
  () => {
    result.value = null
    snapshot.value = null
    if (step.value === 3) step.value = 2
    error.value = ''
  },
  { deep: true },
)
onBeforeUnmount(() => {
  epoch++
  clearTimeout(searchTimer)
})
async function run(save = false) {
  if (!valid.value || !featureId.value || busy.value) return
  busy.value = true
  error.value = ''
  result.value = null
  const params: Record<string, unknown> = {}
  for (const role of selected.value.roles) params[role] = inputs.value[role]
  if (indicator.value === 'irl') {
    params.rlMinimoPercentual = Number(minimum.value)
    params.fundamentoRl = reason.value.trim()
  }
  if (['ifc', 'idesmat'].includes(indicator.value)) params.fim = end.value
  if (indicator.value === 'ifc') params.inicio = start.value
  featureName.value = featureCache.get(featureId.value)?.name ?? 'Área selecionada'
  try {
    const data = await (save ? calculateAndSave : calculate)(
      featureId.value,
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
    error.value = apiError(
      e,
      'Não foi possível calcular. Confira as camadas e a disponibilidade do serviço ambiental.',
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
.steps {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 24px;
}
.advanced {
  margin-bottom: 16px;
  font-size: 12px;
}
.advanced summary,
summary {
  cursor: pointer;
  margin-bottom: 12px;
  color: rgb(var(--v-theme-primary));
}
.indicators-panel {
  width: 100%;
  max-width: 860px;
  min-height: 0;
  overflow: auto;
  pointer-events: auto;
  padding: 24px;
  border-radius: 18px;
  background: rgba(var(--v-theme-surface), 0.97);
  border: 1px solid rgba(var(--v-theme-on-surface), 0.1);
  box-shadow: 0 8px 28px #0003;
}
.eyebrow {
  font-size: 10px;
  letter-spacing: 0.14em;
  color: rgb(var(--v-theme-primary));
}
header {
  margin-bottom: 24px;
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
.search-row,
.pages {
  display: flex;
  align-items: center;
  gap: 10px;
}
.pages {
  justify-content: space-between;
  font-size: 11px;
}
.results {
  margin-top: 24px;
  border-top: 1px solid rgba(var(--v-theme-on-surface), 0.15);
  padding-top: 20px;
}
.metric-card {
  margin: 14px 0;
  padding: 16px;
  border-radius: 12px;
  background: rgba(var(--v-theme-primary), 0.06);
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
@media (max-width: 600px) {
  .indicators-panel {
    padding: 16px;
  }
  .search-row {
    flex-wrap: wrap;
  }
}
.form-step {
  max-width: 760px;
}
.steps {
  border-bottom: 1px solid rgba(var(--v-theme-on-surface), 0.1);
  padding-bottom: 16px;
  margin-bottom: 28px;
}
header h2 {
  font-size: 24px;
}
header {
  margin-bottom: 20px;
}
.results {
  max-width: 900px;
}
.indicators-panel :deep(.v-field) {
  font-size: 14px;
}
.indicators-panel :deep(.v-input) {
  --v-input-control-height: 52px;
}
.metric-card {
  max-width: 760px;
}
.advanced {
  margin: 16px 0;
}
.calculation-actions {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
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
.results {
  border-top: 0;
  padding-top: 0;
}
.metric-card {
  padding: 20px;
  margin: 20px 0;
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
  white-space: nowrap;
}
.results dl {
  gap: 16px;
}
.view-switch,
.result-navigation {
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 16px 0 24px;
}
.result-navigation {
  justify-content: space-between;
}
</style>
