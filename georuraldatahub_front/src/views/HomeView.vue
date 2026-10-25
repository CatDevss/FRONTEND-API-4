<template>
  <div class="workspace-page">
    <div
      ref="workspaceElement"
      class="workspace"
      :class="{
        'explorer-hidden': !explorerOpen,
        'showing-meters': workspace.activeTab === 'meters',
      }"
    >
      <div class="map-surface">
        <WorkspaceMap
          v-show="workspace.activeTab === 'map'"
          ref="mapView"
          :visible="workspace.activeTab === 'map'"
          :insets="overlayInsets"
        />
      </div>
      <div class="workspace-overlays">
        <header ref="toolbarElement" class="workspace-toolbar floating-panel">
          <div class="workspace-navigation">
            <v-btn
              :icon="explorerOpen ? 'mdi-dock-left' : 'mdi-file-tree-outline'"
              size="small"
              variant="text"
              :aria-label="explorerOpen ? 'Ocultar explorador' : 'Mostrar explorador'"
              :title="explorerOpen ? 'Ocultar explorador' : 'Mostrar explorador'"
              :aria-expanded="explorerOpen"
              aria-controls="workspace-explorer"
              @click="explorerOpen = !explorerOpen"
            />
            <v-tabs
              v-model="workspace.activeTab"
              class="editor-tabs"
              density="compact"
              color="primary"
              hide-slider
              aria-label="Visualizações do workspace"
            >
              <v-tab value="map" prepend-icon="mdi-map-outline">Mapa</v-tab>
              <v-tab value="meters" prepend-icon="mdi-gauge">Medidores</v-tab>
            </v-tabs>
          </div>
          <div class="dataset-context">
            <span class="context-label">CONJUNTO SELECIONADO</span>
            <span class="active-dataset" :title="workspace.selectedDataset?.name">{{
              workspace.selectedDataset?.name || 'Escolha um conjunto'
            }}</span>
          </div>
          <div class="workspace-actions">
            <v-btn
              v-if="can('ingestion.run')"
              to="/new-load"
              variant="text"
              size="small"
              aria-label="Nova ingestão"
              title="Nova ingestão"
            >
              <v-icon icon="mdi-plus" start /><span class="action-label">Nova ingestão</span>
            </v-btn>
            <v-btn
              v-if="can('datasets.manage')"
              size="small"
              variant="tonal"
              color="primary"
              aria-label="Adicionar arquivos"
              title="Adicionar arquivos"
              :disabled="
                workspace.selectedDatasetId === null ||
                workspace.loadingWorkspace ||
                workspace.membershipBusy
              "
              @click="showFiles = true"
            >
              <v-icon icon="mdi-file-plus-outline" start /><span class="action-label"
                >Adicionar arquivos</span
              >
            </v-btn>
            <v-btn
              size="small"
              variant="text"
              icon="mdi-refresh"
              aria-label="Atualizar conjunto selecionado"
              title="Atualizar conjunto selecionado"
              :loading="workspace.loadingWorkspace"
              :disabled="workspace.selectedDatasetId === null || workspace.membershipBusy"
              @click="workspace.refresh"
            />
          </div>
          <v-progress-linear
            v-if="workspace.loadingWorkspace"
            class="workspace-progress"
            indeterminate
            color="primary"
            height="2"
            aria-label="Carregando conjunto"
          />
        </header>

        <div
          id="workspace-explorer"
          ref="explorerElement"
          v-show="explorerOpen"
          class="explorer-position"
        >
          <WorkspaceExplorer
            @close="explorerOpen = false"
            @remove-file="requestRemoval"
            @treat-file="showTreatment"
          />
        </div>

        <main class="workspace-content">
          <div class="workspace-messages" aria-live="polite">
            <v-progress-linear
              v-if="openingTreatment"
              indeterminate
              aria-label="Abrindo camada tratada"
            />
            <v-alert v-if="treatmentError" type="error" variant="tonal" density="compact">{{
              treatmentError
            }}</v-alert>
            <v-alert
              v-if="workspace.membershipError"
              type="error"
              variant="tonal"
              density="compact"
              >{{ workspace.membershipError }}</v-alert
            >
            <v-alert v-if="workspace.referencesError" type="error" variant="tonal" density="compact"
              >{{ workspace.referencesError
              }}<v-btn size="small" variant="text" @click="workspace.refresh"
                >Tentar novamente</v-btn
              ></v-alert
            >
            <v-alert
              v-if="!explorerOpen && (workspace.datasetsError || workspace.structureError)"
              type="error"
              variant="tonal"
              density="compact"
              >{{ workspace.datasetsError || workspace.structureError
              }}<v-btn size="small" variant="text" @click="retryWorkspace"
                >Tentar novamente</v-btn
              ></v-alert
            >
            <template v-if="!explorerOpen">
              <v-alert
                v-for="failure in layerFailures"
                :key="failure.id"
                type="error"
                variant="tonal"
                density="compact"
                >{{ failure.name }}: {{ failure.error }}</v-alert
              >
            </template>
            <div v-if="workspace.selectedDatasetId === null" class="workspace-hint floating-panel">
              <span class="hint-icon"><v-icon icon="mdi-folder-open-outline" size="22" /></span>
              <div>
                <h2>Seus dados, no mapa</h2>
                <p>Escolha um conjunto no explorador para visualizar seus arquivos.</p>
                <v-btn v-if="!explorerOpen" size="small" variant="text" @click="explorerOpen = true"
                  >Abrir explorador</v-btn
                >
              </div>
            </div>
            <div
              v-else-if="!workspace.loadingWorkspace && workspace.structure && !workspace.fileCount"
              class="workspace-hint floating-panel"
            >
              <span class="hint-icon"><v-icon icon="mdi-folder-plus-outline" size="22" /></span>
              <div>
                <h2>Conjunto vazio</h2>
                <p>Os arquivos podem ser associados depois da ingestão.</p>
              </div>
            </div>
            <div
              v-else-if="
                !workspace.loadingWorkspace &&
                workspace.structure &&
                !workspace.availableReferences.length &&
                !workspace.referencesError
              "
              class="workspace-hint floating-panel"
            >
              <span class="hint-icon"><v-icon icon="mdi-layers-off-outline" size="22" /></span>
              <div>
                <h2>Sem camadas disponíveis</h2>
                <p>
                  Este conjunto tem arquivos, mas nenhuma referência de visualização disponível. Os
                  arquivos continuam no explorador.
                </p>
              </div>
            </div>
          </div>
          <section
            v-if="workspace.activeTab === 'meters'"
            class="meters-empty floating-panel"
            aria-label="Medidores"
          >
            <span class="meters-icon"><v-icon icon="mdi-gauge" size="32" /></span>
            <span class="context-label mt-4">INDICADORES AMBIENTAIS</span>
            <h2 class="text-h6 mt-2">Medidores ainda não disponíveis</h2>
            <p class="text-body-2 text-medium-emphasis mt-2">
              Os indicadores serão exibidos quando o serviço de cálculo estiver integrado. Nenhum
              indicador é calculado no navegador.
            </p>
          </section>
        </main>

        <footer ref="footerElement" class="workspace-footer">
          <div
            v-if="workspace.activeTab === 'map'"
            class="map-tools floating-panel"
            role="group"
            aria-label="Enquadramento do mapa"
          >
            <v-btn
              size="small"
              variant="text"
              prepend-icon="mdi-fit-to-screen-outline"
              :disabled="!workspace.visibleLayerIds.length"
              @click="mapView?.fitVisibleLayers()"
              >Enquadrar camadas</v-btn
            >
            <span class="tool-divider" />
            <v-btn
              size="small"
              variant="text"
              prepend-icon="mdi-crosshairs-gps"
              @click="mapView?.resetView()"
              >Ver Paraná</v-btn
            >
          </div>
          <div class="workspace-status floating-panel" role="status">
            <span class="status-metric"
              ><v-icon icon="mdi-file-outline" size="14" />
              {{ workspace.fileCount }} arquivo(s)</span
            >
            <span class="status-metric"
              ><v-icon icon="mdi-layers-outline" size="14" />
              {{ workspace.visibleLayerIds.length }} camada(s) ativa(s)</span
            >
            <span v-if="loadingLayers" class="status-metric"
              ><v-progress-circular indeterminate size="12" width="2" color="primary" />Carregando
              camadas</span
            >
            <span v-else class="scope-label">Paraná</span>
          </div>
          <p class="validation-note floating-panel">
            <v-icon icon="mdi-information-outline" size="14" /><span
              >As referências por arquivo mostram a visualização mais recente. Resultados de
              tratamento são identificados pela camada e versão no explorador. A exibição no mapa
              não significa publicação ou versão aprovada por um Gestor.</span
            >
          </p>
        </footer>
      </div>
    </div>
    <WorkspaceFilesDialog v-if="can('datasets.manage')" v-model="showFiles" />
    <FileTreatmentDialog
      v-if="treatmentDialog"
      v-model="treatmentDialog"
      :file="treatmentFile"
      :initial-dataset-id="workspace.selectedDatasetId"
      @treated="onTreated"
    />
    <ConfirmDialog
      v-model="showRemoval"
      title="Remover vínculo do conjunto"
      :message="`Remover ${removal?.name || 'arquivo'} deste conjunto? O arquivo, suas versões e os vínculos com outros conjuntos serão preservados.`"
      @confirm="confirmRemoval"
    />
  </div>
</template>
<script setup lang="ts">
import { computed, nextTick, onBeforeMount, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { can } from '@/access/session'
import { useWorkspaceStore } from '@/stores/workspace'
import WorkspaceExplorer from '@/components/workspace/WorkspaceExplorer.vue'
import WorkspaceMap from '@/components/workspace/WorkspaceMap.vue'
import WorkspaceFilesDialog from '@/components/workspace/WorkspaceFilesDialog.vue'
import ConfirmDialog from '@/components/ConfirmDialog.vue'
import FileTreatmentDialog from '@/components/FileTreatmentDialog.vue'
import axios from 'axios'
import { apiError, layerKey } from '@/services/contracts'
import { positiveId, type TreatmentExecution, type TreatmentFile } from '@/services/processing'
const treatmentDialog = ref(false),
  treatmentFile = ref<TreatmentFile | null>(null)
function showTreatment(file: TreatmentFile) {
  treatmentFile.value = file
  treatmentDialog.value = true
}
const treatmentError = ref(''),
  openingTreatment = ref(false)
let treatmentEpoch = 0,
  pageDisposed = false
const workspace = useWorkspaceStore(),
  route = useRoute()
const mapView = ref<InstanceType<typeof WorkspaceMap> | null>(null),
  explorerOpen = ref(true),
  showFiles = ref(false),
  showRemoval = ref(false)
const workspaceElement = ref<HTMLElement | null>(null),
  toolbarElement = ref<HTMLElement | null>(null),
  explorerElement = ref<HTMLElement | null>(null),
  footerElement = ref<HTMLElement | null>(null)
const overlayInsets = ref({ top: 0, right: 0, bottom: 0, left: 0 })
const loadingLayers = computed(
  () => Object.values(workspace.runtime).filter((layer) => layer.loading).length,
)
const layerFailures = computed(() =>
  Object.entries(workspace.runtime)
    .filter(([, layer]) => layer.error)
    .map(([id, layer]) => ({
      id,
      error: layer.error,
      name:
        workspace.availableReferences.find((r) => layerKey(r) === Number(id))?.name ??
        `Referência ${id}`,
    })),
)
let overlayObserver: ResizeObserver | null = null
function measureOverlays() {
  const area = workspaceElement.value?.getBoundingClientRect()
  if (!area?.width || !area.height) return
  const toolbar = toolbarElement.value?.getBoundingClientRect(),
    footer = footerElement.value?.getBoundingClientRect(),
    explorer = explorerOpen.value ? explorerElement.value?.getBoundingClientRect() : null
  const bottomPanel = explorer && explorer.width > area.width * 0.65
  overlayInsets.value = {
    top: toolbar ? Math.max(0, toolbar.bottom - area.top) : 0,
    right: 64,
    left: explorer && !bottomPanel ? Math.max(0, explorer.right - area.left) : 0,
    bottom: bottomPanel
      ? Math.max(0, area.bottom - explorer.top)
      : footer
        ? Math.max(0, area.bottom - footer.top)
        : 0,
  }
}
async function retryWorkspace() {
  await workspace.loadDatasets()
  await workspace.refresh()
}
watch(explorerOpen, async () => {
  await nextTick()
  measureOverlays()
})
const removal = ref<{ id: number; name: string; datasetId: number } | null>(null)
function requestRemoval(file: { id: number; name: string; datasetId: number }) {
  removal.value = file
  showRemoval.value = true
}
async function confirmRemoval() {
  if (removal.value)
    await workspace.changeMembership(removal.value.id, false, removal.value.datasetId)
  removal.value = null
}
watch(
  () => workspace.selectedDatasetId,
  () => {
    ++treatmentEpoch
    openingTreatment.value = false
    treatmentError.value = ''
    treatmentDialog.value = false
    showFiles.value = false
    showRemoval.value = false
    removal.value = null
  },
)
async function onTreated(execution: TreatmentExecution) {
  const datasetId = workspace.selectedDatasetId
  if (datasetId === null) return
  await workspace.refresh()
  if (!pageDisposed && workspace.selectedDatasetId === datasetId)
    workspace.registerTreatment(execution)
}
async function openRequestedTreatment() {
  const id = Number(route.query.treatment),
    datasetId = workspace.selectedDatasetId
  const current = ++treatmentEpoch,
    revision = workspace.revision
  treatmentError.value = ''
  openingTreatment.value = false
  if (!Number.isSafeInteger(id) || id <= 0 || datasetId === null) return
  openingTreatment.value = true
  try {
    const { data } = await axios.get<TreatmentExecution>(`/tratamentos/${id}`)
    if (
      pageDisposed ||
      current !== treatmentEpoch ||
      revision !== workspace.revision ||
      datasetId !== workspace.selectedDatasetId
    )
      return
    if (!positiveId(data.layerId) || !workspace.registerTreatment(data))
      treatmentError.value =
        'Este tratamento não disponibiliza uma camada concluída vinculada ao conjunto selecionado.'
  } catch (error) {
    if (!pageDisposed && current === treatmentEpoch)
      treatmentError.value = apiError(error, 'Não foi possível abrir a camada deste tratamento.')
  } finally {
    if (!pageDisposed && current === treatmentEpoch) openingTreatment.value = false
  }
}
let initialized = false
watch(
  () => [route.query.dataset, route.query.treatment],
  async () => {
    if (!initialized) return
    const datasetId = Number(route.query.dataset)
    if (Number.isSafeInteger(datasetId) && workspace.datasets.some((d) => d.id === datasetId))
      await workspace.selectDataset(datasetId)
    await openRequestedTreatment()
  },
)
onBeforeMount(() => workspace.invalidate())
onMounted(async () => {
  if (typeof ResizeObserver !== 'undefined') {
    overlayObserver = new ResizeObserver(measureOverlays)
    for (const element of [
      workspaceElement.value,
      toolbarElement.value,
      explorerElement.value,
      footerElement.value,
    ])
      if (element) overlayObserver.observe(element)
  }
  window.addEventListener('resize', measureOverlays)
  measureOverlays()
  await workspace.loadDatasets()
  const requested = Number(route.query.dataset)
  if (Number.isInteger(requested) && workspace.datasets.some((d) => d.id === requested))
    await workspace.selectDataset(requested)
  else await workspace.refresh()
  if (pageDisposed) return
  initialized = true
  await openRequestedTreatment()
})
onBeforeUnmount(() => {
  pageDisposed = true
  ++treatmentEpoch
  overlayObserver?.disconnect()
  window.removeEventListener('resize', measureOverlays)
})
</script>
<style scoped>
.workspace-page {
  width: 100%;
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}
.workspace {
  position: relative;
  isolation: isolate;
  flex: 1;
  min-height: 0;
  overflow: hidden;
  container-type: inline-size;
  background: rgb(var(--v-theme-background));
}
.map-surface {
  position: absolute;
  inset: 0;
  z-index: 0;
}
.map-surface > :deep(.map-shell) {
  height: 100%;
}
.workspace-overlays {
  position: relative;
  z-index: 2;
  height: 100%;
  display: grid;
  grid-template-columns: clamp(270px, 28%, 330px) minmax(0, 1fr);
  grid-template-rows: auto minmax(0, 1fr) auto;
  gap: 14px;
  padding: 16px 16px 40px;
  pointer-events: none;
}
.floating-panel {
  border: 1px solid rgba(var(--v-theme-on-surface), 0.1);
  border-radius: 18px;
  background: rgba(var(--v-theme-surface), 0.96);
  color: rgb(var(--v-theme-on-surface));
  box-shadow: 0 8px 28px rgba(0, 0, 0, 0.2);
  backdrop-filter: blur(16px);
}
.workspace-toolbar {
  grid-column: 1 / -1;
  position: relative;
  display: flex;
  align-items: center;
  gap: 16px;
  flex-wrap: wrap;
  padding: 8px 12px;
  pointer-events: auto;
  overflow: hidden;
}
.workspace-navigation {
  display: flex;
  align-items: center;
  gap: 8px;
}
.editor-tabs {
  flex: none;
  background: rgba(var(--v-theme-background), 0.45);
  border-radius: 12px;
  padding: 3px;
  height: 40px;
}
.editor-tabs :deep(.v-tab) {
  height: 34px;
  min-width: 84px;
  border-radius: 9px;
  font-size: 12px;
  letter-spacing: 0;
  text-transform: none;
}
.editor-tabs :deep(.v-tab--selected) {
  background: rgba(var(--v-theme-primary), 0.14);
}
.dataset-context {
  display: grid;
  gap: 3px;
  flex: 1;
  min-width: 120px;
}
.context-label {
  font-size: 9px;
  letter-spacing: 0.12em;
  font-weight: 600;
  color: rgba(var(--v-theme-on-surface), 0.5);
}
.active-dataset {
  font-size: 12px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 250px;
}
.workspace-actions {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-left: auto;
}
.workspace-actions :deep(.v-btn),
.map-tools :deep(.v-btn) {
  border-radius: 10px;
  font-size: 11px;
  letter-spacing: 0;
  text-transform: none;
}
.workspace-progress {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
}
.explorer-position {
  grid-column: 1;
  grid-row: 2;
  display: flex;
  min-height: 0;
  min-width: 0;
  pointer-events: auto;
}
.explorer-position > :deep(.explorer) {
  width: 100%;
}
.workspace-content {
  grid-column: 2;
  grid-row: 2;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 14px;
  min-height: 0;
  min-width: 0;
}
.workspace-messages {
  display: flex;
  flex-direction: column;
  gap: 10px;
  width: min(100%, 420px);
  max-height: 100%;
  overflow: auto;
  border-radius: 18px;
  scrollbar-width: thin;
  pointer-events: auto;
}
.workspace-messages:empty {
  display: none;
}
.workspace-messages :deep(.v-alert) {
  border-radius: 16px;
  background: rgba(var(--v-theme-surface), 0.97);
  box-shadow: 0 8px 28px rgba(0, 0, 0, 0.2);
  flex-shrink: 0;
}
.workspace-hint {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 18px;
}
.hint-icon,
.meters-icon {
  display: grid;
  place-items: center;
  flex-shrink: 0;
  width: 42px;
  height: 42px;
  border-radius: 13px;
  background: rgba(var(--v-theme-primary), 0.1);
  color: rgb(var(--v-theme-primary));
}
.workspace-hint h2 {
  font-size: 13px;
  font-weight: 600;
  margin-bottom: 5px;
}
.workspace-hint p {
  font-size: 12px;
  line-height: 1.65;
  color: rgba(var(--v-theme-on-surface), 0.65);
}
.meters-empty {
  min-height: 0;
  width: min(100%, 480px);
  margin: auto;
  display: flex;
  align-items: center;
  flex-direction: column;
  text-align: center;
  padding: 32px;
  overflow: auto;
  pointer-events: auto;
}
.meters-icon {
  width: 64px;
  height: 64px;
  border-radius: 20px;
}
.workspace-footer {
  grid-column: 1 / -1;
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px 12px;
  justify-self: start;
  min-width: 0;
  max-width: calc(100% - 100px);
}
.map-tools {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 4px;
  padding: 5px;
  pointer-events: auto;
}
.tool-divider {
  width: 1px;
  height: 18px;
  background: var(--glass-outer-border);
}
.workspace-status {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 12px 14px;
  font-size: 10px;
}
.status-metric {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  color: rgba(var(--v-theme-on-surface), 0.7);
}
.scope-label {
  color: rgb(var(--v-theme-primary));
}
.validation-note {
  display: flex;
  align-items: flex-start;
  gap: 7px;
  padding: 9px 12px;
  font-size: 10px;
  color: rgba(var(--v-theme-on-surface), 0.65);
  flex-basis: 100%;
  max-width: 660px;
  line-height: 1.5;
}
.validation-note :deep(.v-icon) {
  flex: none;
  margin-top: 1px;
}
.explorer-hidden .workspace-overlays {
  grid-template-columns: minmax(0, 1fr);
}
.explorer-hidden .workspace-content {
  grid-column: 1;
}
.showing-meters .map-surface {
  background: radial-gradient(
    ellipse at 65% 45%,
    rgba(var(--v-theme-primary), 0.06),
    transparent 65%
  );
}
@container (max-width: 1050px) {
  .dataset-context {
    display: none;
  }
  .explorer-hidden .dataset-context {
    display: grid;
    order: 3;
    flex-basis: 100%;
    min-width: 0;
    padding: 0 6px 4px;
  }
}
@container (max-width: 760px) {
  .workspace-overlays {
    padding: 12px 12px 36px;
    gap: 10px;
    grid-template-columns: minmax(0, 1fr);
    grid-template-rows: auto minmax(0, 1fr) auto auto;
  }
  .workspace-toolbar {
    padding: 6px 8px;
    gap: 8px;
  }
  .workspace-navigation {
    gap: 4px;
  }
  .workspace-actions {
    gap: 2px;
  }
  .workspace-actions .action-label {
    display: none;
  }
  .workspace-actions :deep(.v-btn:not(.v-btn--icon)) {
    min-width: 32px;
    padding: 0 8px;
  }
  .workspace-actions :deep(.v-icon--start) {
    margin: 0;
  }
  .editor-tabs :deep(.v-tab) {
    min-width: 64px;
    font-size: 11px;
  }
  .workspace-content {
    grid-column: 1;
    grid-row: 2;
  }
  .explorer-position {
    grid-column: 1;
    grid-row: 3;
    max-height: min(32dvh, 260px);
  }
  .workspace-footer {
    grid-row: 4;
    max-width: calc(100% - 58px);
    gap: 6px;
  }
  .workspace-status {
    padding: 8px 10px;
    gap: 10px;
  }
  .map-tools {
    gap: 0;
  }
  .map-tools :deep(.v-btn) {
    font-size: 10px;
  }
  .validation-note {
    font-size: 9px;
    padding: 7px 10px;
  }
  .explorer-hidden .workspace-overlays {
    grid-template-rows: auto minmax(0, 1fr) auto;
  }
  .explorer-hidden .workspace-footer {
    grid-row: 3;
  }
  .meters-empty {
    padding: 20px;
  }
  .workspace-hint {
    padding: 14px;
  }
}
@container (max-width: 430px) {
  .workspace-toolbar {
    gap: 4px;
  }
  .workspace-navigation {
    flex: 1;
  }
  .workspace-actions {
    width: 100%;
    justify-content: flex-end;
  }
  .validation-note {
    max-height: 60px;
    overflow: auto;
    pointer-events: auto;
  }
  .workspace-status {
    flex-wrap: wrap;
  }
}
</style>
