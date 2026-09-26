<template>
  <div class="mx-auto" style="max-width: 1000px">
    <h1 class="text-h5 font-weight-bold mb-1">Arquivos enviados</h1>
    <p class="text-medium-emphasis mb-6">
      Lista dos arquivos enviados para a zona bruta, com hash e data de envio.
    </p>

    <v-card>
      <v-data-table :headers="headers" :items="files" :items-per-page="10">
        <template #item.sentAt="{ item }">
          {{ formatDateTime(item.sentAt) }}
        </template>

        <template #item.hash="{ item }">
          <span class="font-mono text-caption">{{ item.hash }}</span>
        </template>
      </v-data-table>
    </v-card>
  </div>
</template>

<script setup lang="ts">
// TODO: substituir pela chamada ao back-end quando o endpoint de listagem existir
// (hoje só existe POST /conjuntos/{id}/arquivos, o de listagem ainda não)
interface UploadedFile {
  id: number
  name: string
  dataset: string
  hash: string
  sentAt: string // ISO date-time
}

const headers = [
  { title: 'Arquivo', key: 'name' },
  { title: 'Conjunto', key: 'dataset' },
  { title: 'Hash', key: 'hash' },
  { title: 'Data/hora do envio', key: 'sentAt' },
]

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

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString('pt-BR')
}
</script>