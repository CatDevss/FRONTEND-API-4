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
          Veja abaixo o que foi rejeitado na validação e por quê. O relatório original continua
          preservado. A edição dos campos será liberada em uma próxima etapa.
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
              Estes erros atingem o arquivo inteiro e não são corrigidos editando campos.
            </p>
            <ul class="error-list">
              <template v-for="entry in targets.fileErrors" :key="entry.recordIndex">
                <li v-for="(message, index) in entry.errors" :key="index">
                  <v-chip v-if="parse(message).code" size="x-small" variant="tonal" color="error">{{
                    parse(message).label
                  }}</v-chip>
                  <span>{{ parse(message).detail }}</span>
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
              <strong class="text-body-2">Índice do registro: {{ entry.recordIndex }}</strong>
              <ul class="error-list">
                <li v-for="(message, index) in entry.errors" :key="index">
                  <v-chip v-if="parse(message).code" size="x-small" variant="tonal" color="error">{{
                    parse(message).label
                  }}</v-chip>
                  <span>{{ parse(message).detail }}</span>
                </li>
              </ul>
              <pre class="raw-content">{{ entry.rawContent }}</pre>
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
      <v-card-actions
        ><v-spacer /><v-btn @click="emit('update:modelValue', false)">Fechar</v-btn></v-card-actions
      >
    </v-card>
  </v-dialog>
</template>
<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { validationMessage, type ValidationReport } from '@/services/contracts'
import { correctionTargets, parseValidationError } from '@/services/quarantine'

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
const targets = computed(() => correctionTargets(props.report))
const pageCount = computed(() => Math.ceil(targets.value.rejected.length / perPage))
const pageItems = computed(() =>
  targets.value.rejected.slice((page.value - 1) * perPage, page.value * perPage),
)
const parse = parseValidationError
watch(
  () => props.report,
  () => {
    page.value = 1
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
  gap: 8px;
  align-items: baseline;
  margin: 4px 0;
  overflow-wrap: anywhere;
}
.rejected-record {
  border-top: 1px solid var(--glass-outer-border);
  padding: 14px 0;
}
.raw-content {
  font-family: monospace;
  font-size: 12px;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  max-height: 160px;
  overflow: auto;
  margin-top: 8px;
}
</style>