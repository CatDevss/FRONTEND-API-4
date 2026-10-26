<template>
  <div class="datasets-page">
    <header class="page-heading">
      <div>
        <p class="eyebrow">ORGANIZAÇÃO DOS DADOS</p>
        <h1 class="text-h5 font-weight-bold">Conjuntos de dados</h1>
        <p class="text-body-2 text-medium-emphasis mt-1">
          Reúna arquivos de diferentes fontes para explorar seus dados no mapa.
        </p>
      </div>
      <div class="heading-actions">
        <v-btn
          variant="outlined"
          prepend-icon="mdi-refresh"
          :loading="loading"
          :disabled="busy || loading"
          @click="load"
          >Atualizar</v-btn
        ><v-btn
          v-if="can('datasets.manage')"
          color="primary"
          prepend-icon="mdi-plus"
          :disabled="busy"
          @click="showCreate = true"
          >Novo conjunto</v-btn
        >
      </div>
    </header>
    <div class="datasets-summary" aria-label="Resumo dos conjuntos">
      <div class="summary-item">
        <span class="summary-icon"><v-icon icon="mdi-folder-multiple-outline" size="22" /></span>
        <div>
          <strong>{{ datasets.length }}</strong
          ><span>Conjuntos disponíveis</span>
        </div>
      </div>
      <div class="summary-item">
        <span class="summary-icon"
          ><v-icon icon="mdi-file-document-multiple-outline" size="22"
        /></span>
        <div>
          <strong>{{ structure ? included.size : '—' }}</strong
          ><span>Arquivos no conjunto selecionado</span>
        </div>
      </div>
      <div class="summary-item">
        <span class="summary-icon"><v-icon icon="mdi-database-outline" size="22" /></span>
        <div>
          <strong>{{ structure ? sourceCount : '—' }}</strong
          ><span>Fontes no conjunto selecionado</span>
        </div>
      </div>
    </div>
    <v-alert v-if="error" type="error" variant="tonal" class="mb-4" role="alert">{{
      error
    }}</v-alert>
    <v-alert
      v-if="success"
      type="success"
      variant="tonal"
      density="compact"
      class="mb-4"
      role="status"
      >{{ success }}</v-alert
    >
    <section class="dataset-library" aria-label="Biblioteca de conjuntos">
      <div class="library-toolbar">
        <v-text-field
          v-model="search"
          label="Buscar conjunto"
          placeholder="Nome ou número do conjunto"
          prepend-inner-icon="mdi-magnify"
          variant="outlined"
          density="compact"
          hide-details
          clearable
          class="dataset-search"
        /><span class="result-count" role="status"
          >{{ filteredDatasets.length }} de {{ datasets.length }} conjunto(s)</span
        >
      </div>
      <v-progress-linear
        v-if="loading"
        indeterminate
        color="primary"
        height="2"
        aria-label="Carregando conjuntos"
      />
      <div class="dataset-workbench">
        <aside class="dataset-list" aria-label="Conjuntos disponíveis">
          <p class="list-heading">SEUS CONJUNTOS</p>
          <button
            v-for="dataset in filteredDatasets"
            :key="dataset.id"
            type="button"
            class="dataset-item"
            :class="{ selected: datasetId === dataset.id }"
            :data-dataset-id="dataset.id"
            :aria-pressed="datasetId === dataset.id"
            :disabled="busy || loading"
            @click="selectDataset(dataset.id)"
          >
            <v-icon
              :icon="datasetId === dataset.id ? 'mdi-folder-open-outline' : 'mdi-folder-outline'"
              size="20"
            /><span
              ><strong>{{ dataset.name }}</strong
              ><small>Conjunto #{{ dataset.id }}</small></span
            ><v-icon v-if="datasetId === dataset.id" icon="mdi-chevron-right" size="16" />
          </button>
          <div v-if="!loading && !filteredDatasets.length" class="list-empty">
            <p>
              {{
                datasets.length
                  ? 'Nenhum conjunto encontrado.'
                  : error
                    ? 'Listagem indisponível.'
                    : 'Nenhum conjunto cadastrado.'
              }}
            </p>
            <v-btn v-if="search" variant="text" size="small" @click="search = ''"
              >Limpar busca</v-btn
            >
          </div>
        </aside>
        <main class="dataset-content" aria-label="Detalhes do conjunto">
          <div v-if="structureLoading" class="dataset-empty">
            <v-progress-circular indeterminate color="primary" size="30" />
            <p>Carregando fontes e arquivos do conjunto…</p>
          </div>
          <template v-else-if="structure">
            <div class="detail-heading">
              <div>
                <p class="eyebrow">CONJUNTO #{{ structure.id }}</p>
                <h2 class="text-h6 font-weight-bold">{{ structure.name }}</h2>
              </div>
              <v-btn
                :to="{ path: '/home', query: { dataset: datasetId } }"
                variant="tonal"
                color="primary"
                prepend-icon="mdi-map-outline"
                :disabled="busy"
                >Abrir no workspace</v-btn
              >
            </div>
            <div v-if="can('datasets.manage')" class="dataset-actions">
              <v-btn
                variant="outlined"
                size="small"
                prepend-icon="mdi-file-plus-outline"
                :disabled="busy"
                @click="showFiles = true"
                >Adicionar arquivos</v-btn
              >
              <v-btn
                variant="text"
                size="small"
                prepend-icon="mdi-pencil-outline"
                :disabled="busy || renaming"
                @click="renaming = true"
                >Renomear</v-btn
              >
              <v-btn
                variant="text"
                color="error"
                size="small"
                prepend-icon="mdi-delete-outline"
                :disabled="busy || hasFiles"
                :title="
                  hasFiles
                    ? 'Remova os vínculos antes de excluir o conjunto.'
                    : 'Excluir conjunto vazio'
                "
                @click="showDelete = true"
                >Excluir conjunto vazio</v-btn
              >
            </div>
            <form
              v-if="renaming && can('datasets.manage')"
              class="rename-form"
              @submit.prevent="rename"
            >
              <v-text-field
                v-model="newName"
                label="Nome do conjunto"
                variant="outlined"
                density="compact"
                maxlength="100"
                :disabled="busy"
                hide-details
              /><v-btn
                type="submit"
                color="primary"
                :loading="busy"
                :disabled="busy || !newName.trim() || newName.trim() === structure.name"
                >Salvar nome</v-btn
              ><v-btn variant="text" :disabled="busy" @click="cancelRename">Cancelar</v-btn>
            </form>
            <div v-if="!hasFiles" class="dataset-empty selected-empty">
              <span class="empty-icon"><v-icon icon="mdi-folder-plus-outline" size="30" /></span>
              <h3>Este conjunto ainda não tem arquivos.</h3>
              <p>
                {{
                  can('datasets.manage')
                    ? 'Adicione arquivos já recebidos pelas fontes. Você pode reunir diferentes origens no mesmo conjunto.'
                    : 'Os arquivos associados a este conjunto aparecerão aqui.'
                }}
              </p>
              <v-btn
                v-if="can('datasets.manage')"
                variant="tonal"
                color="primary"
                class="mt-4"
                :disabled="busy"
                @click="showFiles = true"
                >Escolher arquivos</v-btn
              >
            </div>
            <div v-for="source in structure.sources" :key="source.id" class="source-group">
              <div class="source-heading">
                <v-icon icon="mdi-database-outline" size="18" />
                <h3>{{ source.name }}</h3>
                <span>{{ source.files.length }} arquivo(s)</span>
              </div>
              <article v-for="file in source.files" :key="file.id" class="linked-file">
                <v-icon
                  :icon="
                    file.formatFile?.toLowerCase() === 'csv'
                      ? 'mdi-file-delimited-outline'
                      : 'mdi-file-outline'
                  "
                  size="22"
                  class="file-icon"
                />
                <div class="linked-file-info">
                  <h4>{{ file.name }}</h4>
                  <p>
                    Dicionário {{ file.dictionaryId }}, versão {{ file.dictionaryVersion }} ·
                    Ingestão {{ file.ingestionId }}
                  </p>
                  <span class="layer-state"
                    ><v-icon
                      :icon="file.layers.length ? 'mdi-layers-outline' : 'mdi-layers-off-outline'"
                      size="12"
                    />{{
                      file.layers.length
                        ? 'Prévia dos registros validados disponível no mapa.'
                        : 'Sem referência de visualização disponível.'
                    }}</span
                  >
                </div>
                <v-btn
                  v-if="can('datasets.manage')"
                  color="error"
                  variant="text"
                  size="small"
                  :disabled="busy"
                  :aria-label="`Remover vínculo de ${file.name}`"
                  @click="membership(file.id, false)"
                  >Remover vínculo</v-btn
                >
              </article>
            </div>
          </template>
          <div v-else class="dataset-empty">
            <span class="empty-icon"><v-icon icon="mdi-folder-open-outline" size="32" /></span>
            <h2>
              {{
                datasetId
                  ? 'Conjunto indisponível'
                  : datasets.length
                    ? 'Escolha um conjunto para explorar'
                    : 'Organize seus arquivos em conjuntos'
              }}
            </h2>
            <p>
              {{
                datasetId
                  ? 'Não foi possível carregar a estrutura. Tente novamente para consultar os arquivos.'
                  : datasets.length
                    ? 'Selecione um conjunto na lista para consultar suas fontes, arquivos e referências de visualização.'
                    : 'Os arquivos são recebidos por fonte e podem ser organizados em conjuntos depois da ingestão.'
              }}
            </p>
            <v-btn v-if="datasetId" variant="tonal" class="mt-4" @click="loadStructure"
              >Tentar novamente</v-btn
            ><v-btn
              v-else-if="!datasets.length && !loading && !error && can('datasets.manage')"
              variant="tonal"
              color="primary"
              class="mt-4"
              @click="showCreate = true"
              >Criar primeiro conjunto</v-btn
            >
          </div>
        </main>
      </div>
      <footer class="library-footer">
        <v-icon icon="mdi-link-variant" size="16" />
        <p>
          Um arquivo pode participar de vários conjuntos. Remover um vínculo preserva o arquivo
          original e seus relatórios. A associação não executa tratamento nem aprovação.
        </p>
      </footer>
    </section>
    <v-dialog v-if="can('datasets.manage')" v-model="showFiles" max-width="820" :persistent="busy">
      <v-card title="Adicionar arquivos existentes"
        ><p class="dialog-context">Conjunto: {{ structure?.name }}</p>
        <v-card-text>
          <p class="text-body-2 text-medium-emphasis mb-4">
            Escolha uma fonte e adicione seus arquivos. Eles podem participar de outros conjuntos,
            sem gerar cópias ou novas ingestões.
          </p>
          <div class="picker-source">
            <v-select
              v-model="sourceId"
              :items="sources"
              item-title="name"
              item-value="id"
              label="Fonte dos arquivos"
              variant="outlined"
              density="compact"
              :loading="sourcesLoading"
              :disabled="busy || sourcesLoading"
              hide-details
              clearable
            /><v-btn
              variant="text"
              size="small"
              :disabled="busy || sourcesLoading"
              @click="loadSources"
              >Atualizar fontes</v-btn
            >
          </div>
          <v-alert
            v-if="sourcesError || filesError"
            type="error"
            variant="tonal"
            class="my-4"
            role="alert"
            >{{ sourcesError || filesError
            }}<v-btn variant="text" @click="sourcesError ? loadSources() : loadFiles()"
              >Tentar novamente</v-btn
            ></v-alert
          >
          <v-alert v-if="error" type="error" variant="tonal" class="my-4">{{ error }}</v-alert>
          <v-progress-linear v-if="filesLoading" indeterminate color="primary" class="mt-4" />
          <div v-if="!filesLoading" class="available-files">
            <div v-for="file in availableFiles" :key="file.id" class="available-file">
              <v-icon icon="mdi-file-outline" size="20" />
              <div>
                <strong>{{ file.name }}</strong
                ><span
                  >{{ file.formatFile || 'Formato não informado' }} · {{ file.size }} bytes</span
                >
              </div>
              <v-btn
                size="small"
                :variant="included.has(file.id) ? 'text' : 'tonal'"
                :color="included.has(file.id) ? undefined : 'primary'"
                :disabled="busy || sourcesLoading || structureLoading || included.has(file.id)"
                @click="membership(file.id, true)"
                >{{ included.has(file.id) ? 'Já associado' : 'Adicionar ao conjunto' }}</v-btn
              >
            </div>
          </div>
          <p v-if="!sourceId && !sourcesLoading && !sourcesError" class="picker-empty">
            Selecione a fonte dos arquivos para continuar.
          </p>
          <p
            v-else-if="
              sourceId && !filesLoading && !filesError && !sourcesError && !availableFiles.length
            "
            class="picker-empty"
          >
            Nenhum arquivo recebido por esta fonte.
          </p> </v-card-text
        ><v-card-actions
          ><v-spacer /><v-btn :disabled="busy" @click="showFiles = false"
            >Concluir</v-btn
          ></v-card-actions
        ></v-card
      >
    </v-dialog>
    <DataSetDialog
      v-if="currentUserId && can('datasets.manage')"
      v-model="showCreate"
      :user-id="currentUserId"
      @saved="created"
    />
    <ConfirmDialog
      v-model="showDelete"
      title="Excluir conjunto vazio"
      :message="`Excluir o conjunto vazio ${structure?.name || ''}?`"
      @confirm="remove"
    />
  </div>
</template>
<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import axios from 'axios'
import { can, currentUserId } from '@/access/session'
import {
  apiError,
  type Dataset,
  type DatasetStructure,
  type Source,
  type IngestedFile,
} from '@/services/contracts'
import DataSetDialog from '@/components/DataSetDialog.vue'
import ConfirmDialog from '@/components/ConfirmDialog.vue'
const datasets = ref<Dataset[]>([]),
  sources = ref<Source[]>([]),
  structure = ref<DatasetStructure | null>(null)
const datasetId = ref<number | null>(null),
  sourceId = ref<number | null>(null)
const search = ref(''),
  newName = ref(''),
  error = ref(''),
  success = ref(''),
  filesError = ref(''),
  sourcesError = ref('')
const loading = ref(false),
  structureLoading = ref(false),
  sourcesLoading = ref(false),
  filesLoading = ref(false),
  busy = ref(false),
  renaming = ref(false)
const showCreate = ref(false),
  showDelete = ref(false),
  showFiles = ref(false),
  availableFiles = ref<IngestedFile[]>([])
const included = computed(
  () => new Set(structure.value?.sources.flatMap((s) => s.files.map((f) => f.id)) ?? []),
)
const hasFiles = computed(() => included.value.size > 0)
const sourceCount = computed(
  () => structure.value?.sources.filter((s) => s.files.length).length ?? 0,
)
function normalize(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('pt-BR')
}
const filteredDatasets = computed(() => {
  const terms = normalize(search.value || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
  return datasets.value.filter((d) =>
    terms.every((term) => normalize(`${d.name} ${d.id}`).includes(term)),
  )
})
let listEpoch = 0,
  structureEpoch = 0,
  filesEpoch = 0,
  sourcesEpoch = 0
async function load() {
  if (loading.value) return
  const epoch = ++listEpoch
  loading.value = true
  error.value = ''
  try {
    const { data } = await axios.get<Dataset[]>('/conjuntos')
    if (epoch !== listEpoch) return
    datasets.value = [...data].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR') || a.id - b.id)
    if (datasetId.value && !data.some((d) => d.id === datasetId.value)) datasetId.value = null
    else if (datasetId.value) await loadStructure()
  } catch (e) {
    if (epoch === listEpoch) error.value = apiError(e)
  } finally {
    if (epoch === listEpoch) loading.value = false
  }
}
function selectDataset(id: number) {
  if (busy.value || loading.value || datasetId.value === id) return
  datasetId.value = id
}
function cancelRename() {
  renaming.value = false
  newName.value = structure.value?.name ?? ''
}
async function loadStructure() {
  const epoch = ++structureEpoch,
    id = datasetId.value
  structure.value = null
  error.value = ''
  renaming.value = false
  if (!id) {
    structureLoading.value = false
    return
  }
  structureLoading.value = true
  try {
    const { data } = await axios.get<DatasetStructure>(`/conjuntos/${id}/estrutura`)
    if (epoch === structureEpoch) {
      structure.value = data
      newName.value = data.name
    }
  } catch (e) {
    if (epoch === structureEpoch) error.value = apiError(e)
  } finally {
    if (epoch === structureEpoch) structureLoading.value = false
  }
}
async function loadSources() {
  if (!can('datasets.manage')) return
  const epoch = ++sourcesEpoch
  sourcesLoading.value = true
  sourcesError.value = ''
  try {
    const { data } = await axios.get<Source[]>('/fontes')
    if (epoch !== sourcesEpoch) return
    sources.value = [...data].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR') || a.id - b.id)
    if (sourceId.value && !data.some((s) => s.id === sourceId.value)) sourceId.value = null
    else if (sourceId.value) await loadFiles()
  } catch (e) {
    if (epoch === sourcesEpoch) sourcesError.value = apiError(e)
  } finally {
    if (epoch === sourcesEpoch) sourcesLoading.value = false
  }
}
async function loadFiles() {
  const epoch = ++filesEpoch,
    id = sourceId.value
  availableFiles.value = []
  filesError.value = ''
  if (!id) {
    filesLoading.value = false
    return
  }
  filesLoading.value = true
  try {
    const { data } = await axios.get<IngestedFile[]>(`/fontes/${id}/arquivos`)
    if (epoch === filesEpoch)
      availableFiles.value = [...data].sort(
        (a, b) => a.name.localeCompare(b.name, 'pt-BR') || a.id - b.id,
      )
  } catch (e) {
    if (epoch === filesEpoch) filesError.value = apiError(e)
  } finally {
    if (epoch === filesEpoch) filesLoading.value = false
  }
}
async function membership(fileId: number, add: boolean) {
  if (
    !can('datasets.manage') ||
    !datasetId.value ||
    structure.value?.id !== datasetId.value ||
    busy.value ||
    structureLoading.value
  )
    return
  const id = datasetId.value
  busy.value = true
  error.value = ''
  success.value = ''
  try {
    const path = `/conjuntos/${id}/arquivos/${fileId}`
    if (add) await axios.put(path)
    else await axios.delete(path)
    await loadStructure()
    if (showFiles.value) await loadFiles()
    success.value = add
      ? 'Arquivo associado ao conjunto.'
      : 'Vínculo removido. O arquivo original foi preservado.'
  } catch (e) {
    error.value = apiError(e)
  } finally {
    busy.value = false
  }
}
async function rename() {
  if (
    !can('datasets.manage') ||
    !datasetId.value ||
    structure.value?.id !== datasetId.value ||
    !newName.value.trim() ||
    busy.value
  )
    return
  busy.value = true
  error.value = ''
  success.value = ''
  try {
    await axios.put(`/conjuntos/${datasetId.value}`, { name: newName.value.trim() })
    await load()
    success.value = 'Nome do conjunto atualizado.'
  } catch (e) {
    error.value = apiError(e)
  } finally {
    busy.value = false
  }
}
async function remove() {
  if (
    !can('datasets.manage') ||
    !datasetId.value ||
    structure.value?.id !== datasetId.value ||
    hasFiles.value ||
    busy.value
  )
    return
  busy.value = true
  error.value = ''
  success.value = ''
  try {
    await axios.delete(`/conjuntos/${datasetId.value}`)
    datasetId.value = null
    await load()
    success.value = 'Conjunto vazio excluído.'
  } catch (e) {
    error.value = apiError(e)
  } finally {
    busy.value = false
  }
}
async function created(ds: Pick<Dataset, 'id' | 'name'>) {
  await load()
  datasetId.value = ds.id
  search.value = ''
  await nextTick()
  success.value = 'Conjunto criado. Adicione arquivos já recebidos pelas fontes.'
}
watch(datasetId, () => {
  error.value = ''
  success.value = ''
  showFiles.value = false
  showDelete.value = false
  void loadStructure()
})
watch(sourceId, loadFiles)
watch(showFiles, (open) => {
  if (open) void loadSources()
  else {
    ++sourcesEpoch
    ++filesEpoch
    sourcesLoading.value = false
    filesLoading.value = false
  }
})
onMounted(load)
onBeforeUnmount(() => {
  ++listEpoch
  ++structureEpoch
  ++filesEpoch
  ++sourcesEpoch
})
</script>
<style scoped>
.datasets-page {
  max-width: 1500px;
  margin: auto;
}
.page-heading,
.heading-actions {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}
.page-heading {
  justify-content: space-between;
  margin-bottom: 24px;
}
.eyebrow {
  font-size: 10px;
  letter-spacing: 0.12em;
  font-weight: 700;
  color: rgb(var(--v-theme-primary));
  margin-bottom: 6px;
}
.datasets-summary {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 16px;
  margin-bottom: 24px;
}
.summary-item {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 18px 20px;
  border: 1px solid var(--glass-outer-border);
  border-radius: 16px;
  background: rgba(var(--v-theme-surface), 0.4);
}
.summary-icon,
.empty-icon {
  display: grid;
  place-items: center;
  width: 44px;
  height: 44px;
  flex-shrink: 0;
  border-radius: 13px;
  background: rgba(var(--v-theme-primary), 0.08);
  color: rgb(var(--v-theme-primary));
}
.summary-item > div {
  display: grid;
  gap: 3px;
}
.summary-item strong {
  font-size: 21px;
  font-weight: 600;
  line-height: 1.3;
}
.summary-item div > span {
  font-size: 11px;
  color: rgba(var(--v-theme-on-surface), 0.55);
}
.dataset-library {
  border: 1px solid var(--glass-outer-border);
  border-radius: 18px;
  background: rgba(var(--v-theme-surface), 0.45);
  overflow: hidden;
}
.library-toolbar {
  display: flex;
  align-items: center;
  gap: 16px;
  flex-wrap: wrap;
  padding: 20px;
  border-bottom: 1px solid var(--glass-outer-border);
}
.dataset-search {
  flex: 1;
  min-width: 200px;
  max-width: 640px;
}
.result-count {
  margin-left: auto;
  font-size: 11px;
  color: rgba(var(--v-theme-on-surface), 0.55);
}
.dataset-workbench {
  display: grid;
  grid-template-columns: 260px minmax(0, 1fr);
  min-height: 480px;
}
.dataset-list {
  padding: 16px 12px;
  border-right: 1px solid var(--glass-outer-border);
  background: rgba(var(--v-theme-background), 0.2);
}
.list-heading {
  font-size: 9px;
  letter-spacing: 0.1em;
  font-weight: 600;
  padding: 2px 10px 12px;
  color: rgba(var(--v-theme-on-surface), 0.45);
}
.dataset-item {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  border: 1px solid transparent;
  border-radius: 9px;
  padding: 12px 10px;
  margin-bottom: 6px;
  text-align: left;
  color: rgba(var(--v-theme-on-surface), 0.65);
}
.dataset-item > span {
  display: grid;
  gap: 4px;
  min-width: 0;
  flex: 1;
}
.dataset-item strong {
  font-size: 12px;
  font-weight: 500;
  overflow-wrap: anywhere;
}
.dataset-item small {
  font-size: 10px;
  opacity: 0.65;
}
.dataset-item:hover {
  background: rgba(var(--v-theme-on-surface), 0.035);
}
.dataset-item.selected {
  background: rgba(var(--v-theme-primary), 0.08);
  border-color: rgba(var(--v-theme-primary), 0.3);
  color: rgb(var(--v-theme-on-surface));
}
.dataset-item.selected > :deep(.v-icon) {
  color: rgb(var(--v-theme-primary));
}
.dataset-item:focus-visible {
  outline: 2px solid rgb(var(--v-theme-primary));
  outline-offset: 2px;
}
.dataset-item:disabled {
  opacity: 0.55;
  cursor: wait;
}
.list-empty {
  font-size: 12px;
  color: rgba(var(--v-theme-on-surface), 0.55);
  padding: 16px 10px;
}
.dataset-content {
  padding: 24px;
  min-width: 0;
}
.detail-heading,
.dataset-actions,
.rename-form {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}
.detail-heading {
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 18px;
}
.detail-heading h2 {
  overflow-wrap: anywhere;
}
.dataset-actions {
  margin-bottom: 24px;
}
.dataset-actions :deep(.v-btn) {
  font-size: 11px;
  text-transform: none;
  letter-spacing: 0;
}
.rename-form {
  padding: 16px;
  margin-bottom: 20px;
  border: 1px solid var(--glass-outer-border);
  border-radius: 12px;
}
.rename-form :deep(.v-input) {
  flex: 1;
  min-width: 180px;
}
.source-group {
  border: 1px solid var(--glass-outer-border);
  border-radius: 12px;
  overflow: hidden;
  margin-top: 14px;
}
.source-heading {
  display: flex;
  align-items: center;
  gap: 9px;
  padding: 12px 14px;
  background: rgba(var(--v-theme-on-surface), 0.025);
  border-bottom: 1px solid var(--glass-outer-border);
}
.source-heading h3 {
  font-size: 12px;
  font-weight: 500;
}
.source-heading > span {
  margin-left: auto;
  font-size: 10px;
  color: rgba(var(--v-theme-on-surface), 0.5);
}
.linked-file {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 16px 14px;
}
.linked-file + .linked-file {
  border-top: 1px solid var(--glass-outer-border);
}
.file-icon {
  color: rgb(var(--v-theme-primary));
  margin-top: 3px;
}
.linked-file-info {
  flex: 1;
  min-width: 0;
}
.linked-file-info h4 {
  font-size: 12px;
  font-weight: 500;
  overflow-wrap: anywhere;
}
.linked-file-info p {
  font-size: 10px;
  color: rgba(var(--v-theme-on-surface), 0.5);
  margin: 5px 0;
}
.layer-state {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 10px;
  color: rgba(var(--v-theme-on-surface), 0.6);
}
.linked-file > :deep(.v-btn) {
  font-size: 10px;
  text-transform: none;
  letter-spacing: 0;
}
.dataset-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  min-height: 380px;
  padding: 32px;
}
.empty-icon {
  width: 64px;
  height: 64px;
  border-radius: 20px;
  margin-bottom: 16px;
}
.dataset-empty h2,
.dataset-empty h3 {
  font-size: 17px;
  font-weight: 500;
}
.dataset-empty p {
  font-size: 12px;
  color: rgba(var(--v-theme-on-surface), 0.6);
  margin-top: 10px;
  line-height: 1.7;
  max-width: 420px;
}
.selected-empty {
  min-height: 260px;
}
.library-footer {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 14px 20px;
  border-top: 1px solid var(--glass-outer-border);
  color: rgba(var(--v-theme-on-surface), 0.5);
}
.library-footer p {
  font-size: 10px;
  line-height: 1.6;
}
.library-footer :deep(.v-icon) {
  flex-shrink: 0;
  margin-top: 1px;
}
.dialog-context {
  padding: 0 24px;
  font-size: 12px;
  color: rgba(var(--v-theme-on-surface), 0.6);
}
.picker-source {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}
.picker-source :deep(.v-input) {
  flex: 1;
  min-width: 180px;
}
.available-files {
  margin-top: 16px;
  max-height: 360px;
  overflow: auto;
}
.available-file {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 0;
  border-bottom: 1px solid var(--glass-outer-border);
}
.available-file > div {
  flex: 1;
  min-width: 0;
  display: grid;
  gap: 4px;
}
.available-file strong {
  font-size: 12px;
  font-weight: 500;
  overflow-wrap: anywhere;
}
.available-file span {
  font-size: 10px;
  color: rgba(var(--v-theme-on-surface), 0.5);
}
.available-file :deep(.v-btn) {
  font-size: 10px;
  text-transform: none;
  letter-spacing: 0;
}
.picker-empty {
  font-size: 12px;
  color: rgba(var(--v-theme-on-surface), 0.6);
  padding: 24px 0;
}
@media (max-width: 1000px) {
  .dataset-workbench {
    grid-template-columns: 220px minmax(0, 1fr);
  }
  .datasets-summary {
    gap: 8px;
  }
  .summary-item {
    padding: 14px 12px;
    gap: 10px;
  }
  .summary-item strong {
    font-size: 18px;
  }
  .summary-icon {
    width: 36px;
    height: 36px;
  }
}
@media (max-width: 800px) {
  .dataset-workbench {
    grid-template-columns: 1fr;
  }
  .dataset-list {
    border-right: 0;
    border-bottom: 1px solid var(--glass-outer-border);
    max-height: 240px;
    overflow: auto;
  }
  .dataset-content {
    padding: 16px;
  }
  .linked-file {
    flex-wrap: wrap;
  }
  .linked-file > .v-btn {
    margin-left: 34px;
  }
}
@media (max-width: 600px) {
  .datasets-summary {
    grid-template-columns: 1fr;
    gap: 6px;
  }
  .summary-item {
    padding: 10px 14px;
  }
  .summary-item > div {
    display: flex;
    align-items: baseline;
    gap: 10px;
  }
  .summary-icon {
    width: 30px;
    height: 30px;
    border-radius: 9px;
  }
  .summary-item strong {
    font-size: 17px;
  }
  .result-count {
    margin-left: 0;
  }
  .library-toolbar {
    padding: 16px;
  }
  .dataset-empty {
    padding: 24px 12px;
    min-height: 300px;
  }
  .selected-empty {
    min-height: 220px;
  }
}
</style>
