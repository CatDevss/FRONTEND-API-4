<template>
  <div>
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
        <v-col cols="8" md="4" class="pl-md-4 pt-4 pt-md-0">
          <v-select
            v-model="datasetFilter"
            :items="['Todos os conjuntos', ...datasetNames]"
            hide-details
            density="compact"
          />
        </v-col>
        <v-col cols="4" md="2" class="pl-4 pt-4 pt-md-0 text-right">
          <v-btn variant="outlined" prepend-icon="mdi-filter-outline">Filtrar</v-btn>
        </v-col>
      </v-row>
    </v-card>

    <v-card>
      <v-table>
        <thead>
          <tr>
            <th>Arquivo</th>
            <th>Conjunto</th>
            <th>Hash</th>
            <th>Enviado em</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="file in filteredFiles" :key="file.id">
            <td class="font-weight-medium">{{ file.name }}</td>
            <td>{{ file.dataset }}</td>
            <td class="font-mono text-caption">{{ file.hash }}</td>
            <td>{{ formatDateTime(file.sentAt) }}</td>
          </tr>
        </tbody>
      </v-table>

      <p v-if="filteredFiles.length === 0" class="text-medium-emphasis pa-4">
        Nenhum arquivo encontrado.
      </p>
    </v-card>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'

// TODO: substituir pela chamada ao back-end quando o endpoint de listagem existir
// (hoje só existe POST /conjuntos/{id}/arquivos, o de listagem ainda não)
interface UploadedFile {
  id: number
  name: string
  dataset: string
  hash: string
  sentAt: string // ISO date-time
}

//PUXAR DA BASE DE DADOS
const files: UploadedFile[] = [
  {
    id: 1,
    name: 'censo_agropecuario_2017.csv',
    dataset: 'Censo Agropecuário',
    hash: 'a1b2c3d4e5f60718293a4b5c6d7e8f90',
    sentAt: '2026-09-20T09:43:18',
  },
  {
    id: 2,
    name: 'licencas_ambientais_pr.csv',
    dataset: 'Licenças Ambientais',
    hash: '9f8e7d6c5b4a30291807f6e5d4c3b2a1',
    sentAt: '2026-09-21T14:12:05',
  },
]

const search = ref('')
const datasetFilter = ref('Todos os conjuntos')

const datasetNames = computed(() => [...new Set(files.map((f) => f.dataset))])

const filteredFiles = computed(() =>
  files.filter((f) => {
    const matchesSearch =
      f.name.toLowerCase().includes(search.value.toLowerCase()) ||
      f.dataset.toLowerCase().includes(search.value.toLowerCase())
    const matchesDataset = datasetFilter.value === 'Todos os conjuntos' || f.dataset === datasetFilter.value
    return matchesSearch && matchesDataset
  }),
)

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString('pt-BR')
}
</script>