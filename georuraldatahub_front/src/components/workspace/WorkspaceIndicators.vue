<template>
  <section class="indicators-panel" aria-label="Indicadores ambientais">
    <header>
      <span class="eyebrow">ANÁLISE AMBIENTAL</span>
      <h2>Medidores</h2>
      <p>Escolha uma área e os dados que serão usados no cálculo.</p>
    </header>
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
      label="Camada da área de análise"
      polygon
      :disabled="busy"
      @layers="remember"
    />
    <template v-if="areaLayer">
      <div class="search-row">
        <v-text-field
          v-model="query"
          label="Buscar município, imóvel ou bioma"
          hide-details
          :disabled="busy"
          @keyup.enter="searchFeatures(0)"
        /><v-btn variant="tonal" :loading="searching" :disabled="busy" @click="searchFeatures(0)"
          >Buscar</v-btn
        >
      </div>
      <v-select
        v-model="field"
        :items="fields"
        label="Campo usado como nome"
        clearable
        hint="Automático quando vazio. Os campos disponíveis vêm de uma amostra da camada."
        persistent-hint
        :disabled="busy"
      />
      <v-select
        v-model="featureId"
        :items="features"
        item-title="name"
        item-value="id"
        label="Feição da área de análise"
        :loading="searching"
        :disabled="busy"
        no-data-text="Nenhuma feição poligonal nesta busca"
      />
      <div class="pages">
        <v-btn
          variant="text"
          :disabled="featurePage === 0 || searching || busy"
          @click="searchFeatures(featurePage - 1)"
          >Anterior</v-btn
        ><span>{{ featureTotal }} feição(ões) · página {{ featurePage + 1 }}</span
        ><v-btn
          variant="text"
          :disabled="(featurePage + 1) * 20 >= featureTotal || searching || busy"
          @click="searchFeatures(featurePage + 1)"
          >Próxima</v-btn
        >
      </div>
    </template>
    <v-divider class="my-4" />
    <p class="note">
      Selecione camadas cujo conteúdo corresponda a cada papel. O nome do arquivo não determina seu
      uso.
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
    <v-btn
      color="primary"
      prepend-icon="mdi-calculator-variant-outline"
      :loading="busy"
      :disabled="!valid || searching"
      @click="run"
      >Calcular indicador</v-btn
    >
    <p class="note mt-3">
      Cálculo executado no Oracle. Esta consulta individual não grava histórico.
    </p>
    <section v-if="result" class="results" aria-live="polite">
      <h3>Resultado · {{ featureName }}</h3>
      <p>Área analisada: {{ formatValue(result.areaImovelHa) }} ha</p>
      <div v-for="group in resultGroups" :key="group.name" class="metric-card">
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
      <p class="note">Calculado em {{ calculatedAt }} · {{ result.projecaoCalculo }}</p>
      <h4 class="mt-4">Fontes utilizadas</h4>
      <ul>
        <li v-for="(source, index) in sources" :key="index">{{ source }}</li>
      </ul>
    </section>
  </section>
</template>
<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import EnvironmentalLayerPicker from './EnvironmentalLayerPicker.vue'
import {
  calculate,
  formatValue,
  indicators,
  listFeatures,
  roleNames,
  type Feature,
  type Layer,
} from '@/services/environmentalIndicators'
import { apiError } from '@/services/contracts'
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
  featureId.value = null
  try {
    const data = await listFeatures(areaLayer.value, query.value, field.value ?? '', page)
    if (request !== epoch) return
    features.value = data.items
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
        /* Attributes may be absent. */
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
    error.value = ''
  },
  { deep: true },
)
onBeforeUnmount(() => epoch++)
async function run() {
  if (!valid.value || !featureId.value) return
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
  featureName.value =
    features.value.find((f) => f.id === featureId.value)?.name ?? 'Área selecionada'
  try {
    result.value = await calculate(featureId.value, indicator.value, params)
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
          ? `${s.fonte} · ${s.arquivo} · ${s.nome} · versão ${s.versaoId}`
          : layer
            ? `${layer.source} · ${layer.file} · ${layer.name} · versão ${s.versaoId}`
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
</style>
