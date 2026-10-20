<template>
  <div class="workspace-page">
    <div class="workspace">
      <WorkspaceExplorer @remove-file="requestRemoval" />
      <main class="editor-area">
        <div class="editor-tabs">
          <v-tabs
            v-model="workspace.activeTab"
            density="compact"
            color="primary"
            aria-label="Visualizações do workspace"
            ><v-tab value="map" prepend-icon="mdi-map-outline">Mapa</v-tab
            ><v-tab value="meters" prepend-icon="mdi-gauge">Medidores</v-tab></v-tabs
          ><span class="active-dataset text-caption">{{
            workspace.selectedDataset?.name || 'Nenhum conjunto selecionado'
          }}</span>
        </div>
        <div class="editor-toolbar">
          <div v-if="workspace.activeTab === 'map'" class="d-flex flex-wrap ga-1">
            <v-btn
              size="small"
              variant="text"
              prepend-icon="mdi-fit-to-screen-outline"
              :disabled="!workspace.visibleLayerIds.length"
              @click="mapView?.fitVisibleLayers()"
              >Enquadrar camadas</v-btn
            ><v-btn size="small" variant="text" @click="mapView?.resetView()">Ver Paraná</v-btn>
          </div>
          <v-spacer />
          <v-btn
            v-if="can('ingestion.run')"
            to="/new-load"
            variant="outlined"
            size="small"
            prepend-icon="mdi-plus"
            >Nova ingestão</v-btn
          >
          <v-btn
            v-if="can('datasets.manage')"
            size="small"
            variant="outlined"
            prepend-icon="mdi-file-plus-outline"
            :disabled="
              workspace.selectedDatasetId === null ||
              workspace.loadingWorkspace ||
              workspace.membershipBusy
            "
            @click="showFiles = true"
            >Adicionar arquivos</v-btn
          >
          <v-btn
            size="small"
            variant="text"
            icon="mdi-refresh"
            aria-label="Atualizar conjunto selecionado"
            :loading="workspace.loadingWorkspace"
            :disabled="workspace.selectedDatasetId === null || workspace.membershipBusy"
            @click="workspace.refresh"
          />
        </div>
        <div class="workspace-messages" aria-live="polite">
          <v-progress-linear
            v-if="workspace.loadingWorkspace"
            indeterminate
            aria-label="Carregando conjunto"
          />
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
            v-if="workspace.selectedDatasetId === null"
            type="info"
            variant="tonal"
            density="compact"
            >Escolha um conjunto no explorador para visualizar seus arquivos.</v-alert
          >
          <v-alert
            v-else-if="!workspace.loadingWorkspace && workspace.structure && !workspace.fileCount"
            type="info"
            variant="tonal"
            density="compact"
            >Conjunto vazio. Os arquivos podem ser associados depois da ingestão.</v-alert
          >
          <v-alert
            v-else-if="
              !workspace.loadingWorkspace &&
              workspace.structure &&
              !workspace.availableReferences.length &&
              !workspace.referencesError
            "
            type="info"
            variant="tonal"
            density="compact"
            >Este conjunto tem arquivos, mas nenhuma referência de visualização disponível. Os
            arquivos continuam no explorador.</v-alert
          >
          <p class="validation-note">
            Prévia dos registros aprovados pela validação. Não representa tratamento concluído ou
            versão aprovada por um Gestor.
          </p>
        </div>
        <div class="editor-content">
          <WorkspaceMap
            v-show="workspace.activeTab === 'map'"
            ref="mapView"
            :visible="workspace.activeTab === 'map'"
          />
          <section
            v-if="workspace.activeTab === 'meters'"
            class="meters-empty"
            aria-label="Medidores"
          >
            <v-icon icon="mdi-gauge-empty" size="56" color="secondary" />
            <h2 class="text-h6 mt-4">Medidores ainda não disponíveis</h2>
            <p class="text-body-2 text-medium-emphasis mt-2">
              Os indicadores serão exibidos quando o serviço de cálculo estiver integrado. Nenhum
              indicador é calculado no navegador.
            </p>
          </section>
        </div>
      </main>
      <footer class="workspace-status">
        <span
          ><v-icon icon="mdi-database-outline" size="14" /> {{ workspace.fileCount }} arquivo(s) no
          conjunto</span
        ><span>{{ workspace.visibleLayerIds.length }} camada(s) ativa(s) · Paraná</span>
      </footer>
    </div>
    <WorkspaceFilesDialog v-if="can('datasets.manage')" v-model="showFiles" />
    <ConfirmDialog
      v-model="showRemoval"
      title="Remover vínculo do conjunto"
      :message="`Remover ${removal?.name || 'arquivo'} deste conjunto? O arquivo, suas versões e os vínculos com outros conjuntos serão preservados.`"
      @confirm="confirmRemoval"
    />
  </div>
</template>
<script setup lang="ts">
import { onBeforeMount, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { can } from '@/access/session'
import { useWorkspaceStore } from '@/stores/workspace'
import WorkspaceExplorer from '@/components/workspace/WorkspaceExplorer.vue'
import WorkspaceMap from '@/components/workspace/WorkspaceMap.vue'
import WorkspaceFilesDialog from '@/components/workspace/WorkspaceFilesDialog.vue'
import ConfirmDialog from '@/components/ConfirmDialog.vue'
const workspace = useWorkspaceStore(),
  route = useRoute()
const mapView = ref<InstanceType<typeof WorkspaceMap> | null>(null),
  showFiles = ref(false),
  showRemoval = ref(false)
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
    showFiles.value = false
    showRemoval.value = false
    removal.value = null
  },
)
onBeforeMount(() => workspace.invalidate())
onMounted(async () => {
  await workspace.loadDatasets()
  const requested = Number(route.query.dataset)
  if (Number.isInteger(requested) && workspace.datasets.some((d) => d.id === requested))
    await workspace.selectDataset(requested)
  else await workspace.refresh()
})
</script>
<style scoped>
.workspace-page {
  width: 100%;
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.workspace {
  display: grid;
  grid-template-columns: minmax(250px, 310px) minmax(0, 1fr);
  grid-template-rows: minmax(0, 1fr) auto;
  flex: 1;
  min-height: 0;
  background: rgb(var(--v-theme-background));
  overflow: hidden;
}
.editor-area {
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
}
.editor-tabs {
  display: flex;
  align-items: center;
  gap: 8px;
  border-bottom: 1px solid var(--glass-outer-border);
  background: rgba(var(--v-theme-background), 0.45);
}
.active-dataset {
  margin-left: auto;
  padding: 0 12px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.editor-toolbar {
  display: flex;
  gap: 4px;
  align-items: center;
  flex-wrap: wrap;
  padding: 6px 8px;
  min-height: 48px;
  border-bottom: 1px solid var(--glass-outer-border);
}
.workspace-messages {
  flex-shrink: 0;
}
.workspace-messages :deep(.v-alert) {
  border-radius: 0;
}
.validation-note {
  padding: 7px 12px;
  font-size: 11px;
  color: rgba(var(--v-theme-on-surface), 0.65);
}
.editor-content {
  flex: 1;
  min-height: 0;
  position: relative;
  overflow: hidden;
}
.editor-content > :deep(.map-shell) {
  height: 100%;
}
.meters-empty {
  display: flex;
  height: 100%;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  text-align: center;
  max-width: 440px;
  padding: 36px;
  margin: auto;
}
.workspace-status {
  grid-column: 1 / -1;
  display: flex;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 8px;
  padding: 5px 12px;
  font-size: 11px;
  color: rgb(var(--v-theme-primary));
  border-top: 1px solid var(--glass-outer-border);
  background: rgba(var(--v-theme-background), 0.55);
}
@media (max-width: 1000px) {
  .workspace {
    grid-template-columns: minmax(210px, 260px) minmax(0, 1fr);
  }
  .active-dataset {
    display: none;
  }
}
@media (max-width: 700px) {
  .workspace {
    grid-template-columns: 1fr;
    grid-template-rows: minmax(140px, 28%) minmax(0, 1fr) auto;
  }
  .workspace-status {
    grid-column: 1;
  }
}
</style>
