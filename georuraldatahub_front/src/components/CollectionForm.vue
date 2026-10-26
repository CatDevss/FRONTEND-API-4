<template>
  <section class="collection-panel" aria-label="Parâmetros da coleta">
    <div class="section-heading">
      <span class="step-number">02</span>
      <div>
        <h3>Parâmetros da coleta</h3>
        <p>
          Defina a competência e os filtros de {{ connector.agency }} — {{ connector.product }}.
        </p>
      </div>
    </div>
    <v-alert
      v-if="error"
      type="error"
      variant="tonal"
      density="compact"
      class="mb-4"
      role="alert"
      >{{ error }}</v-alert
    >
    <div v-if="!ready && !result && !busy" class="readiness-note">
      <v-icon icon="mdi-information-outline" size="17" />
      <p>Selecione fonte com dicionário para coletar com o usuário da sessão.</p>
    </div>
    <template v-if="selected">
      <div class="collection-fields">
        <v-select
          v-if="product === 'IBGE_BIOMAS'"
          v-model="competence"
          :items="['2019', '2025']"
          label="Edição"
          hint="Escolha a edição disponibilizada pelo serviço."
          persistent-hint
          variant="outlined"
          density="compact"
          :disabled="busy"
        />
        <v-text-field
          v-else
          v-model="competence"
          :type="product === 'INPE_QUEIMADAS' ? 'date' : 'text'"
          :label="
            product === 'INPE_QUEIMADAS' ? 'Dia encerrado (AAAA-MM-DD)' : 'Ano publicado (AAAA)'
          "
          :hint="
            product === 'INPE_QUEIMADAS'
              ? 'Informe um dia já encerrado para consultar a coleta.'
              : 'Informe o ano publicado pelo serviço oficial.'
          "
          persistent-hint
          variant="outlined"
          density="compact"
          :disabled="busy"
        />
        <v-text-field
          v-if="product === 'IBGE_MUNICIPIOS'"
          v-model="municipality"
          label="Município (opcional)"
          hint="Código IBGE de 7 dígitos, iniciado por 41."
          persistent-hint
          variant="outlined"
          density="compact"
          :disabled="busy"
        />
        <template v-if="product === 'INPE_PRODES'">
          <v-select
            v-model="biome"
            :items="biomeOptions"
            label="Bioma"
            variant="outlined"
            density="compact"
            :disabled="busy"
            hide-details="auto"
          />
          <v-text-field
            v-model="bbox"
            label="Recorte geográfico (opcional)"
            placeholder="Ex.: -54,-26,-50,-23"
            hint="Ordem das coordenadas: oeste, sul, leste, norte."
            persistent-hint
            variant="outlined"
            density="compact"
            :disabled="busy"
            class="bbox-field"
          />
        </template>
      </div>
      <details class="collection-details">
        <summary>
          <v-icon icon="mdi-information-outline" size="15" /><span
            >Sobre este serviço e suas limitações</span
          ><v-icon icon="mdi-chevron-down" class="details-chevron" size="15" />
        </summary>
        <p v-if="selected.limitations">{{ selected.limitations }}</p>
        <p>
          A URL da fonte deve corresponder ao órgão do conector. Os agendamentos são administrados
          separadamente desta coleta sob demanda.
        </p>
      </details>
    </template>
    <div class="collection-submit">
      <div class="execution-note">
        <v-icon :icon="busy ? 'mdi-cloud-sync-outline' : 'mdi-play-circle-outline'" size="18" />
        <p>
          {{
            busy
              ? 'Coletando e validando os dados. Aguarde o resultado da API.'
              : 'A coleta será iniciada agora, ao confirmar esta ação.'
          }}
        </p>
      </div>
      <v-btn
        color="primary"
        :disabled="!ready || !selected || !competence || busy"
        :loading="busy"
        prepend-icon="mdi-cloud-download-outline"
        @click="collect"
        >Coletar e validar</v-btn
      >
    </div>
    <section
      v-if="result"
      class="collection-result"
      aria-label="Resultado da coleta"
      aria-live="polite"
    >
      <div class="result-heading">
        <span class="result-icon"><v-icon icon="mdi-file-check-outline" size="21" /></span>
        <div>
          <p class="context-label">RESULTADO DA COLETA</p>
          <h4>{{ result.file.name }}</h4>
        </div>
      </div>
      <ValidationResult
        v-if="result.file.validation"
        :report="result.file.validation"
        :file-id="result.file.id"
      />
      <v-alert v-else type="warning" variant="tonal" density="compact"
        >Validação indisponível. Consulte o relatório antes de utilizar os dados.</v-alert
      >
      <div class="result-metadata">
        <span><v-icon icon="mdi-map-marker-outline" size="14" />{{ result.collection.scope }}</span
        ><span v-if="result.collection.competence"
          ><v-icon icon="mdi-calendar-outline" size="14" />{{ result.collection.competence }}</span
        >
      </div>
      <p
        v-for="limitation in result.collection.limitations"
        :key="limitation"
        class="result-limitation"
      >
        {{ limitation }}
      </p>
    </section>
  </section>
</template>
<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import axios from 'axios'
import { isCollectionInProgress, isUploadInProgress } from '@/composables/uploadLock'
import {
  beginIngestionProgress,
  updateIngestionProgress,
  finishIngestionProgress,
} from '@/composables/ingestionProgress'
import { can, currentUserId } from '@/access/session'
import ValidationResult from '@/components/ValidationResult.vue'
import {
  apiError,
  validationMessage,
  sourceSupportsProduct,
  type Connector,
  type IngestedFile,
  type CollectionMetadata,
} from '@/services/contracts'
const props = defineProps<{
  connector: Connector
  sourceId: number | null
  sourceUrl: string
  sourceName?: string
  userId: number | null
  ready: boolean
  dictionaryId?: number | null
}>()
const emit = defineEmits<{ collected: []; busy: [value: boolean] }>()
const busy = ref(false),
  error = ref('')
const biomeOptions = [
  { title: 'Cerrado', value: 'CERRADO' },
  { title: 'Mata Atlântica', value: 'MATA_ATLANTICA' },
]
const product = computed(() => props.connector.id)
const competence = ref(''),
  municipality = ref(''),
  biome = ref(''),
  bbox = ref('')
const result = ref<{ file: IngestedFile; collection: CollectionMetadata } | null>(null)
const selected = computed(() => props.connector)
watch(product, () => {
  competence.value = ''
  municipality.value = ''
  biome.value = ''
  bbox.value = ''
  result.value = null
  error.value = ''
})
watch(
  () => [props.sourceId, props.userId, props.dictionaryId],
  () => {
    result.value = null
    error.value = ''
  },
)
async function collect() {
  if (
    !can('ingestion.run') ||
    currentUserId.value !== props.userId ||
    !props.ready ||
    !props.sourceId ||
    !props.userId ||
    busy.value ||
    isCollectionInProgress.value ||
    isUploadInProgress.value ||
    !sourceSupportsProduct(props.sourceUrl, product.value)
  )
    return
  error.value = ''
  result.value = null
  if (
    props.dictionaryId != null &&
    (!Number.isInteger(props.dictionaryId) || props.dictionaryId <= 0)
  ) {
    error.value = 'Selecione um dicionário válido.'
    return
  }
  const body: Record<string, unknown> = {
    product: product.value,
    competence: competence.value.trim(),
    userId: props.userId,
    ...(props.dictionaryId != null ? { dictionaryId: props.dictionaryId } : {}),
  }
  if (product.value === 'IBGE_MUNICIPIOS' && municipality.value.trim()) {
    if (!/^41\d{5}$/.test(municipality.value.trim())) {
      error.value = 'Informe um código IBGE do Paraná válido.'
      return
    }
    body.municipality = municipality.value.trim()
  }
  if (product.value === 'INPE_PRODES') {
    if (!biome.value) {
      error.value = 'Selecione o bioma.'
      return
    }
    body.biome = biome.value
    if (bbox.value.trim()) {
      const coordinates = bbox.value.split(',').map((v) => (v.trim() ? Number(v) : NaN))
      if (coordinates.length !== 4 || coordinates.some((v) => !Number.isFinite(v))) {
        error.value = 'Informe quatro coordenadas numéricas.'
        return
      }
      body.bbox = coordinates
    }
  }
  busy.value = true
  isCollectionInProgress.value = true
  emit('busy', true)
  const actor = props.userId,
    requestedSource = props.sourceId,
    requestedProduct = product.value
  const progressId = beginIngestionProgress({
    kind: 'automatic',
    title: `${props.connector.agency} · ${props.connector.product}`,
    source: `${props.sourceName || `Fonte #${requestedSource}`} · ${competence.value.trim()}`,
    fileCount: 1,
  })
  try {
    const { data } = await axios.post<{ file: IngestedFile; collection: CollectionMetadata }>(
      `/fontes/${requestedSource}/coletas`,
      body,
    )
    if (currentUserId.value !== actor) return
    updateIngestionProgress(progressId, { completedCount: 1, fileName: data.file.name })
    finishIngestionProgress(
      progressId,
      data.file.validation?.status === 'VALIDO' ? 'completed' : 'attention',
      validationMessage(data.file.validation),
      data.file.validation && ['REJEITADO', 'PARCIAL'].includes(data.file.validation.status)
        ? (data.file.id ?? null)
        : null,
    )
    if (props.sourceId !== requestedSource || product.value !== requestedProduct) return
    result.value = data
    emit('collected')
  } catch (e) {
    if (currentUserId.value !== actor) return
    const message = apiError(e)
    finishIngestionProgress(progressId, 'error', message)
    if (props.sourceId === requestedSource && product.value === requestedProduct)
      error.value = message
  } finally {
    busy.value = false
    isCollectionInProgress.value = false
    emit('busy', false)
  }
}
</script>
<style scoped>
.collection-panel {
  min-width: 0;
  border: 1px solid var(--glass-outer-border);
  border-radius: 18px;
  background: rgba(var(--v-theme-surface), 0.45);
  padding: 24px;
}
.section-heading {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 24px;
}
.step-number {
  display: grid;
  place-items: center;
  width: 32px;
  height: 32px;
  border: 1px solid rgba(var(--v-theme-primary), 0.2);
  border-radius: 10px;
  color: rgb(var(--v-theme-primary));
  font-size: 11px;
  font-weight: 600;
  flex-shrink: 0;
}
.section-heading h3 {
  font-size: 14px;
  font-weight: 600;
}
.section-heading p {
  font-size: 11px;
  color: rgba(var(--v-theme-on-surface), 0.55);
  margin-top: 4px;
  line-height: 1.6;
}
.readiness-note {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 12px 14px;
  border: 1px solid var(--glass-outer-border);
  border-radius: 10px;
  background: rgba(var(--v-theme-background), 0.2);
  margin-bottom: 20px;
  color: rgba(var(--v-theme-on-surface), 0.6);
}
.readiness-note :deep(.v-icon) {
  color: rgb(var(--v-theme-primary));
  flex-shrink: 0;
  margin-top: 1px;
}
.readiness-note p {
  font-size: 11px;
  line-height: 1.6;
}
.collection-fields {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 18px 16px;
}
.bbox-field {
  grid-column: 1 / -1;
}
.collection-fields :deep(.v-messages) {
  font-size: 10px;
  line-height: 1.6;
}
.collection-details {
  margin: 20px 0;
  border-top: 1px solid var(--glass-outer-border);
  border-bottom: 1px solid var(--glass-outer-border);
}
.collection-details > summary {
  display: flex;
  align-items: center;
  gap: 8px;
  list-style: none;
  font-size: 10px;
  padding: 13px 0;
  cursor: pointer;
  color: rgba(var(--v-theme-on-surface), 0.6);
}
.collection-details > summary::-webkit-details-marker {
  display: none;
}
.collection-details > summary > span {
  flex: 1;
}
.collection-details[open] .details-chevron {
  transform: rotate(180deg);
}
.collection-details > p {
  font-size: 11px;
  line-height: 1.7;
  color: rgba(var(--v-theme-on-surface), 0.55);
  margin-bottom: 12px;
}
.collection-submit {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
}
.execution-note {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  color: rgba(var(--v-theme-on-surface), 0.5);
  flex: 1;
  min-width: 160px;
}
.execution-note :deep(.v-icon) {
  flex-shrink: 0;
  margin-top: 1px;
}
.execution-note p {
  font-size: 10px;
  line-height: 1.6;
}
.collection-submit > :deep(.v-btn) {
  text-transform: none;
  letter-spacing: 0;
  border-radius: 10px;
  font-size: 12px;
}
.collection-result {
  border-top: 1px solid var(--glass-outer-border);
  margin-top: 24px;
  padding-top: 24px;
}
.result-heading {
  display: flex;
  align-items: center;
  gap: 10px;
}
.result-icon {
  display: grid;
  place-items: center;
  width: 38px;
  height: 38px;
  border-radius: 11px;
  background: rgba(var(--v-theme-on-surface), 0.04);
  color: rgba(var(--v-theme-on-surface), 0.65);
  flex-shrink: 0;
}
.context-label {
  font-size: 9px;
  letter-spacing: 0.1em;
  color: rgba(var(--v-theme-on-surface), 0.45);
  margin-bottom: 4px;
}
.result-heading h4 {
  font-size: 13px;
  font-weight: 500;
  overflow-wrap: anywhere;
}
.result-metadata {
  display: flex;
  align-items: center;
  gap: 16px;
  flex-wrap: wrap;
  margin-top: 16px;
}
.result-metadata > span {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 10px;
  color: rgba(var(--v-theme-on-surface), 0.65);
}
.result-limitation {
  font-size: 10px;
  color: rgba(var(--v-theme-on-surface), 0.5);
  line-height: 1.7;
  margin-top: 8px;
}
@media (max-width: 1100px) {
  .collection-panel {
    padding: 20px;
  }
}
@media (max-width: 650px) {
  .collection-panel {
    padding: 16px;
  }
  .collection-fields {
    grid-template-columns: 1fr;
  }
  .collection-submit > :deep(.v-btn) {
    width: 100%;
  }
}
</style>
