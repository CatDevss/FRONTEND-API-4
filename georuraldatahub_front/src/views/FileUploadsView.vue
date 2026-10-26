<template>
  <div class="files-page">
    <header class="files-heading">
      <div>
        <p class="eyebrow">BIBLIOTECA DE DADOS</p>
        <h1 class="text-h5 font-weight-bold">Arquivos</h1>
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

    <section class="stage-section" aria-label="Arquivos por etapa e ocorrências de quarentena">
      <div class="stage-heading">
        <h2>Etapas e quarentena</h2>
        <p>
          Bruta reúne todos os arquivos recebidos. Quarentena inclui arquivos com rejeição total ou
          parcial e seu histórico de análise. Tratada e Publicada consideram a versão mais recente.
          Um arquivo pode aparecer em mais de um grupo.
        </p>
      </div>
      <v-alert
        v-if="stagesError"
        type="warning"
        variant="tonal"
        density="compact"
        class="stage-error"
        role="alert"
        >{{ stagesError }}</v-alert
      >
      <v-alert
        v-if="quarantinesError"
        type="warning"
        variant="tonal"
        density="compact"
        class="quarantine-error stage-error"
        role="alert"
        >Não foi possível conferir as ocorrências de quarentena. {{ quarantinesError }} Use
        Atualizar para tentar novamente.</v-alert
      >
      <div class="stage-summary">
        <button
          v-for="stage in stageCards"
          :key="stage.status"
          type="button"
          class="stage-card"
          :class="[`stage-${stage.key}`, { active: stageFilter === stage.status }]"
          :aria-pressed="stageFilter === stage.status"
          :aria-label="`${stage.label}: ${stage.count} arquivo(s). ${stage.status === 'BRUTA' ? 'Mostrar todos os arquivos recebidos.' : 'Filtrar a lista por esta etapa.'}`"
          :disabled="loading || !stage.available"
          @click="toggleStage(stage.status)"
        >
          <span class="stage-icon"><v-icon :icon="stage.icon" size="22" /></span>
          <span class="stage-body">
            <span class="stage-label">{{ stage.label }}</span>
            <strong class="stage-count">{{ stage.count }}</strong>
            <span class="stage-hint">{{ stage.hint }}</span>
          </span>
        </button>
      </div>
      <p v-if="stagesLoaded && withoutStage" class="stage-note">
        {{ withoutStage }} arquivo(s) sem versão registrada.
      </p>
    </section>

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
            <th>Etapa / Quarentena</th>
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
              <div class="file-stage">
                <span
                  class="stage-badge"
                  :class="`stage-${file.badge.key}`"
                  :title="file.badge.title || undefined"
                  >{{ file.badge.label }}</span
                >
                <v-btn
                  v-if="file.quarantine"
                  class="quarantine-link"
                  variant="text"
                  color="warning"
                  size="x-small"
                  :to="{ path: '/quarantine', query: { fileId: String(file.id) } }"
                  :title="file.quarantine.title"
                  :aria-label="`Consultar quarentena de ${file.name}: ${file.quarantine.label}`"
                  >{{ file.quarantine.label }}</v-btn
                >
              </div>
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
              ? stageFilter && stageFilter !== 'BRUTA'
                ? 'Nenhum arquivo está na etapa selecionada com esta busca.'
                : 'Tente outro nome, fonte, formato ou hash.'
              : loadError
                ? 'Confira a mensagem da API e tente atualizar a listagem.'
                : 'Os arquivos enviados ou coletados aparecem aqui, mesmo antes de fazerem parte de um conjunto.'
          }}
        </p>
        <v-btn v-if="search" variant="tonal" class="mt-4" @click="search = ''">Limpar busca</v-btn>
        <v-btn v-if="stageFilter" variant="tonal" class="mt-4 ml-2" @click="stageFilter = null"
          >Mostrar todas as etapas</v-btn
        >
        <v-btn
          v-else-if="!search && !loadError && can('ingestion.run')"
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
          <ValidationResult v-if="report" :report="report" :file-id="reportFileId" />
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
  quarantineClosed,
  quarantineStatus,
  type QuarantinePage,
  type QuarantineRecord,
} from '@/services/quarantine'
import {
  apiError,
  versionStatuses,
  type ValidationReport,
  type CollectionMetadata,
  type Source,
  type IngestedFile,
  type FileStage,
  type VersionStatus,
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

// A etapa atual vem de /arquivos/etapas; ocorrências de quarentena são independentes dela.
// Rótulo, ícone e descrição de cada etapa, na ordem do fluxo.
const stageInfo: Record<VersionStatus, { label: string; icon: string; hint: string }> = {
  BRUTA: {
    label: 'Bruta',
    icon: 'mdi-database-import-outline',
    hint: 'Todos os arquivos recebidos.',
  },
  QUARENTENA: {
    label: 'Quarentena',
    icon: 'mdi-shield-alert-outline',
    hint: 'Rejeições totais ou parciais, incluindo análises encerradas.',
  },
  TRATADA: {
    label: 'Tratada',
    icon: 'mdi-auto-fix',
    hint: 'Já passaram por tratamento.',
  },
  PUBLICADA: {
    label: 'Publicada',
    icon: 'mdi-publish',
    hint: 'Liberados para uso.',
  },
}
// Mapa fileId -> etapa atual. stagesLoaded só vira true quando a API respondeu com sucesso.
const stages = ref<Record<number, FileStage>>({})
const stagesLoaded = ref(false),
  stagesError = ref('')
const quarantines = ref<Record<number, QuarantineRecord[]>>({})
const quarantinesLoaded = ref(false),
  quarantinesError = ref('')
// Etapa escolhida nos cards para filtrar a tabela (null = todas).
const stageFilter = ref<VersionStatus | null>(null)
function toggleStage(status: VersionStatus) {
  stageFilter.value = stageFilter.value === status ? null : status
}
// Nunca lança erro: se as etapas falharem, a lista de arquivos continua funcionando.
async function loadStages(current: number) {
  try {
    const { data } = await axios.get<FileStage[]>('/arquivos/etapas')
    if (current !== epoch) return
    if (!Array.isArray(data)) throw new Error('Resposta inválida de /arquivos/etapas')
    stages.value = Object.fromEntries(data.map((stage) => [stage.fileId, stage]))
    stagesLoaded.value = true
    stagesError.value = ''
  } catch (e) {
    if (current !== epoch) return
    stages.value = {}
    stagesLoaded.value = false
    stagesError.value = apiError(e, 'Não foi possível carregar as etapas dos arquivos.')
  }
}

async function loadQuarantines(current: number) {
  const byFile: Record<number, QuarantineRecord[]> = {}
  const seen = new Set<number>()
  try {
    // Sem filtro de status ou responsável: assumir/resolver não elimina a rejeição original.
    for (let page = 0; ; page++) {
      const { data } = await axios.get<QuarantinePage>('/quarentenas', {
        params: { page, size: 100 },
      })
      if (current !== epoch) return
      if (
        !Array.isArray(data.content) ||
        data.page !== page ||
        !Number.isInteger(data.totalPages) ||
        data.totalPages < 0
      )
        throw new Error('Resposta inválida de /quarentenas')
      for (const record of data.content) {
        if (record.fileId === null || seen.has(record.id)) continue
        seen.add(record.id)
        const records = (byFile[record.fileId] ??= [])
        records.push(record)
      }
      if (page + 1 >= data.totalPages) break
    }
    quarantines.value = byFile
    quarantinesLoaded.value = true
    quarantinesError.value = ''
  } catch (e) {
    if (current !== epoch) return
    // Não publicar um índice incompleto se uma das páginas falhar.
    quarantines.value = {}
    quarantinesLoaded.value = false
    quarantinesError.value = apiError(e, 'Consulta de quarentena indisponível.')
  }
}

async function fetchAll() {
  if (loading.value) return
  const current = ++epoch
  loading.value = true
  loadError.value = ''
  try {
    const [{ data }] = await Promise.all([
      axios.get<Source[]>('/fontes'),
      loadStages(current),
      loadQuarantines(current),
    ])
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
// Selo da etapa de um arquivo: texto, chave de cor e dica (versão e local no bucket).
function stageBadge(fileId: number) {
  const stage = stages.value[fileId]
  const info = stage ? stageInfo[stage.status] : undefined
  if (!stage || !info)
    return { key: 'unknown', label: stagesLoaded.value ? 'Sem etapa' : '—', title: '' }
  return {
    key: stage.status.toLowerCase(),
    label: info.label,
    title: `Versão ${stage.versionNumber}${stage.location ? ` · ${stage.location}` : ''}`,
  }
}
function hasQuarantine(fileId: number) {
  return !!quarantines.value[fileId]?.length || stages.value[fileId]?.status === 'QUARENTENA'
}
function quarantineBadge(fileId: number) {
  const records = quarantines.value[fileId]
  if (!records?.length) return null
  const active = records.filter((record) => !quarantineClosed(record))
  const status = active[0]?.status
  const label =
    active.length === 0
      ? 'Quarentena encerrada'
      : active.length > 1
        ? `Quarentena · ${active.length} análises abertas`
        : status === 'REGISTROS_REJEITADOS'
          ? 'Quarentena parcial'
          : status === 'EM_ANALISE'
            ? 'Quarentena · em análise'
            : status === 'ARQUIVO_REJEITADO'
              ? 'Arquivo em quarentena'
              : 'Ocorrência de quarentena'
  return {
    label,
    title: `${records.map((record) => `#${record.id}: ${quarantineStatus(record.status)}`).join('\n')}\nEncerrar a análise não aprova os registros rejeitados.`,
  }
}
const filteredFiles = computed(() => {
  const terms = normalize(search.value || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
  return files.value
    .filter((file) => {
      if (
        stageFilter.value &&
        stageFilter.value !== 'BRUTA' &&
        (stageFilter.value === 'QUARENTENA'
          ? !hasQuarantine(file.id)
          : stages.value[file.id]?.status !== stageFilter.value)
      )
        return false
      const text = normalize(
        `${file.name} ${file.sourceName} ${file.formatFile ?? ''} ${file.hash ?? ''}`,
      )
      return terms.every((term) => text.includes(term))
    })
    .map((file) => ({ ...file, badge: stageBadge(file.id), quarantine: quarantineBadge(file.id) }))
})
// Contagens por arquivo: rejeições parciais podem coexistir com registros tratados/publicados.
const stageTotals = computed(() => {
  const counts: Record<VersionStatus, number> = {
    BRUTA: files.value.length,
    QUARENTENA: 0,
    TRATADA: 0,
    PUBLICADA: 0,
  }
  let missing = 0
  for (const file of files.value) {
    if (hasQuarantine(file.id)) counts.QUARENTENA++
    const status = stages.value[file.id]?.status
    if (status && status in counts) {
      if (status === 'TRATADA' || status === 'PUBLICADA') counts[status]++
    } else missing++
  }
  return { counts, missing }
})
const withoutStage = computed(() => stageTotals.value.missing)
function stageAvailable(status: VersionStatus) {
  return (
    status === 'BRUTA' || (status === 'QUARENTENA' ? quarantinesLoaded.value : stagesLoaded.value)
  )
}
const stageCards = computed(() =>
  versionStatuses.map((status) => ({
    status,
    key: status.toLowerCase(),
    ...stageInfo[status],
    available: stageAvailable(status),
    count: stageAvailable(status) ? String(stageTotals.value.counts[status]) : '—',
  })),
)
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
function formatReceived(dateString: string | null | undefined): string {
  if (!dateString) return ''
  return new Date(dateString).toLocaleString('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'medium',
  })
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
@import '@/assets/fileuploads.css';
</style>
