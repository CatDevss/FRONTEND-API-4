<template>
  <Teleport to="body">
    <Transition name="progress-popup">
      <aside
        v-if="progress"
        class="ingestion-progress"
        :class="[themeClasses, { 'is-collapsed': collapsed }]"
        aria-label="Progresso da ingestão"
        :aria-busy="running"
      >
        <header class="progress-header">
          <span class="progress-symbol" :class="`status-${progress.status}`"
            ><v-progress-circular
              v-if="running"
              indeterminate
              size="22"
              width="2"
              color="primary" /><v-icon v-else :icon="statusIcon" size="23"
          /></span>
          <div class="progress-heading">
            <p>{{ progress.kind === 'manual' ? 'ENVIO MANUAL' : 'COLETA AUTOMATIZADA' }}</p>
            <h2>{{ statusTitle }}</h2>
          </div>
          <v-btn
            v-if="running"
            :icon="collapsed ? 'mdi-chevron-down' : 'mdi-minus'"
            variant="text"
            size="x-small"
            :aria-label="
              collapsed ? 'Expandir progresso da ingestão' : 'Recolher progresso da ingestão'
            "
            :aria-expanded="!collapsed"
            @click="collapsed = !collapsed"
          />
          <v-btn
            v-else
            icon="mdi-close"
            variant="text"
            size="x-small"
            aria-label="Fechar progresso da ingestão"
            @click="clearIngestionProgress"
          />
        </header>
        <div v-if="!collapsed" class="progress-content">
          <p class="progress-context">{{ progress.title }}</p>
          <p class="progress-source">{{ progress.source }}</p>
          <div v-if="running" role="status" aria-live="polite">
            <div class="progress-stage">
              <span>{{ stageTitle }}</span
              ><strong
                v-if="
                  progress.kind === 'manual' &&
                  progress.stage === 'uploading' &&
                  progress.percent !== null
                "
                >{{ progress.percent }}%</strong
              ><span v-else class="elapsed" aria-live="off">{{ elapsed }}</span>
            </div>
            <v-progress-linear
              :model-value="progress.percent ?? 0"
              :indeterminate="
                progress.kind === 'automatic' ||
                progress.stage !== 'uploading' ||
                progress.percent === null
              "
              height="6"
              rounded
              color="primary"
              :aria-label="
                progress.kind === 'manual' && progress.stage === 'uploading'
                  ? 'Transferência do arquivo atual'
                  : stageTitle
              "
            />
            <p v-if="progress.fileName" class="progress-filename">{{ progress.fileName }}</p>
            <div v-if="progress.kind === 'manual'" class="progress-metrics">
              <span
                >{{ progress.completedCount }} de {{ progress.fileCount }} arquivo(s) com
                resposta</span
              ><span v-if="progress.totalBytes !== null"
                >{{ formatBytes(progress.loadedBytes ?? 0) }} /
                {{ formatBytes(progress.totalBytes) }}</span
              >
            </div>
            <p class="progress-description">
              {{
                progress.kind === 'automatic'
                  ? 'O servidor está coletando e validando os dados. Aguardando o resultado.'
                  : progress.stage === 'validating'
                    ? 'Transferência concluída. Aguardando validação e registro pelo backend.'
                    : 'A porcentagem acompanha a transferência deste arquivo. A validação termina após a resposta do servidor.'
              }}
            </p>
            <div class="progress-footer">
              <span aria-live="off">{{
                progress.kind === 'manual' ? elapsed : 'Execução no servidor'
              }}</span
              ><v-btn
                v-if="progress.kind === 'manual'"
                size="small"
                variant="text"
                color="error"
                :disabled="cancelling"
                @click="cancel"
                >{{ cancelling ? 'Interrompendo…' : 'Cancelar envio' }}</v-btn
              >
            </div>
          </div>
          <div v-else role="status" aria-live="polite">
            <p class="progress-message">{{ progress.message }}</p>
            <p class="progress-description">
              Duração: {{ elapsed }}. Confira o resultado da validação antes de utilizar os dados.
            </p>
            <div class="progress-result-actions">
              <v-btn
                v-if="
                  progress.fileId !== null &&
                  progress.status === 'attention' &&
                  can('quarantine.read')
                "
                :to="{ path: '/quarantine', query: { fileId: String(progress.fileId) } }"
                size="small"
                variant="tonal"
                color="primary"
                >Consultar quarentena</v-btn
              ><v-btn v-if="can('files.read')" to="/file-uploads" size="small" variant="text"
                >Ver arquivos</v-btn
              >
            </div>
          </div>
        </div>
      </aside>
    </Transition>
  </Teleport>
</template>
<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useTheme } from 'vuetify'
import { can } from '@/access/session'
import {
  ingestionProgress as progress,
  clearIngestionProgress,
} from '@/composables/ingestionProgress'
import { cancelUpload } from '@/composables/uploadLock'
const { themeClasses } = useTheme()
const collapsed = ref(false),
  cancelling = ref(false),
  now = ref(Date.now())
let timer: ReturnType<typeof setInterval> | undefined
const running = computed(() => progress.value?.status === 'running')
const elapsed = computed(() => {
  const p = progress.value
  const seconds = p
    ? Math.max(0, Math.floor(((p.finishedAt ?? now.value) - p.startedAt) / 1000))
    : 0
  return `${Math.floor(seconds / 60)
    .toString()
    .padStart(2, '0')}:${(seconds % 60).toString().padStart(2, '0')}`
})
const statusTitle = computed(
  () =>
    ({
      running: 'Ingestão em andamento',
      completed: 'Conteúdo integralmente válido',
      attention: 'Resultado requer atenção',
      error: 'Não foi possível concluir',
      cancelled: 'Acompanhamento interrompido',
    })[progress.value?.status ?? 'running'],
)
const statusIcon = computed(
  () =>
    ({
      completed: 'mdi-check-circle-outline',
      attention: 'mdi-alert-circle-outline',
      error: 'mdi-close-circle-outline',
      cancelled: 'mdi-stop-circle-outline',
      running: 'mdi-cloud-sync-outline',
    })[progress.value?.status ?? 'running'],
)
const stageTitle = computed(() =>
  progress.value?.kind === 'automatic'
    ? 'Coleta e validação em andamento'
    : progress.value?.stage === 'validating'
      ? 'Validando e registrando'
      : 'Transferindo arquivo',
)
function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  const unit = bytes < 1024 ** 2 ? 1024 : 1024 ** 2
  return `${new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 }).format(bytes / unit)} ${unit === 1024 ? 'KB' : 'MB'}`
}
function cancel() {
  if (cancelling.value) return
  cancelling.value = true
  cancelUpload()
}
watch(
  () => progress.value?.id,
  () => {
    collapsed.value = false
    cancelling.value = false
  },
)
watch(
  running,
  (active) => {
    clearInterval(timer)
    timer = undefined
    now.value = Date.now()
    if (active)
      timer = setInterval(() => {
        now.value = Date.now()
      }, 1000)
    else collapsed.value = false
  },
  { immediate: true },
)
onBeforeUnmount(() => clearInterval(timer))
</script>
<style scoped>
.ingestion-progress {
  position: fixed;
  top: max(18px, env(safe-area-inset-top));
  right: max(18px, env(safe-area-inset-right));
  z-index: 3000;
  width: min(390px, calc(100vw - 32px));
  border: 1px solid rgba(var(--v-theme-on-surface), 0.13);
  border-radius: 20px;
  background: rgba(var(--v-theme-surface), 0.97);
  color: rgb(var(--v-theme-on-surface));
  box-shadow: 0 16px 50px rgba(0, 0, 0, 0.35);
  backdrop-filter: blur(20px);
  overflow: hidden;
  max-height: calc(100dvh - 40px);
  overflow-y: auto;
}
.progress-header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px;
}
.progress-symbol {
  display: grid;
  place-items: center;
  width: 40px;
  height: 40px;
  flex-shrink: 0;
  border-radius: 13px;
  background: rgba(var(--v-theme-primary), 0.1);
  color: rgb(var(--v-theme-primary));
}
.status-completed {
  color: rgb(var(--v-theme-success));
  background: rgba(var(--v-theme-success), 0.1);
}
.status-error {
  color: rgb(var(--v-theme-error));
  background: rgba(var(--v-theme-error), 0.1);
}
.status-attention {
  color: rgb(var(--v-theme-warning));
  background: rgba(var(--v-theme-warning), 0.1);
}
.progress-heading {
  flex: 1;
  min-width: 0;
}
.progress-heading p {
  font-size: 9px;
  letter-spacing: 0.1em;
  opacity: 0.55;
}
.progress-heading h2 {
  font-size: 13px;
  font-weight: 600;
  margin-top: 4px;
}
.progress-content {
  padding: 0 18px 16px;
}
.progress-context {
  font-size: 13px;
  font-weight: 600;
  overflow-wrap: anywhere;
}
.progress-source {
  font-size: 11px;
  opacity: 0.6;
  margin-top: 4px;
}
.progress-stage {
  display: flex;
  justify-content: space-between;
  gap: 10px;
  font-size: 11px;
  margin: 20px 0 10px;
}
.progress-stage strong {
  color: rgb(var(--v-theme-primary));
}
.elapsed {
  font-variant-numeric: tabular-nums;
  opacity: 0.65;
}
.progress-filename {
  font-size: 12px;
  margin-top: 12px;
  overflow-wrap: anywhere;
}
.progress-metrics {
  display: flex;
  flex-wrap: wrap;
  gap: 6px 12px;
  justify-content: space-between;
  margin-top: 8px;
  font-size: 10px;
  opacity: 0.65;
}
.progress-description {
  font-size: 11px;
  line-height: 1.6;
  opacity: 0.65;
  margin-top: 12px;
}
.progress-footer {
  border-top: 1px solid var(--glass-outer-border);
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 14px;
  padding-top: 10px;
}
.progress-footer > span {
  font-size: 10px;
  opacity: 0.6;
}
.progress-message {
  font-size: 12px;
  line-height: 1.7;
  margin-top: 16px;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}
.progress-result-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 14px;
}
.progress-content :deep(.v-btn) {
  font-size: 11px;
  letter-spacing: 0;
  text-transform: none;
  border-radius: 10px;
}
.progress-popup-enter-active,
.progress-popup-leave-active {
  transition:
    opacity 0.2s ease,
    transform 0.2s ease;
}
.progress-popup-enter-from,
.progress-popup-leave-to {
  opacity: 0;
  transform: translateX(24px);
}
@media (prefers-reduced-motion: reduce) {
  .progress-popup-enter-active,
  .progress-popup-leave-active {
    transition: none;
  }
}
</style>
