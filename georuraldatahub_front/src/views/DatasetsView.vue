<template>
  <div>
    <h1 class="text-h5 mb-3">Conjuntos de dados</h1>
    <p class="mb-4">
      Os conjuntos reúnem arquivos já ingeridos de diferentes fontes. O mesmo arquivo pode compor
      vários conjuntos.
    </p>
    <v-alert v-if="error" type="error" class="mb-4">{{ error }}</v-alert>
    <v-btn v-if="can('datasets.manage')" color="primary" :disabled="busy" @click="showCreate = true"
      >Novo conjunto</v-btn
    >
    <v-btn variant="text" :loading="loading" :disabled="busy" @click="load">Atualizar</v-btn>
    <v-select
      v-model="datasetId"
      :items="datasets"
      item-title="name"
      item-value="id"
      label="Conjunto"
      :loading="loading"
      :disabled="busy || loading"
      clearable
      class="mt-4"
    />
    <v-progress-linear v-if="structureLoading" indeterminate />
    <v-card v-if="structure && !structureLoading" class="pa-4 mb-4">
      <h2 class="text-h6 mb-3">{{ structure.name }}</h2>
      <v-btn
        :to="{ path: '/home', query: { dataset: datasetId } }"
        variant="text"
        prepend-icon="mdi-map-outline"
        >Abrir no workspace</v-btn
      >
      <template v-if="can('datasets.manage')">
        <v-text-field v-model="newName" label="Nome do conjunto" :disabled="busy" />
        <v-btn :loading="busy" :disabled="busy || !newName.trim()" @click="rename"
          >Salvar nome</v-btn
        >
        <v-btn variant="text" color="error" :disabled="busy || hasFiles" @click="showDelete = true"
          >Excluir conjunto vazio</v-btn
        >
      </template>
      <p v-if="!hasFiles" class="mt-4">Este conjunto ainda não tem arquivos.</p>
      <v-card
        v-for="source in structure.sources"
        :key="source.id"
        variant="outlined"
        class="pa-3 mt-3"
      >
        <h3 class="text-subtitle-1">{{ source.name }}</h3>
        <v-list>
          <v-list-item v-for="file in source.files" :key="file.id" :title="file.name">
            <p class="text-caption">
              Dicionário {{ file.dictionaryId }}, versão {{ file.dictionaryVersion }} · Ingestão
              {{ file.ingestionId }}
            </p>
            <p class="text-caption">
              {{
                file.layers.length
                  ? 'Prévia dos registros validados disponível no mapa.'
                  : 'Sem referência de visualização disponível.'
              }}
            </p>
            <v-btn
              v-if="can('datasets.manage')"
              color="error"
              variant="text"
              :disabled="busy"
              @click="membership(file.id, false)"
              >Remover vínculo</v-btn
            >
          </v-list-item>
        </v-list>
      </v-card>
    </v-card>
    <v-card v-if="structure && can('datasets.manage')" class="pa-4">
      <h2 class="text-h6 mb-3">Adicionar arquivos de uma fonte</h2>
      <p class="mb-3">
        Adicionar ou remover vínculos preserva o arquivo original e seus relatórios. A associação
        não executa tratamento nem aprovação.
      </p>
      <v-select
        v-model="sourceId"
        :items="sources"
        item-title="name"
        item-value="id"
        label="Fonte dos arquivos"
        :disabled="busy"
        clearable
      />
      <v-progress-linear v-if="filesLoading" indeterminate />
      <v-alert v-if="filesError" type="error">{{ filesError }}</v-alert>
      <v-list v-if="!filesLoading"
        ><v-list-item v-for="file in availableFiles" :key="file.id" :title="file.name">
          <p class="text-caption">{{ file.formatFile }} · {{ file.size }} bytes</p>
          <v-btn :disabled="busy || included.has(file.id)" @click="membership(file.id, true)">{{
            included.has(file.id) ? 'Já associado' : 'Adicionar ao conjunto'
          }}</v-btn>
        </v-list-item></v-list
      >
      <p v-if="sourceId && !filesLoading && !filesError && !availableFiles.length">
        Nenhum arquivo recebido por esta fonte.
      </p>
    </v-card>
    <DataSetDialog
      v-if="currentUserId && can('datasets.manage')"
      v-model="showCreate"
      :user-id="currentUserId"
      @saved="created"
    />
    <ConfirmDialog
      v-model="showDelete"
      title="Excluir conjunto vazio"
      message="Excluir este conjunto vazio?"
      @confirm="remove"
    />
  </div>
</template>
<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
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
const newName = ref(''),
  error = ref(''),
  filesError = ref('')
const loading = ref(false),
  structureLoading = ref(false),
  filesLoading = ref(false),
  busy = ref(false)
const showCreate = ref(false),
  showDelete = ref(false),
  availableFiles = ref<IngestedFile[]>([])
const included = computed(
  () => new Set(structure.value?.sources.flatMap((s) => s.files.map((f) => f.id)) ?? []),
)
const hasFiles = computed(() => included.value.size > 0)
let structureEpoch = 0,
  filesEpoch = 0
async function load() {
  loading.value = true
  error.value = ''
  try {
    const [ds, ss] = await Promise.all([
      axios.get<Dataset[]>('/conjuntos'),
      axios.get<Source[]>('/fontes'),
    ])
    datasets.value = ds.data
    sources.value = ss.data
    if (datasetId.value && !ds.data.some((d) => d.id === datasetId.value)) datasetId.value = null
    await loadStructure()
  } catch (e) {
    error.value = apiError(e)
  } finally {
    loading.value = false
  }
}
async function loadStructure() {
  const epoch = ++structureEpoch
  structure.value = null
  if (!datasetId.value) {
    structureLoading.value = false
    return
  }
  structureLoading.value = true
  try {
    const { data } = await axios.get<DatasetStructure>(`/conjuntos/${datasetId.value}/estrutura`)
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
async function loadFiles() {
  const epoch = ++filesEpoch
  availableFiles.value = []
  filesError.value = ''
  if (!sourceId.value) {
    filesLoading.value = false
    return
  }
  filesLoading.value = true
  try {
    const { data } = await axios.get<IngestedFile[]>(`/fontes/${sourceId.value}/arquivos`)
    if (epoch === filesEpoch) availableFiles.value = data
  } catch (e) {
    if (epoch === filesEpoch) filesError.value = apiError(e)
  } finally {
    if (epoch === filesEpoch) filesLoading.value = false
  }
}
async function membership(fileId: number, add: boolean) {
  if (!can('datasets.manage') || !datasetId.value || !structure.value || busy.value) return
  const id = datasetId.value
  busy.value = true
  error.value = ''
  try {
    const path = `/conjuntos/${id}/arquivos/${fileId}`
    if (add) await axios.put(path)
    else await axios.delete(path)
    await loadStructure()
    await loadFiles()
  } catch (e) {
    error.value = apiError(e)
  } finally {
    busy.value = false
  }
}
async function rename() {
  if (!can('datasets.manage') || !datasetId.value || !newName.value.trim() || busy.value) return
  busy.value = true
  error.value = ''
  try {
    await axios.put(`/conjuntos/${datasetId.value}`, { name: newName.value.trim() })
    await load()
  } catch (e) {
    error.value = apiError(e)
  } finally {
    busy.value = false
  }
}
async function remove() {
  if (!can('datasets.manage') || !datasetId.value || hasFiles.value || busy.value) return
  busy.value = true
  error.value = ''
  try {
    await axios.delete(`/conjuntos/${datasetId.value}`)
    datasetId.value = null
    await load()
  } catch (e) {
    error.value = apiError(e)
  } finally {
    busy.value = false
  }
}
async function created(ds: Pick<Dataset, 'id' | 'name'>) {
  await load()
  datasetId.value = ds.id
}
watch(datasetId, () => {
  error.value = ''
  void loadStructure()
})
watch(sourceId, loadFiles)
onMounted(load)
</script>
