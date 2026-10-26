<template>
  <v-dialog
    :model-value="modelValue"
    max-width="1100"
    scrollable
    @update:model-value="emit('update:modelValue', $event)"
  >
    <v-card title="Registros para corrigir" :subtitle="fileName || 'Arquivo não vinculado'">
      <v-card-text>
        <v-alert type="info" variant="tonal" density="compact" class="mb-4">
          Corrija no campo de cada registro o que for dado do operador, como geometria, tipo ou
          valor ausente. Campos que não existem no dicionário precisam ser incluídos pelo gestor.
          O relatório original continua preservado. Por enquanto as correções ficam apenas neste
          popup; o envio para reavaliação será liberado na próxima etapa.
        </v-alert>
        <v-progress-linear
          v-if="loading"
          indeterminate
          color="primary"
          aria-label="Carregando relatório de validação"
        />
        <v-alert v-if="error" type="error" variant="tonal" role="alert"
          >{{ error
          }}<v-btn variant="text" :disabled="loading" @click="emit('retry')"
            >Tentar novamente</v-btn
          ></v-alert
        >
        <template v-if="report">
          <p class="correction-summary">{{ validationMessage(report) }}</p>
          <section v-if="targets.fileErrors.length" class="correction-section">
            <h3>Erros do arquivo</h3>
            <p class="text-body-2 text-medium-emphasis">
              Estes erros atingem o arquivo inteiro e não são corrigidos editando campos. Se o
              problema for uma coluna ou campo ausente do dicionário, peça ao gestor para
              incluí-lo.
            </p>
            <ul class="error-list">
              <template v-for="entry in targets.fileErrors" :key="entry.recordIndex">
                <li v-for="(message, index) in entry.errors" :key="index">
                  <v-chip v-if="parse(message).code" size="x-small" variant="tonal" color="error">{{
                    parse(message).label
                  }}</v-chip>
                  <span>{{ parse(message).detail }}</span>
                  <v-chip
                    size="x-small"
                    variant="outlined"
                    :color="ownerColor(errorOwner(message, entry.recordIndex))"
                    >{{ errorOwnerLabels[errorOwner(message, entry.recordIndex)] }}</v-chip
                  >
                </li>
              </template>
            </ul>
          </section>
          <section v-if="targets.rejected.length" class="correction-section">
            <h3>Registros rejeitados ({{ targets.rejected.length }})</h3>
            <article
              v-for="entry in pageItems"
              :key="entry.recordIndex"
              class="rejected-record"
              :data-record-index="entry.recordIndex"
            >
              <div class="record-heading">
                <strong class="text-body-2">Índice do registro: {{ entry.recordIndex }}</strong>
                <v-chip
                  v-if="correction(entry).editable"
                  size="x-small"
                  variant="outlined"
                  color="primary"
                  >Operador pode corrigir</v-chip
                >
                <v-chip
                  v-if="correction(entry).needsManager"
                  size="x-small"
                  variant="outlined"
                  color="warning"
                  >Depende do dicionário (gestor)</v-chip
                >
                <v-chip v-if="changed(entry)" size="x-small" variant="tonal" color="primary"
                  >Rascunho alterado</v-chip
                >
              </div>
              <ul class="error-list">
                <li v-for="(message, index) in entry.errors" :key="index">
                  <v-chip v-if="parse(message).code" size="x-small" variant="tonal" color="error">{{
                    parse(message).label
                  }}</v-chip>
                  <span>{{ parse(message).detail || message }}</span>
                </li>
              </ul>
              <p class="field-label">Conteúdo original (preservado)</p>
              <pre class="raw-content">{{ entry.rawContent }}</pre>
              <template v-if="correction(entry).editable">
                <v-textarea
                  :model-value="draftOf(entry)"
                  label="Correção do registro"
                  variant="outlined"
                  density="compact"
                  rows="4"
                  auto-grow
                  max-rows="14"
                  :error-messages="draftError(draftOf(entry), entry.rawContent) || undefined"
                  :hint="
                    editorKind(entry.rawContent) === 'json'
                      ? 'Edite a geometria e as propriedades deste registro.'
                      : 'Linha CSV: valores entre aspas, na ordem das colunas do arquivo.'
                  "
                  persistent-hint
                  class="mt-3 correction-input"
                  @update:model-value="setDraft(entry, $event)"
                />
                <v-btn
                  size="small"
                  variant="text"
                  :disabled="!changed(entry)"
                  @click="restore(entry)"
                  >Restaurar original</v-btn
                >
              </template>
              <p v-else class="text-body-2 text-medium-emphasis mt-2">
                Este registro depende de ajuste no dicionário. Depois que o gestor incluir o campo,
                ele poderá ser reavaliado.
              </p>
            </article>
            <v-pagination
              v-if="pageCount > 1"
              v-model="page"
              :length="pageCount"
              :total-visible="5"
              density="compact"
            />
          </section>
          <p v-if="!targets.fileErrors.length && !targets.rejected.length">
            Nenhum registro rejeitado no relatório.
          </p>
        </template>
        <p v-else-if="!loading && !error">Relatório indisponível. Não presuma aprovação dos dados.</p>
      </v-card-text>
      <v-card-actions>
        <span v-if="changedCount" class="draft-count" role="status"
          >{{ changedCount }}
          {{ changedCount === 1 ? 'correção em rascunho' : 'correções em rascunho' }}</span
        >
        <v-spacer /><v-btn @click="emit('update:modelValue', false)">Fechar</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>
<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { validationMessage, type ValidationReport } from '@/services/contracts'
import {
  correctionTargets,
  draftError,
  editorKind,
  errorOwner,
  errorOwnerLabels,
  initialDraft,
  parseValidationError,
  recordCorrection,
  type ErrorOwner,
} from '@/services/quarantine'

type RejectedRecord = ValidationReport['records'][number]
const props = defineProps<{
  modelValue: boolean
  fileName: string | null
  report: ValidationReport | null
  loading: boolean
  error: string
}>()
const emit = defineEmits<{ 'update:modelValue': [value: boolean]; retry: [] }>()
const perPage = 10
const page = ref(1)
// Rascunhos por índice de registro; ficam só na memória e não alteram o relatório original.
const drafts = ref<Record<number, string>>({})
const targets = computed(() => correctionTargets(props.report))
const pageCount = computed(() => Math.ceil(targets.value.rejected.length / perPage))
const pageItems = computed(() =>
  targets.value.rejected.slice((page.value - 1) * perPage, page.value * perPage),
)
const parse = parseValidationError
const correction = recordCorrection
const draftOf = (entry: RejectedRecord) =>
  drafts.value[entry.recordIndex] ?? initialDraft(entry.rawContent)
const changed = (entry: RejectedRecord) =>
  correction(entry).editable && draftOf(entry) !== initialDraft(entry.rawContent)
const changedCount = computed(() => targets.value.rejected.filter(changed).length)
function setDraft(entry: RejectedRecord, value: string) {
  drafts.value = { ...drafts.value, [entry.recordIndex]: value ?? '' }
}
function restore(entry: RejectedRecord) {
  const { [entry.recordIndex]: _discarded, ...rest } = drafts.value
  drafts.value = rest
}
function ownerColor(owner: ErrorOwner) {
  return owner === 'manager' ? 'warning' : owner === 'file' ? 'error' : 'primary'
}
watch(
  () => props.report,
  () => {
    page.value = 1
    drafts.value = {}
  },
)
</script>
<style scoped>
.correction-summary {
  font-weight: 600;
  margin-bottom: 16px;
}
.correction-section {
  margin-top: 18px;
}
.correction-section h3 {
  font-size: 14px;
  margin-bottom: 8px;
}
.error-list {
  list-style: none;
  padding: 0;
  margin: 8px 0;
}
.error-list li {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: baseline;
  margin: 4px 0;
  overflow-wrap: anywhere;
}
.rejected-record {
  border-top: 1px solid var(--glass-outer-border);
  padding: 14px 0;
}
.record-heading {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
}
.field-label {
  font-size: 11px;
  opacity: 0.65;
  margin-top: 10px;
}
.raw-content {
  font-family: monospace;
  font-size: 12px;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  max-height: 160px;
  overflow: auto;
  margin-top: 4px;
}
.correction-input :deep(textarea) {
  font-family: monospace;
  font-size: 12px;
}
.draft-count {
  font-size: 12px;
  margin-left: 16px;
}
</style>