<template>
  <!-- page-container usa flexbox para ocupar exatos 100% da altura visível -->
  <div class="page-container">
    
    <!-- Cabeçalho (Não cresce, ocupa apenas seu tamanho natural) -->
    <div class="flex-shrink-0">
      <h1 class="text-h5 font-weight-bold">Arquivos enviados</h1>
      <p class="text-medium-emphasis mb-6">
        Lista dos arquivos enviados para a zona bruta, com hash e data de envio.
      </p>
    </div>

    <!-- Filtros (Não cresce) -->
    <v-card class="mb-4 pa-4 flex-shrink-0">
      <v-row align="center" no-gutters>
        <v-col cols="12" md="6">
          <v-text-field
            v-model="search"
            label="Buscar"
            placeholder="Nome do arquivo ou do conjunto"
            prepend-inner-icon="mdi-magnify"
            hide-details
            density="compact"
          />
        </v-col>
        <v-col cols="12" md="4" class="pl-md-4 pt-4 pt-md-0">
          <v-select
            v-model="datasetFilter"
            :items="['Todos os conjuntos', ...datasetNames]"
            hide-details
            density="compact"
          />
        </v-col>
        <v-col cols="12" md="2" class="pl-md-4 pt-4 pt-md-0 text-md-right">
          <v-btn variant="outlined" prepend-icon="mdi-refresh" :loading="loading" @click="fetchAll">
            Atualizar
          </v-btn>
        </v-col>
      </v-row>
    </v-card>

    <!-- Card da Tabela (Cresce para ocupar todo o espaço restante) -->
    <v-card class="d-flex flex-column flex-grow-1 card-tabela" style="min-height: 0;">
      <v-progress-linear v-if="loading" indeterminate color="primary" class="flex-shrink-0" />

      <v-alert v-if="loadError" type="error" variant="tonal" class="ma-4 flex-shrink-0">
        {{ loadError }}
      </v-alert>

      <!-- Este wrapper controla a barra de rolagem da tabela (H e V) -->
      <div v-else class="table-scroll-wrapper">
        <v-table class="custom-table">
          <thead>
            <tr>
              <th class="col-arquivo">Arquivo</th>
              <th class="col-conjunto">Conjunto</th>
              <th class="col-formato">Formato</th>
              <th class="col-tamanho">Tamanho</th>
              <th class="col-hash">Hash</th>
              <th class="col-data">Enviado em</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="file in filteredFiles" :key="file.id">
              <td class="font-weight-medium">{{ file.name }}</td>
              <td>{{ file.datasetName }}</td>
              <td>{{ file.formatFile ?? '—' }}</td>
              <td>{{ formatSize(file.size) }}</td>
              <td class="font-mono text-caption text-truncate hash-column" :title="file.hash || ''">
                {{ file.hash ?? '—' }}
              </td>
              <td>{{ formatDateTime(file.sentAt) }}</td>
            </tr>
          </tbody>
        </v-table>
      </div>

      <p v-if="!loading && !loadError && filteredFiles.length === 0" class="text-medium-emphasis pa-4 text-center flex-shrink-0">
        Nenhum arquivo encontrado.
      </p>
    </v-card>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import axios from 'axios'

interface DatasetOption {
  id: number
  name: string
  sourceId: number
}

interface FileResponse {
  id: number
  name: string
  formatFile: string | null
  size: number
  hash: string | null
  location: string | null
  versionId: number
  dateCreation: string // ISO date-time
  versionUserId: number | null
}

interface DisplayFile {
  id: number
  name: string
  formatFile: string | null
  size: number
  hash: string | null
  sentAt: string
  datasetId: number
  datasetName: string
}

const search = ref('')
const datasetFilter = ref('Todos os conjuntos')
const loading = ref(false)
const loadError = ref('')

const datasets = ref<DatasetOption[]>([])
const files = ref<DisplayFile[]>([])

const datasetNames = computed(() => datasets.value.map((d) => d.name))

async function fetchAll() {
  loading.value = true
  loadError.value = ''
  try {
    const { data: datasetList } = await axios.get<DatasetOption[]>('/conjuntos')
    datasets.value = datasetList

    const filesByDataset = await Promise.all(
      datasetList.map(async (ds) => {
        const { data } = await axios.get<FileResponse[]>(`/conjuntos/${ds.id}/arquivos`)
        return data.map((f) => ({
          id: f.id,
          name: f.name,
          formatFile: f.formatFile,
          size: f.size,
          hash: f.hash,
          sentAt: f.dateCreation,
          datasetId: ds.id,
          datasetName: ds.name,
        }))
      }),
    )

    files.value = filesByDataset
      .flat()
      .sort((a, b) => new Date(b.sentAt).getTime() - new Date(a.sentAt).getTime())
  } catch (error) {
    loadError.value = axios.isAxiosError(error)
      ? (error.response?.data?.message ?? 'Erro ao carregar os arquivos enviados.')
      : 'Erro ao carregar os arquivos enviados.'
  } finally {
    loading.value = false
  }
}

onMounted(fetchAll)

const filteredFiles = computed(() =>
  files.value.filter((f) => {
    const matchesSearch =
      f.name.toLowerCase().includes(search.value.toLowerCase()) ||
      f.datasetName.toLowerCase().includes(search.value.toLowerCase())
    const matchesDataset =
      datasetFilter.value === 'Todos os conjuntos' || f.datasetName === datasetFilter.value
    return matchesSearch && matchesDataset
  }),
)

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString('pt-BR')
}

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
</script>

<style scoped>
.page-container {
  display: flex;
  flex-direction: column;
  height: calc(100vh - 48px);
}

.table-scroll-wrapper {
  flex: 1;
  overflow: auto;
  min-height: 0;
  width: 100%;
  position: relative; /* Garante o contexto de empilhamento correto para o sticky */
}

.custom-table {
  background-color: transparent !important;
}

.custom-table :deep(.v-table__wrapper) {
  overflow: visible !important;
}

/* Força o cabeçalho a ficar fixo no topo com um fundo sólido opaco (mesma cor do card/superfície escura) */
.custom-table :deep(.v-table__wrapper table thead tr th) {
  position: sticky !important;
  top: 0 !important;
  background: #080808 !important; /* Fundo opaco para impedir que as linhas apareçam por trás */
  opacity: 1;
  color: rgba(255, 255, 255, 0.9) !important;
  z-index: 10 !important;
  white-space: nowrap;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.4); /* Sombra sutil para destacar o cabeçalho do conteúdo rolando */
}

.custom-table :deep(td) {
  white-space: nowrap;
}

.col-arquivo { min-width: 220px; }
.col-conjunto { min-width: 160px; }
.col-formato { min-width: 100px; }
.col-tamanho { min-width: 110px; }
.col-hash { min-width: 160px; }
.col-data { min-width: 160px; }

.hash-column {
  max-width: 160px;
}

.font-mono {
  font-family: monospace, serif;
}

.table-scroll-wrapper::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}
.table-scroll-wrapper::-webkit-scrollbar-track {
  background: rgba(128, 128, 128, 0.1);
  border-radius: 4px;
}
.table-scroll-wrapper::-webkit-scrollbar-thumb {
  background: rgba(128, 128, 128, 0.3);
  border-radius: 4px;
}
.table-scroll-wrapper::-webkit-scrollbar-thumb:hover {
  background: rgba(128, 128, 128, 0.5);
}
</style>
