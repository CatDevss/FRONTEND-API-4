<template>
  <aside class="explorer" aria-label="Explorador de conjuntos">
    <div class="explorer-heading">
      <div class="explorer-brand">
        <span class="explorer-mark"><v-icon icon="mdi-file-tree-outline" size="17" /></span
        ><span>Explorador</span
        ><span class="collection-count" :aria-label="`${workspace.datasets.length} conjuntos`">{{
          workspace.datasets.length
        }}</span>
      </div>
      <v-btn
        icon="mdi-refresh"
        size="x-small"
        variant="text"
        aria-label="Atualizar conjuntos"
        title="Atualizar conjuntos"
        :loading="workspace.loadingDatasets"
        :disabled="workspace.membershipBusy || workspace.loadingDatasets"
        @click="refreshAll"
      />
    </div>
    <v-alert
      v-if="workspace.datasetsError"
      type="error"
      variant="tonal"
      density="compact"
      class="ma-2"
      >{{ workspace.datasetsError }}</v-alert
    >
    <v-progress-linear v-if="workspace.loadingDatasets" indeterminate color="primary" height="2" />
    <div
      v-if="!workspace.loadingDatasets && !workspace.datasetsError && !workspace.datasets.length"
      class="explorer-empty"
    >
      <v-icon icon="mdi-folder-open-outline" size="30" />
      <p>Nenhum conjunto cadastrado.</p>
      <v-btn v-if="can('datasets.manage')" to="/datasets" variant="text" size="small"
        >Criar conjunto</v-btn
      >
    </div>
    <div class="tree-scroll">
      <div v-for="dataset in workspace.datasets" :key="dataset.id" class="dataset-node">
        <button
          class="tree-row dataset-row"
          :class="{ selected: workspace.selectedDatasetId === dataset.id }"
          :title="dataset.name"
          :aria-expanded="workspace.selectedDatasetId === dataset.id && rootOpen"
          :disabled="workspace.membershipBusy || workspace.loadingDatasets"
          @click="openDataset(dataset.id)"
        >
          <v-icon class="node-chevron" icon="mdi-chevron-right" size="16" />
          <v-icon
            class="dataset-icon"
            :icon="
              workspace.selectedDatasetId === dataset.id && rootOpen
                ? 'mdi-folder-open-outline'
                : 'mdi-folder-outline'
            "
            size="18"
          />
          <span class="node-label">{{ dataset.name }}</span>
        </button>
        <div v-if="workspace.selectedDatasetId === dataset.id && rootOpen" class="dataset-children">
          <v-progress-linear
            v-if="workspace.loadingWorkspace"
            indeterminate
            color="primary"
            height="2"
            aria-label="Carregando estrutura"
          />
          <v-alert
            v-if="workspace.structureError"
            type="error"
            variant="tonal"
            density="compact"
            class="ma-2"
            >{{ workspace.structureError
            }}<v-btn variant="text" size="small" @click="workspace.refresh"
              >Tentar novamente</v-btn
            ></v-alert
          >
          <p
            v-if="workspace.structure && !workspace.loadingWorkspace && !workspace.fileCount"
            class="tree-empty dataset-empty"
          >
            Conjunto vazio. Associe arquivos já recebidos pelas fontes.
          </p>
          <details
            v-for="source in workspace.structure?.sources"
            :key="source.id"
            open
            class="source-node"
          >
            <summary class="tree-row source-row" :title="source.url">
              <v-icon class="node-chevron" icon="mdi-chevron-right" size="14" /><v-icon
                class="source-icon"
                icon="mdi-database-outline"
                size="16"
              /><span class="node-label">{{ source.name }}</span>
            </summary>
            <details v-for="file in source.files" :key="file.id" open class="file-node">
              <summary class="tree-row file-row">
                <v-icon class="node-chevron" icon="mdi-chevron-right" size="14" />
                <v-icon
                  class="file-icon"
                  :class="fileKind(file.formatFile)"
                  :icon="fileIcon(file.formatFile)"
                  size="16"
                />
                <span
                  class="node-label file-label"
                  :title="`${file.name} · Dicionário ${file.dictionaryId}, versão ${file.dictionaryVersion}`"
                  >{{ file.name }}</span
                >
                <span class="format-badge">{{ file.formatFile }}</span>
                <v-btn
                  v-if="can('datasets.manage')"
                  icon="mdi-link-off"
                  size="x-small"
                  variant="text"
                  :disabled="workspace.membershipBusy || workspace.loadingDatasets"
                  class="remove-link"
                  :aria-label="`Remover vínculo de ${file.name}`"
                  title="Remover apenas o vínculo"
                  @click.stop.prevent="
                    $emit('removeFile', { id: file.id, name: file.name, datasetId: dataset.id })
                  "
                />
              </summary>
              <p v-if="!file.layers.length" class="tree-empty no-layer">
                <v-icon icon="mdi-layers-off-outline" size="13" />Sem referência de visualização
              </p>
              <div
                v-for="layer in file.layers"
                :key="layer.fileId"
                class="layer-node"
                :class="{
                  'is-visible': workspace.isVisible(layer.fileId),
                  'has-error': !!workspace.runtime[layer.fileId]?.error,
                }"
                :style="{ '--layer-color': workspace.colorFor(layer.fileId) }"
              >
                <div class="layer-row">
                  <v-checkbox-btn
                    :model-value="workspace.isVisible(layer.fileId)"
                    :color="workspace.colorFor(layer.fileId)"
                    :disabled="!available(layer.fileId) || workspace.loadingWorkspace"
                    :aria-label="`Exibir camada ${layer.name}`"
                    density="compact"
                    @update:model-value="workspace.setVisibility(layer.fileId, !!$event)"
                  />
                  <v-icon
                    icon="mdi-layers-outline"
                    size="15"
                    :color="workspace.colorFor(layer.fileId)"
                  />
                  <span class="layer-name" :title="layer.name">{{ layer.name }}</span>
                  <v-progress-circular
                    v-if="workspace.runtime[layer.fileId]?.loading"
                    indeterminate
                    size="13"
                    width="2"
                    :color="workspace.colorFor(layer.fileId)"
                  />
                </div>
                <p v-if="workspace.runtime[layer.fileId]?.error" class="layer-error" role="alert">
                  {{ workspace.runtime[layer.fileId]?.error }}
                </p>
                <p
                  v-else-if="!available(layer.fileId) && !workspace.loadingWorkspace"
                  class="layer-meta"
                >
                  Referência indisponível
                </p>
                <p v-else-if="workspace.runtime[layer.fileId]?.loading" class="layer-meta">
                  Carregando geometria…
                </p>
                <p
                  v-else-if="
                    workspace.runtime[layer.fileId]?.featureCount !== null &&
                    workspace.runtime[layer.fileId]?.featureCount !== undefined
                  "
                  class="layer-meta"
                >
                  <span class="status-dot" />{{ workspace.runtime[layer.fileId]?.featureCount }}
                  feições
                </p>
                <p v-else class="layer-meta">Camada de visualização</p>
                <div v-if="workspace.isVisible(layer.fileId)" class="layer-controls">
                  <span>Opacidade</span
                  ><v-slider
                    :model-value="workspace.getOpacity(layer.fileId)"
                    :color="workspace.colorFor(layer.fileId)"
                    min="0.1"
                    max="1"
                    step="0.05"
                    :thumb-size="10"
                    :track-size="2"
                    density="compact"
                    hide-details
                    :aria-label="`Opacidade de ${layer.name}`"
                    @update:model-value="workspace.setOpacity(layer.fileId, Number($event))"
                  />
                </div>
              </div>
            </details>
          </details>
        </div>
      </div>
    </div>
    <div class="explorer-footer">
      <v-btn
        v-if="can('datasets.manage')"
        to="/datasets"
        size="small"
        variant="text"
        prepend-icon="mdi-folder-plus-outline"
        class="manage-button"
        block
        >Gerenciar conjuntos</v-btn
      >
      <p class="explorer-hint">
        <v-icon icon="mdi-layers-outline" size="13" />Ative as camadas para explorar o mapa
      </p>
    </div>
  </aside>
</template>
<script setup lang="ts">
import { ref, watch } from 'vue'
import { can } from '@/access/session'
import { useWorkspaceStore } from '@/stores/workspace'
const workspace = useWorkspaceStore(),
  rootOpen = ref(true)
defineEmits<{ removeFile: [file: { id: number; name: string; datasetId: number }] }>()
watch(
  () => workspace.selectedDatasetId,
  () => {
    rootOpen.value = true
  },
)
function fileIcon(format: string) {
  const type = format.toLowerCase()
  return type === 'csv'
    ? 'mdi-file-delimited-outline'
    : ['geojson', 'json'].includes(type)
      ? 'mdi-code-json'
      : 'mdi-file-outline'
}
function fileKind(format: string) {
  const type = format.toLowerCase()
  return type === 'csv' ? 'tabular' : ['geojson', 'json'].includes(type) ? 'spatial' : 'other'
}
function available(id: number) {
  return workspace.availableReferences.some((r) => r.fileId === id)
}
function openDataset(id: number) {
  if (workspace.selectedDatasetId === id) rootOpen.value = !rootOpen.value
  else {
    rootOpen.value = true
    void workspace.selectDataset(id)
  }
}
async function refreshAll() {
  await workspace.loadDatasets()
  await workspace.refresh()
}
</script>
<style scoped>
.explorer {
  --tree-line: rgba(var(--v-theme-on-surface), 0.09);
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
  background: linear-gradient(
    180deg,
    rgba(var(--v-theme-surface), 0.96),
    rgba(var(--v-theme-background), 0.9)
  );
  border-right: 1px solid var(--glass-outer-border);
}
.explorer-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-shrink: 0;
  gap: 8px;
  padding: 10px 12px;
  min-height: 52px;
  border-bottom: 1px solid var(--tree-line);
}
.explorer-brand {
  display: flex;
  align-items: center;
  gap: 9px;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: rgba(var(--v-theme-on-surface), 0.85);
}
.explorer-mark {
  display: grid;
  place-items: center;
  width: 26px;
  height: 26px;
  border: 1px solid rgba(var(--v-theme-primary), 0.2);
  border-radius: 7px;
  color: rgb(var(--v-theme-primary));
  background: rgba(var(--v-theme-primary), 0.08);
}
.collection-count {
  min-width: 20px;
  padding: 2px 5px;
  border-radius: 4px;
  background: rgba(var(--v-theme-on-surface), 0.06);
  color: rgba(var(--v-theme-on-surface), 0.5);
  letter-spacing: 0;
  text-align: center;
  font-size: 10px;
  font-variant-numeric: tabular-nums;
}
.explorer-heading :deep(.v-btn) {
  opacity: 0.55;
}
.explorer-heading :deep(.v-btn:hover),
.explorer-heading :deep(.v-btn:focus-visible) {
  opacity: 1;
}
.tree-scroll {
  overflow: auto;
  flex: 1;
  min-height: 0;
  padding: 8px 6px 16px;
  scrollbar-width: thin;
  scrollbar-color: rgba(var(--v-theme-on-surface), 0.14) transparent;
}
.tree-scroll::-webkit-scrollbar {
  width: 5px;
  height: 5px;
}
.tree-scroll::-webkit-scrollbar-thumb {
  border-radius: 8px;
  background: rgba(var(--v-theme-on-surface), 0.14);
}
.dataset-node + .dataset-node {
  margin-top: 3px;
}
.tree-row {
  display: flex;
  align-items: center;
  gap: 6px;
  min-height: 32px;
  width: 100%;
  color: rgba(var(--v-theme-on-surface), 0.78);
  text-align: left;
  padding: 4px 7px;
  border-radius: 5px;
  font-size: 12px;
  line-height: 1.4;
  cursor: pointer;
  list-style: none;
  transition:
    background 0.14s ease,
    color 0.14s ease;
}
summary.tree-row::-webkit-details-marker {
  display: none;
}
.node-label {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.node-chevron {
  flex: none;
  color: rgba(var(--v-theme-on-surface), 0.36);
  transition: transform 0.14s ease;
}
.source-node[open] > summary > .node-chevron,
.file-node[open] > summary > .node-chevron,
.dataset-row[aria-expanded='true'] > .node-chevron {
  transform: rotate(90deg);
}
.tree-row:hover {
  background: rgba(var(--v-theme-on-surface), 0.045);
  color: rgb(var(--v-theme-on-surface));
}
.tree-row:focus-visible {
  outline: 2px solid rgba(var(--v-theme-primary), 0.8);
  outline-offset: -2px;
}
.dataset-row {
  position: relative;
  font-weight: 600;
  min-height: 35px;
}
.dataset-icon {
  color: rgb(var(--v-theme-secondary));
}
.dataset-row.selected {
  color: rgba(var(--v-theme-on-surface), 0.96);
  background: linear-gradient(
    90deg,
    rgba(var(--v-theme-primary), 0.16),
    rgba(var(--v-theme-primary), 0.035)
  );
  box-shadow: inset 2px 0 rgb(var(--v-theme-primary));
}
.dataset-row.selected > .node-chevron {
  color: rgb(var(--v-theme-primary));
}
.dataset-row:disabled {
  opacity: 0.6;
  cursor: wait;
}
.dataset-children {
  padding-top: 4px;
  padding-bottom: 6px;
}
.source-node {
  margin-left: 17px;
  padding-left: 7px;
  border-left: 1px solid var(--tree-line);
}
.source-icon {
  color: #cfab7b;
}
.source-row {
  font-weight: 500;
}
.file-node {
  margin-left: 13px;
  padding-left: 6px;
  border-left: 1px solid var(--tree-line);
}
.file-icon {
  color: rgba(var(--v-theme-on-surface), 0.55);
}
.file-icon.spatial {
  color: #87b5d2;
}
.file-icon.tabular {
  color: #8bbfa6;
}
.file-label {
  font-size: 11.5px;
}
.format-badge {
  flex-shrink: 0;
  font-size: 9px;
  line-height: 16px;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: rgba(var(--v-theme-on-surface), 0.5);
}
.remove-link {
  flex: none;
  width: 22px !important;
  height: 22px !important;
  color: rgba(var(--v-theme-on-surface), 0.5);
  opacity: 0;
  pointer-events: none;
  transition:
    opacity 0.14s ease,
    color 0.14s ease;
}
.file-row:hover .remove-link,
.file-row:focus-within .remove-link {
  opacity: 1;
  pointer-events: auto;
}
.remove-link:hover {
  color: rgb(var(--v-theme-error));
}
.remove-link :deep(.v-icon) {
  font-size: 14px;
}
.layer-node {
  margin: 3px 4px 7px 20px;
  padding: 3px 5px 3px 0;
  border-left: 2px solid transparent;
  border-radius: 0 5px 5px 0;
  transition: background 0.14s ease;
}
.layer-node.is-visible {
  background: rgba(var(--v-theme-on-surface), 0.025);
  border-left-color: var(--layer-color);
}
.layer-node.has-error {
  border-left-color: rgb(var(--v-theme-error));
}
.layer-row {
  display: flex;
  align-items: center;
  gap: 5px;
  min-height: 28px;
}
.layer-name {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1;
  font-size: 11.5px;
  color: rgba(var(--v-theme-on-surface), 0.68);
}
.is-visible .layer-name {
  color: rgba(var(--v-theme-on-surface), 0.94);
}
.layer-row :deep(.v-selection-control) {
  flex: none;
  min-height: 28px;
}
.layer-row :deep(.v-selection-control__wrapper),
.layer-row :deep(.v-selection-control__input) {
  width: 28px;
  height: 28px;
}
.layer-row :deep(.v-selection-control__input > .v-icon) {
  font-size: 18px;
}
.layer-meta,
.layer-error {
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 0 4px 5px 52px;
  font-size: 10px;
  line-height: 1.5;
  color: rgba(var(--v-theme-on-surface), 0.48);
}
.status-dot {
  width: 4px;
  height: 4px;
  border-radius: 50%;
  background: var(--layer-color);
  flex-shrink: 0;
}
.layer-error {
  color: rgb(var(--v-theme-error));
  overflow-wrap: anywhere;
}
.layer-controls {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0 6px 0 52px;
}
.layer-controls > span {
  font-size: 9px;
  color: rgba(var(--v-theme-on-surface), 0.55);
}
.layer-controls :deep(.v-slider) {
  min-width: 0;
  flex: 1;
  margin: 0;
}
.tree-empty {
  padding: 5px 8px 8px 15px;
  font-size: 10.5px;
  line-height: 1.5;
  color: rgba(var(--v-theme-on-surface), 0.48);
}
.dataset-empty {
  padding: 12px 14px 12px 28px;
}
.no-layer {
  display: flex;
  align-items: center;
  gap: 5px;
  margin-left: 20px;
  padding-left: 10px;
}
.explorer-empty {
  padding: 24px 18px;
  color: rgba(var(--v-theme-on-surface), 0.55);
  text-align: center;
  font-size: 12px;
}
.explorer-empty > p {
  margin: 10px 0;
}
.explorer-footer {
  flex-shrink: 0;
  border-top: 1px solid var(--tree-line);
  padding: 7px 10px;
}
.manage-button {
  justify-content: flex-start;
  font-size: 11px;
  text-transform: none;
  letter-spacing: 0;
  color: rgba(var(--v-theme-on-surface), 0.75);
}
.explorer-hint {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 5px 4px;
  font-size: 10px;
  color: rgba(var(--v-theme-on-surface), 0.5);
}
@media (hover: none) {
  .remove-link {
    opacity: 1;
    pointer-events: auto;
  }
}
@media (prefers-reduced-motion: reduce) {
  .tree-row,
  .node-chevron,
  .remove-link,
  .layer-node {
    transition: none;
  }
}
</style>
