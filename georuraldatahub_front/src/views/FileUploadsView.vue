<template>
  <div class="files-page">
    <header class="files-heading">
      <div>
        <p class="eyebrow">BIBLIOTECA DE DADOS</p>
        <h1 class="text-h5 font-weight-bold">Arquivos por fonte</h1>
        <p class="text-body-2 text-medium-emphasis mt-1">
          Explore os arquivos recebidos, inclusive os ainda sem conjunto, e consulte sua validação e
          origem.
        </p>
      </div>
      <div class="heading-actions">
        <v-btn
          variant="outlined"
          prepend-icon="mdi-refresh"
          :loading="loading"
          :disabled="loading"
          @click="fetchAll"
          >Atualizar</v-btn
        >
        <v-btn v-if="can('ingestion.run')" to="/new-load" color="primary" prepend-icon="mdi-plus"
          >Nova ingestão</v-btn
        >
      </div>
    </header>

    <div class="library-summary" aria-label="Resumo dos arquivos carregados">
      <div class="summary-item">
        <span class="summary-icon"
          ><v-icon icon="mdi-file-document-multiple-outline" size="22"
        /></span>
        <div>
          <strong>{{ files.length }}</strong
          ><span>Arquivos carregados</span>
        </div>
      </div>
      <div class="summary-item">
        <span class="summary-icon"><v-icon icon="mdi-database-outline" size="22" /></span>
        <div>
          <strong>{{ sourceCount }}</strong
          ><span>Fontes com arquivos</span>
        </div>
      </div>
      <div class="summary-item">
        <span class="summary-icon"><v-icon icon="mdi-harddisk" size="22" /></span>
        <div>
          <strong>{{ formatBytes(totalSize) }}</strong
          ><span>Volume carregado</span>
        </div>
      </div>
    </div>

    <section class="file-library" aria-label="Biblioteca de arquivos">
      <div class="library-toolbar">
        <v-text-field
          v-model="search"
          label="Buscar arquivos"
          placeholder="Nome, fonte, formato ou hash"
          prepend-inner-icon="mdi-magnify"
          variant="outlined"
          density="compact"
          hide-details
          clearable
          class="library-search"
        />
        <span class="result-count" role="status" aria-live="polite"
          >{{ filteredFiles.length }} de {{ files.length }} arquivo(s)</span
        >
      </div>
      <p class="search-hint">
        Uma busca para encontrar arquivos pelo nome, fonte, formato ou hash SHA-256.
      </p>
      <v-alert v-if="loadError" type="error" variant="tonal" class="library-error" role="alert">{{
        loadError
      }}</v-alert>
      <v-progress-linear
        v-if="loading"
        indeterminate
        color="primary"
        height="2"
        aria-label="Carregando arquivos"
      />
      <v-table v-if="filteredFiles.length" class="files-table">
        <thead>
          <tr>
            <th>Arquivo</th>
            <th>Fonte</th>
            <th>Formato</th>
            <th>Recebido em</th>
            <th>SHA-256</th>
            <th class="text-right">Consultas</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="file in filteredFiles" :key="file.id" class="file-row">
            <td>
              <div class="file-identity">
                <span class="file-mark"
                  ><v-icon :icon="fileIcon(file.formatFile)" size="22"
                /></span>
                <div class="file-name-block">
                  <span class="file-name">{{ file.name }}</span
                  ><span class="file-size">{{ formatBytes(file.size) }}</span>
                </div>
              </div>
            </td>
            <td>
              <span class="file-source">{{ file.sourceName }}</span>
            </td>
            <td>
              <span class="format-badge">{{ file.formatFile || 'Não informado' }}</span>
            </td>
            <td>
              <time
                :datetime="file.receivedDate || undefined"
                :title="file.receivedDate || undefined"
                class="file-date"
                >{{ formatReceived(file.receivedDate) }}</time
              >
            </td>
            <td>
              <code class="hash" :title="file.hash || undefined">{{
                file.hash || 'Não informado'
              }}</code>
            </td>
            <td>
              <div class="file-actions">
                <v-btn
                  variant="tonal"
                  color="primary"
                  size="small"
                  prepend-icon="mdi-clipboard-check-outline"
                  :aria-label="`Consultar validação de ${file.name}`"
                  @click="showReport(file.id)"
                  >Validação</v-btn
                ><v-btn
                  variant="text"
                  size="small"
                  prepend-icon="mdi-source-branch"
                  :aria-label="`Consultar origem da coleta de ${file.name}`"
                  @click="showMetadata(file.id)"
                  >Origem da coleta</v-btn
                >
              </div>
            </td>
          </tr>
        </tbody>
      </v-table>
      <div v-else-if="!loading" class="library-empty">
        <span class="empty-icon"
          ><v-icon
            :icon="files.length ? 'mdi-file-search-outline' : 'mdi-file-document-multiple-outline'"
            size="32"
        /></span>
        <h2 class="text-h6 mt-4">
          {{
            files.length
              ? 'Nenhum arquivo encontrado'
              : loadError
                ? 'Não foi possível carregar os arquivos'
                : 'Seus arquivos começam por uma fonte'
          }}
        </h2>
        <p>
          {{
            files.length
              ? 'Tente outro nome, fonte, formato ou hash.'
              : loadError
                ? 'Confira a mensagem da API e tente atualizar a listagem.'
                : 'Os arquivos enviados ou coletados aparecem aqui, mesmo antes de fazerem parte de um conjunto.'
          }}
        </p>
        <v-btn v-if="search" variant="tonal" class="mt-4" @click="search = ''">Limpar busca</v-btn>
        <v-btn
          v-else-if="!loadError && can('ingestion.run')"
          to="/new-load"
          variant="tonal"
          color="primary"
          class="mt-4"
          >Fazer primeira ingestão</v-btn
        >
      </div>
      <div v-else class="library-loading">
        <v-icon icon="mdi-file-sync-outline" color="primary" size="28" />
        <p>Carregando arquivos das fontes…</p>
      </div>
      <footer class="library-footer">
        <v-icon icon="mdi-information-outline" size="16" />
        <p>
          A presença de um arquivo nesta lista não indica aprovação. Consulte a validação para
          conferir quais registros podem ser utilizados.
        </p>
      </footer>
    </section>
    <v-dialog v-model="metadataDialog" max-width="900">
      <v-card title="Origem da coleta">
        <p class="dialog-file-name">{{ metadataFileName }}</p>
        <v-card-text>
          <v-progress-linear v-if="metadataLoading" indeterminate />
          <v-alert v-if="metadataError" type="warning"
            >{{ metadataError
            }}<v-btn
              v-if="metadataFileId !== null"
              variant="text"
              @click="showMetadata(metadataFileId)"
              >Tentar novamente</v-btn
            ></v-alert
          >
          <template v-if="metadata">
            <div class="metadata-summary">
              <div>
                <span>Produto</span><strong>{{ metadata.product }}</strong>
              </div>
              <div>
                <span>Competência</span><strong>{{ metadata.competence }}</strong>
              </div>
              <div>
                <span>Escopo</span><strong>{{ metadata.scope }}</strong>
              </div>
            </div>
            <p>
              Coletado em {{ new Date(metadata.collectedAt).toLocaleString('pt-BR') }}. Formato de
              origem: {{ metadata.originFormat }}; saída: {{ metadata.format }}.
            </p>
            <v-alert
              v-if="metadata.limitations.length"
              type="info"
              variant="tonal"
              density="compact"
              class="my-3"
              ><p v-for="limitation in metadata.limitations" :key="limitation">
                {{ limitation }}
              </p></v-alert
            >
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
          <p v-if="!metadata && !metadataLoading && !metadataError">
            Nenhum metadado de coleta disponível para este arquivo.
          </p>
        </v-card-text>
        <v-card-actions
          ><v-spacer /><v-btn @click="metadataDialog = false">Fechar</v-btn></v-card-actions
        >
      </v-card>
    </v-dialog>
    <v-dialog v-model="reportDialog" max-width="1100">
      <v-card title="Resultado da validação">
        <p class="dialog-file-name">{{ reportFileName }}</p>
        <v-card-text>
          <v-progress-linear v-if="reportLoading" indeterminate />
          <v-alert v-if="reportError" type="error"
            >{{ reportError
            }}<v-btn v-if="reportFileId !== null" variant="text" @click="showReport(reportFileId)"
              >Tentar novamente</v-btn
            ></v-alert
          >
          <ValidationResult v-if="report" :report="report" />
          <p v-else-if="!reportLoading && !reportError">
            Validação indisponível. Não presuma que o arquivo foi aprovado.
          </p>
        </v-card-text>
        <v-card-actions
          ><v-spacer /><v-btn @click="reportDialog = false">Fechar</v-btn></v-card-actions
        >
      </v-card>
    </v-dialog>
  </div>
</template>
<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { can } from '@/access/session'
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
const metadata = ref<CollectionMetadata | null>(null),
  metadataFileId = ref<number | null>(null),
  metadataFileName = ref('')
let metadataEpoch = 0
async function showMetadata(id: number) {
  metadataFileId.value = id
  metadataFileName.value = files.value.find((file) => file.id === id)?.name ?? `Arquivo ${id}`
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
const report = ref<ValidationReport | null>(null),
  reportFileId = ref<number | null>(null),
  reportFileName = ref('')
let reportEpoch = 0
async function showReport(id: number) {
  reportFileId.value = id
  reportFileName.value = files.value.find((file) => file.id === id)?.name ?? `Arquivo ${id}`
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
  loadError = ref(''),
  loading = ref(false)
const files = ref<(IngestedFile & { sourceId: number; sourceName: string })[]>([])
let epoch = 0
async function fetchAll() {
  if (loading.value) return
  const current = ++epoch
  loading.value = true
  loadError.value = ''
  try {
    const { data } = await axios.get<Source[]>('/fontes')
    if (current !== epoch) return
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
      .sort(
        (a, b) =>
          (b.receivedDate ?? '').localeCompare(a.receivedDate ?? '') ||
          a.sourceName.localeCompare(b.sourceName, 'pt-BR') ||
          a.name.localeCompare(b.name, 'pt-BR') ||
          a.id - b.id,
      )
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
function normalize(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('pt-BR')
}
const filteredFiles = computed(() => {
  const terms = normalize(search.value || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
  return files.value.filter((file) => {
    const text = normalize(
      `${file.name} ${file.sourceName} ${file.formatFile ?? ''} ${file.hash ?? ''}`,
    )
    return terms.every((term) => text.includes(term))
  })
})
const sourceCount = computed(() => new Set(files.value.map((file) => file.sourceId)).size)
const totalSize = computed(() =>
  files.value.reduce(
    (total, file) => total + (Number.isFinite(file.size) && file.size > 0 ? file.size : 0),
    0,
  ),
)
function formatBytes(size: number) {
  if (!Number.isFinite(size) || size < 0) return 'Não informado'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const index =
    size > 0
      ? Math.max(0, Math.min(Math.floor(Math.log(size) / Math.log(1024)), units.length - 1))
      : 0
  return `${new Intl.NumberFormat('pt-BR', { maximumFractionDigits: index ? 1 : 0 }).format(size / 1024 ** index)} ${units[index]}`
}
function formatReceived(value: string) {
  if (!value) return 'Não informado'
  const date = value.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(\.\d+)?)?/)
  return date
    ? `${date[3]}/${date[2]}/${date[1]} às ${date[4]}:${date[5]}${date[6] ? `:${date[6]}${date[7] || ''}` : ''}`
    : value.replace('T', ' ')
}
function fileIcon(format: string | null) {
  return format?.toLowerCase() === 'csv'
    ? 'mdi-file-delimited-outline'
    : ['geojson', 'json'].includes(format?.toLowerCase() ?? '')
      ? 'mdi-code-json'
      : 'mdi-file-outline'
}
onMounted(fetchAll)
onBeforeUnmount(() => {
  ++epoch
  ++reportEpoch
  ++metadataEpoch
})
</script>
<style scoped>
.files-page {
  max-width: 1500px;
  margin: auto;
}
.files-heading,
.heading-actions {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}
.files-heading {
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
.library-summary {
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
.file-library {
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
  padding: 20px 20px 6px;
}
.library-search {
  flex: 1;
  min-width: 200px;
  max-width: 640px;
}
.result-count {
  margin-left: auto;
  font-size: 11px;
  color: rgba(var(--v-theme-on-surface), 0.55);
}
.search-hint {
  padding: 0 20px 16px;
  font-size: 11px;
  color: rgba(var(--v-theme-on-surface), 0.5);
}
.library-error {
  margin: 0 20px 16px;
}
.files-table :deep(table) {
  min-width: 900px;
}
.files-table :deep(th) {
  font-size: 11px;
  font-weight: 500;
  white-space: nowrap;
}
.files-table :deep(td) {
  padding-block: 16px !important;
  border-color: var(--glass-outer-border) !important;
}
.file-row:hover {
  background: rgba(var(--v-theme-on-surface), 0.025);
}
.file-identity {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 180px;
}
.file-mark {
  color: rgb(var(--v-theme-primary));
  opacity: 0.85;
  display: flex;
  flex-shrink: 0;
}
.file-name-block {
  display: grid;
  gap: 4px;
}
.file-name {
  font-size: 12px;
  font-weight: 500;
  overflow-wrap: anywhere;
  max-width: 300px;
}
.file-size {
  font-size: 10px;
  color: rgba(var(--v-theme-on-surface), 0.5);
}
.file-source {
  font-size: 12px;
}
.format-badge {
  display: inline-flex;
  padding: 3px 7px;
  border: 1px solid var(--glass-outer-border);
  border-radius: 6px;
  font-size: 9px;
  text-transform: uppercase;
  color: rgba(var(--v-theme-on-surface), 0.65);
}
.file-date {
  font-size: 11px;
  white-space: nowrap;
  color: rgba(var(--v-theme-on-surface), 0.65);
}
.hash {
  display: block;
  max-width: 110px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 10px;
  color: rgba(var(--v-theme-on-surface), 0.45);
}
.file-actions {
  display: flex;
  justify-content: flex-end;
  gap: 4px;
  flex-wrap: wrap;
  min-width: 140px;
}
.file-actions :deep(.v-btn) {
  text-transform: none;
  letter-spacing: 0;
  font-size: 10px;
  border-radius: 9px;
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
  margin-top: 1px;
  flex-shrink: 0;
}
.library-empty,
.library-loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  padding: 56px 24px;
}
.empty-icon {
  width: 64px;
  height: 64px;
  border-radius: 20px;
}
.library-empty p {
  max-width: 430px;
  font-size: 12px;
  line-height: 1.7;
  color: rgba(var(--v-theme-on-surface), 0.6);
  margin-top: 8px;
}
.library-loading p {
  font-size: 12px;
  margin-top: 12px;
  color: rgba(var(--v-theme-on-surface), 0.6);
}
.dialog-file-name {
  padding: 0 24px;
  font-size: 12px;
  color: rgba(var(--v-theme-on-surface), 0.6);
  overflow-wrap: anywhere;
}
.metadata-summary {
  display: flex;
  flex-wrap: wrap;
  gap: 24px;
  margin-bottom: 20px;
}
.metadata-summary > div {
  display: grid;
  gap: 4px;
}
.metadata-summary span {
  font-size: 10px;
  color: rgba(var(--v-theme-on-surface), 0.55);
}
.metadata-summary strong {
  font-size: 13px;
  font-weight: 500;
}
@media (max-width: 900px) {
  .library-summary {
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
@media (max-width: 600px) {
  .library-summary {
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
  .library-toolbar {
    padding: 16px 16px 6px;
    gap: 10px;
  }
  .search-hint {
    padding-inline: 16px;
  }
  .result-count {
    margin-left: 0;
  }
}
</style>
