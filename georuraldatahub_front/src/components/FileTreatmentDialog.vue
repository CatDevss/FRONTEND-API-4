<template>
  <v-dialog v-model="open" max-width="1050" :persistent="busy" scrollable>
    <v-card class="treatment-dialog">
      <v-card-title class="d-flex align-center ga-3 pa-5">
        <v-icon icon="mdi-auto-fix" color="primary" />
        <div>
          <p class="text-overline text-primary">PREPARAÇÃO DOS DADOS</p>
          <h2 class="text-h6">Tratamento do arquivo</h2>
        </div>
      </v-card-title>
      <v-card-text>
        <p class="text-body-2 mb-4" style="overflow-wrap: anywhere">{{ file?.name }}</p>
        <section class="treatment-panel" aria-label="Novo tratamento">
          <h3>{{ raster ? 'Catalogar metadados do raster' : 'Gerar camada tratada' }}</h3>
          <p class="text-body-2 text-medium-emphasis mt-2">
            Somente registros ou metadados aprovados pela validação seguem para tratamento. O
            resultado não significa publicação ou aprovação por um gestor.
          </p>
          <p v-if="raster" class="text-body-2 mt-3">
            O backend registra metadados e cobertura. As células do GeoTIFF não são processadas nem
            exibidas como imagem no mapa.
          </p>
          <template v-if="can('treatment.run') && !raster">
            <v-select
              v-model="datasetId"
              :items="datasets"
              item-title="name"
              item-value="id"
              label="Conjunto para a camada"
              variant="outlined"
              density="compact"
              class="mt-4"
              :loading="datasetsLoading"
              :disabled="busy || datasetsLoading"
              clearable
              hide-details
            />
            <v-alert v-if="datasetsError" type="error" variant="tonal" class="mt-3"
              >{{ datasetsError
              }}<v-btn variant="text" @click="loadDatasets">Tentar novamente</v-btn></v-alert
            >
            <v-progress-linear
              v-if="checkingMembership"
              indeterminate
              class="mt-3"
              aria-label="Conferindo associação"
            />
            <v-alert v-if="membershipError" type="error" variant="tonal" class="mt-3"
              >{{ membershipError
              }}<v-btn variant="text" @click="checkMembership">Conferir novamente</v-btn></v-alert
            >
            <p v-else-if="datasetId && !checkingMembership" class="text-body-2 mt-3" role="status">
              {{
                associated
                  ? 'Arquivo associado ao conjunto selecionado.'
                  : 'Associe este arquivo ao conjunto antes de tratar.'
              }}<v-btn
                v-if="!associated && can('datasets.manage')"
                to="/datasets"
                size="small"
                variant="text"
                :disabled="busy"
                >Gerenciar conjuntos</v-btn
              >
            </p>
            <p v-else class="text-caption mt-3">
              Escolha um conjunto que já contenha este arquivo. O tratamento preserva o arquivo de
              origem.
            </p>
          </template>
          <p v-if="!supportsTreatment(file?.formatFile ?? null)" class="text-body-2 mt-3">
            Formato não disponível para tratamento.
          </p>
          <v-alert v-if="actionError" type="error" variant="tonal" class="mt-3" role="alert">{{
            actionError
          }}</v-alert>
          <v-btn
            v-if="can('treatment.run')"
            color="primary"
            prepend-icon="mdi-auto-fix"
            class="mt-4"
            :loading="busy"
            :disabled="!canStart"
            @click="run"
            >{{ raster ? 'Catalogar raster' : 'Tratar arquivo' }}</v-btn
          >
          <p v-else class="text-caption mt-3">
            Seu perfil permite consultar o histórico. O Operador executa os tratamentos.
          </p>
          <v-alert
            v-if="result"
            :type="
              result.status === 'CONCLUIDO'
                ? 'success'
                : result.status === 'FALHOU'
                  ? 'error'
                  : 'info'
            "
            variant="tonal"
            class="mt-4"
            role="status"
            >Tratamento {{ result.id }}: {{ treatmentStatus(result.status) }}.
            {{ result.error || '' }}</v-alert
          >
          <div v-if="result" class="d-flex flex-wrap ga-2 mt-3">
            <v-btn
              v-if="treatmentMapLocation(result) && can('map.read')"
              :to="treatmentMapLocation(result)!"
              size="small"
              variant="tonal"
              color="primary"
              :disabled="busy"
              @click="open = false"
              >Abrir camada {{ result.layerId }} no mapa</v-btn
            >
            <v-btn
              v-if="result.status === 'CONCLUIDO' && result.rasterId !== null"
              :to="{ path: '/rasters', query: { raster: String(result.rasterId) } }"
              size="small"
              variant="tonal"
              color="primary"
              :disabled="busy"
              @click="open = false"
              >Consultar raster {{ result.rasterId }}</v-btn
            >
          </div>
        </section>
        <section class="treatment-history mt-5" aria-label="Histórico de tratamentos">
          <div class="d-flex align-center justify-space-between ga-3 mb-3">
            <h3 class="text-subtitle-1">Histórico · {{ totalElements }}</h3>
            <v-btn
              size="small"
              variant="text"
              prepend-icon="mdi-refresh"
              :loading="historyLoading"
              :disabled="busy || historyLoading"
              @click="loadHistory"
              >Atualizar</v-btn
            >
          </div>
          <v-progress-linear
            v-if="historyLoading"
            indeterminate
            aria-label="Carregando tratamentos"
          />
          <v-alert v-if="historyError" type="error" variant="tonal" role="alert"
            >{{ historyError
            }}<v-btn variant="text" @click="loadHistory">Tentar novamente</v-btn></v-alert
          >
          <p
            v-else-if="!historyLoading && !history.length"
            class="text-body-2 text-medium-emphasis py-4"
          >
            Nenhum tratamento registrado para este arquivo.
          </p>
          <article v-for="item in history" :key="item.id" class="execution">
            <div class="d-flex align-center flex-wrap ga-3">
              <strong>Execução {{ item.id }}</strong
              ><v-chip
                size="small"
                :color="
                  item.status === 'FALHOU'
                    ? 'error'
                    : item.status === 'CONCLUIDO'
                      ? 'success'
                      : 'primary'
                "
                >{{ treatmentStatus(item.status) }}</v-chip
              ><span class="text-caption text-medium-emphasis">{{
                processingDate(item.startedAt)
              }}</span>
            </div>
            <p class="text-body-2 mt-2">
              Entrada: versão ID {{ item.inputVersionId }} · Responsável ID {{ item.userId
              }}<template v-if="item.outputVersionId !== null">
                · Saída: versão ID {{ item.outputVersionId }}</template
              >
            </p>
            <p v-if="item.finishedAt" class="text-caption text-medium-emphasis mt-1">
              Finalizado em {{ processingDate(item.finishedAt) }}
            </p>
            <p
              v-if="item.inputCount !== null || item.outputCount !== null"
              class="text-body-2 mt-1"
            >
              {{ item.inputCount ?? '—' }} entrada(s) · {{ item.outputCount ?? '—' }} saída(s)
            </p>
            <v-alert
              v-if="item.error"
              type="error"
              variant="tonal"
              density="compact"
              class="mt-3"
              >{{ item.error }}</v-alert
            >
            <div class="d-flex flex-wrap ga-2 mt-3">
              <v-btn
                v-if="treatmentMapLocation(item) && can('map.read')"
                :to="treatmentMapLocation(item)!"
                variant="tonal"
                color="primary"
                size="small"
                prepend-icon="mdi-map-outline"
                :disabled="busy"
                @click="open = false"
                >Abrir camada {{ item.layerId }} no mapa</v-btn
              >
              <v-btn
                v-if="item.status === 'CONCLUIDO' && item.rasterId !== null"
                :to="{ path: '/rasters', query: { raster: String(item.rasterId) } }"
                variant="tonal"
                color="primary"
                size="small"
                prepend-icon="mdi-image-filter-hdr"
                :disabled="busy"
                @click="open = false"
                >Consultar raster {{ item.rasterId }}</v-btn
              >
            </div>
            <details v-if="item.parameters || item.provenance" class="mt-3">
              <summary class="text-caption">Parâmetros e rastreabilidade</summary>
              <pre>{{
                JSON.stringify(
                  { parameters: item.parameters, provenance: item.provenance },
                  null,
                  2,
                )
              }}</pre>
            </details>
          </article>
          <v-pagination
            v-if="totalPages > 1"
            :model-value="page + 1"
            :length="totalPages"
            :disabled="busy || historyLoading"
            :total-visible="5"
            aria-label="Páginas de tratamentos"
            @update:model-value="page = $event - 1"
          />
        </section>
      </v-card-text>
      <v-card-actions class="pa-4"
        ><v-spacer /><v-btn :disabled="busy" @click="open = false">Fechar</v-btn></v-card-actions
      >
    </v-card>
  </v-dialog>
</template>
<script setup lang="ts">
import { computed, toRef } from 'vue'
import { can } from '@/access/session'
import { useFileTreatment } from '@/composables/useFileTreatment'
import {
  processingDate,
  supportsTreatment,
  treatmentMapLocation,
  treatmentStatus,
  type TreatmentExecution,
  type TreatmentFile,
} from '@/services/processing'
const props = withDefaults(
  defineProps<{ file: TreatmentFile | null; initialDatasetId?: number | null }>(),
  { initialDatasetId: null },
)
const open = defineModel<boolean>({ default: false })
const emit = defineEmits<{ treated: [execution: TreatmentExecution] }>()
const target = computed(() => (open.value ? props.file : null))
const {
  history,
  result,
  page,
  totalPages,
  totalElements,
  historyLoading,
  historyError,
  actionError,
  busy,
  datasets,
  datasetId,
  datasetsLoading,
  datasetsError,
  checkingMembership,
  membershipError,
  associated,
  raster,
  canStart,
  loadHistory,
  loadDatasets,
  checkMembership,
  start,
} = useFileTreatment(target, toRef(props, 'initialDatasetId'))
async function run() {
  const execution = await start()
  if (execution) emit('treated', execution)
}
</script>
<style scoped>
.treatment-dialog {
  border-radius: 24px;
}
.treatment-panel {
  padding: 20px;
  border: 1px solid var(--glass-outer-border);
  border-radius: 18px;
  background: rgba(var(--v-theme-primary), 0.035);
}
.treatment-panel h3 {
  font-size: 16px;
}
.execution {
  padding: 18px 0;
  border-top: 1px solid var(--glass-outer-border);
}
pre {
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  font-size: 11px;
  max-height: 280px;
  overflow: auto;
  padding: 12px;
  background: rgba(var(--v-theme-background), 0.6);
  border-radius: 12px;
  margin-top: 8px;
}
</style>
