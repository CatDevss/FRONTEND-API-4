<template>
  <div>
    <h1 class="text-h5 mb-3">Arquivos por fonte</h1>
    <p class="mb-4">
      Arquivos recebidos pelas fontes, inclusive os ainda sem conjunto. Consulte o relatório para
      saber quais registros foram aprovados.
    </p>
    <v-btn variant="outlined" :loading="loading" @click="fetchAll">Atualizar</v-btn>
    <v-select
      v-model="sourceFilter"
      :items="sources"
      item-title="name"
      item-value="id"
      label="Filtrar por fonte"
      clearable
      class="mt-4"
    />
    <v-text-field v-model="search" label="Buscar arquivo ou fonte" />
    <v-alert v-if="loadError" type="error" class="mb-4">{{ loadError }}</v-alert>
    <v-progress-linear v-if="loading" indeterminate />
    <v-table
      ><thead>
        <tr>
          <th>Arquivo</th>
          <th>Fonte</th>
          <th>Formato</th>
          <th>Tamanho</th>
          <th>SHA-256</th>
          <th>Recebido em</th>
          <th>Consultas</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="file in filteredFiles" :key="file.id">
          <td>{{ file.name }}</td>
          <td>{{ file.sourceName }}</td>
          <td>{{ file.formatFile }}</td>
          <td>{{ file.size }} bytes</td>
          <td class="hash" :title="file.hash || ''">{{ file.hash }}</td>
          <td>{{ file.receivedDate?.replace('T', ' ') }}</td>
          <td>
            <v-btn variant="text" @click="showReport(file.id)">Validação</v-btn
            ><v-btn variant="text" @click="showMetadata(file.id)">Origem da coleta</v-btn>
          </td>
        </tr>
      </tbody>
    </v-table>
    <p v-if="!loading && !filteredFiles.length" class="mt-4">Nenhum arquivo encontrado.</p>
    <v-dialog v-model="metadataDialog" max-width="900">
      <v-card title="Origem da coleta">
        <v-card-text>
          <v-progress-linear v-if="metadataLoading" indeterminate />
          <v-alert v-if="metadataError" type="warning">{{ metadataError }}</v-alert>
          <template v-if="metadata">
            <p>{{ metadata.product }} — {{ metadata.competence }}</p>
            <p>{{ metadata.scope }}</p>
            <p>
              Coletado em {{ new Date(metadata.collectedAt).toLocaleString('pt-BR') }}. Formato de
              origem: {{ metadata.originFormat }}; saída: {{ metadata.format }}.
            </p>
            <p v-for="limitation in metadata.limitations" :key="limitation">{{ limitation }}</p>
            <v-list
              ><v-list-item
                v-for="original in metadata.originals"
                :key="original.filename"
                :title="original.filename"
                :subtitle="original.origin"
                ><p class="text-caption" style="overflow-wrap: anywhere">
                  SHA-256: {{ original.sha256 }}
                </p></v-list-item
              ></v-list
            >
          </template>
        </v-card-text>
        <v-card-actions
          ><v-spacer /><v-btn @click="metadataDialog = false">Fechar</v-btn></v-card-actions
        >
      </v-card>
    </v-dialog>
    <v-dialog v-model="reportDialog" max-width="1100">
      <v-card title="Resultado da validação">
        <v-card-text>
          <v-progress-linear v-if="reportLoading" indeterminate />
          <v-alert v-if="reportError" type="error">{{ reportError }}</v-alert>
          <ValidationResult v-if="report" :report="report" />
        </v-card-text>
        <v-card-actions
          ><v-spacer /><v-btn @click="reportDialog = false">Fechar</v-btn></v-card-actions
        >
      </v-card>
    </v-dialog>
  </div>
</template>
<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import axios from 'axios'
import ValidationResult from '@/components/ValidationResult.vue'
import {
  apiError,
  type ValidationReport,
  type CollectionMetadata,
  type Source,
  type IngestedFile,
} from '@/services/contracts'
const metadataDialog = ref(false),
  metadataLoading = ref(false),
  metadataError = ref('')
const metadata = ref<CollectionMetadata | null>(null)
let metadataEpoch = 0
async function showMetadata(id: number) {
  const epoch = ++metadataEpoch
  metadataDialog.value = true
  metadataLoading.value = true
  metadata.value = null
  metadataError.value = ''
  try {
    const { data } = await axios.get<CollectionMetadata>(`/arquivos/${id}/coleta`)
    if (epoch === metadataEpoch) metadata.value = data
  } catch (e) {
    if (epoch === metadataEpoch)
      metadataError.value = apiError(
        e,
        'Metadados indisponíveis. Uploads manuais não possuem metadados de coleta automática.',
      )
  } finally {
    if (epoch === metadataEpoch) metadataLoading.value = false
  }
}
const reportDialog = ref(false),
  reportLoading = ref(false),
  reportError = ref('')
const report = ref<ValidationReport | null>(null)
let reportEpoch = 0
async function showReport(id: number) {
  const epoch = ++reportEpoch
  reportDialog.value = true
  reportLoading.value = true
  report.value = null
  reportError.value = ''
  try {
    const { data } = await axios.get<ValidationReport>(`/arquivos/${id}/validacao`)
    if (epoch === reportEpoch) report.value = data
  } catch (e) {
    if (epoch === reportEpoch)
      reportError.value = apiError(
        e,
        'Relatório indisponível. Não presuma que o arquivo foi aprovado.',
      )
  } finally {
    if (epoch === reportEpoch) reportLoading.value = false
  }
}

const search = ref(''),
  sourceFilter = ref<number | null>(null),
  loadError = ref(''),
  loading = ref(false)
const sources = ref<Source[]>([]),
  files = ref<(IngestedFile & { sourceId: number; sourceName: string })[]>([])
let epoch = 0
async function fetchAll() {
  const current = ++epoch
  loading.value = true
  loadError.value = ''
  try {
    const { data } = await axios.get<Source[]>('/fontes')
    if (current !== epoch) return
    sources.value = data
    const results = await Promise.allSettled(
      data.map(async (source) => {
        const response = await axios.get<IngestedFile[]>(`/fontes/${source.id}/arquivos`)
        return response.data.map((file) => ({
          ...file,
          sourceId: source.id,
          sourceName: source.name,
        }))
      }),
    )
    if (current !== epoch) return
    files.value = results
      .flatMap((r) => (r.status === 'fulfilled' ? r.value : []))
      .sort((a, b) => (b.receivedDate ?? '').localeCompare(a.receivedDate ?? ''))
    loadError.value = results
      .flatMap((r, i) =>
        r.status === 'rejected' ? [`${data[i]?.name}: ${apiError(r.reason)}`] : [],
      )
      .join(' ')
  } catch (e) {
    if (current === epoch) loadError.value = apiError(e)
  } finally {
    if (current === epoch) loading.value = false
  }
}
const filteredFiles = computed(() =>
  files.value.filter(
    (file) =>
      (!sourceFilter.value || file.sourceId === sourceFilter.value) &&
      `${file.name} ${file.sourceName}`.toLowerCase().includes(search.value.toLowerCase()),
  ),
)
onMounted(fetchAll)
</script>
<style scoped>
.hash {
  max-width: 160px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
