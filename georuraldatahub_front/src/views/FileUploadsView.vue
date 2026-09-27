<template>
  <div>
    <p class="text-caption text-primary font-weight-bold text-uppercase mb-1">Ingestão</p>
    <h1 class="text-h5 font-weight-bold">Arquivos enviados</h1>
    <p class="text-medium-emphasis mb-6">
      Lista dos arquivos enviados para a zona bruta, com hash e data de envio.
    </p>

    <v-card class="mb-4 pa-4">
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

    <v-card>
      <v-progress-linear v-if="loading" indeterminate color="primary" />

      <v-alert v-if="loadError" type="error" variant="tonal" class="ma-4">
        {{ loadError }}
      </v-alert>

      <v-table v-else>
        <thead>
          <tr>
            <th>Arquivo</th>
            <th>Conjunto</th>
            <th>Formato</th>
            <th>Tamanho</th>
            <th>Hash</th>
            <th>Enviado em</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="file in filteredFiles" :key="file.id">
            <td class="font-weight-medium">{{ file.name }}</td>
            <td>{{ file.datasetName }}</td>
            <td>{{ file.formatFile ?? '—' }}</td>
            <td>{{ formatSize(file.size) }}</td>
            <td class="font-mono text-caption">{{ file.hash ?? '—' }}</td>
            <td>{{ formatDateTime(file.sentAt) }}</td>
          </tr>
        </tbody>
      </v-table>

      <p v-if="!loading && !loadError && filteredFiles.length === 0" class="text-medium-emphasis pa-4">
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
  versionDateCreation: string // ISO date-time
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
          sentAt: f.versionDateCreation,
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