<template>
  <div class="sources-page">
    <header class="sources-heading">
      <div>
        <p class="eyebrow">ORIGEM DOS DADOS</p>
        <h1 class="text-h5 font-weight-bold">Fontes de dados</h1>
        <p class="text-body-2 text-medium-emphasis mt-1">
          Cadastre a origem, configure seu dicionário e acompanhe os arquivos recebidos.
        </p>
      </div>

      ```
      <v-btn v-if="can('sources.create')" color="primary" prepend-icon="mdi-plus" @click="openCreate">
        Cadastrar fonte
      </v-btn>
    </header>

    <v-alert v-if="createdSource" type="success" variant="tonal" class="mb-4" role="status">
      Fonte {{ createdSource.name }} cadastrada.
      O próximo passo é definir os campos de validação.

      <v-btn :to="{ path: '/dictionaries', query: { source: createdSource.id } }" variant="text">
        Configurar dicionário
      </v-btn>
    </v-alert>

    <v-alert v-if="successMessage" type="success" variant="tonal" class="mb-4" closable
      @click:close="successMessage = ''">
      {{ successMessage }}
    </v-alert>

    <div class="sources-toolbar">
      <v-text-field v-model="search" label="Buscar fonte por nome, URL ou descrição" prepend-inner-icon="mdi-magnify"
        variant="outlined" density="compact" hide-details clearable />

      <v-select v-model="statusFilter" label="Status" :items="statusOptions" variant="outlined" density="compact"
        hide-details style="max-width: 180px" />

      <span class="text-caption text-medium-emphasis">
        {{ filteredSources.length }} fonte(s)
      </span>

      <v-btn variant="text" :loading="loading" :disabled="loading" prepend-icon="mdi-refresh" @click="load">
        Atualizar
      </v-btn>
    </div>

    <v-alert v-if="error" type="error" class="my-4" role="alert">
      {{ error }}
    </v-alert>

    <v-progress-linear v-if="loading" indeterminate class="my-4" />

    <div class="source-list">
      <article v-for="source in filteredSources" :key="source.id" class="source-row">
        <div class="source-icon">
          <v-icon icon="mdi-database-outline" color="primary" />
        </div>

        <div class="source-info">
          <div class="source-title">
            <h2 class="text-subtitle-1 font-weight-bold">
              {{ source.name }}
            </h2>

            <v-chip :color="isActive(source) ? 'success' : 'default'"
              :prepend-icon="isActive(source) ? 'mdi-check-circle' : 'mdi-close-circle'" size="small" variant="tonal">
              {{ isActive(source) ? 'Ativa' : 'Inativa' }}
            </v-chip>
          </div>

          <a v-if="source.url" :href="source.url" target="_blank" rel="noopener noreferrer"
            class="source-url text-caption">
            {{ source.url }}
          </a>

          <p class="source-description text-body-2 mt-2">
            {{ source.description || 'Nenhuma descrição cadastrada.' }}
          </p>
        </div>

        <div class="source-actions">
          <v-btn v-if="can('sources.update')" variant="tonal" size="small" prepend-icon="mdi-pencil-outline"
            @click="openEdit(source)">
            Editar
          </v-btn>

          <v-btn v-if="can('sources.update')" :color="isActive(source) ? 'warning' : 'success'"
            :prepend-icon="isActive(source) ? 'mdi-pause-circle-outline' : 'mdi-check-circle-outline'" variant="tonal"
            size="small" :loading="changingStatusId === source.id" :disabled="changingStatusId !== null"
            @click="toggleStatus(source)">
            {{ isActive(source) ? 'Desativar' : 'Ativar' }}
          </v-btn>

          <v-btn v-if="can('dictionaries.read')" :to="{ path: '/dictionaries', query: { source: source.id } }"
            variant="tonal" size="small" prepend-icon="mdi-book-open-outline">
            {{ can('dictionaries.manage') ? 'Configurar dicionários' : 'Consultar dicionários' }}
          </v-btn>
        </div>
      </article>
    </div>

    <div v-if="!loading && !error && !filteredSources.length" class="source-empty">
      <v-icon icon="mdi-database-search-outline" size="40" color="primary" />

      <h2 class="text-h6 mt-3">
        {{ search ? 'Nenhuma fonte encontrada' : 'Comece pela origem dos dados' }}
      </h2>

      <p class="text-body-2 text-medium-emphasis mt-2">
        {{
          search
            ? 'Tente outro nome, endereço ou descrição, ou altere o filtro de status.'
            : 'Cadastre uma fonte e depois configure o dicionário que será usado nas ingestões.'
        }}
      </p>

      <v-btn v-if="!search && can('sources.create')" color="primary" class="mt-4" @click="openCreate">
        Cadastrar fonte
      </v-btn>
    </div>

    <DataSourceDialog v-if="currentUserId && (can('sources.create') || can('sources.update'))" v-model="dialog"
      :user-id="currentUserId" :source="selectedSource" @saved="handleSaved" />

  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import axios from 'axios'
import DataSourceDialog from '@/components/DataSourceDialog.vue'
import { can, currentUserId } from '@/access/session'
import { apiError, type Source } from '@/services/contracts'

const sources = ref<Source[]>([])
const dialog = ref(false)
const loading = ref(false)
const error = ref('')
const search = ref('')
const createdSource = ref<Source | null>(null)
const successMessage = ref('')
const selectedSource = ref<Source | null>(null)
const changingStatusId = ref<number | null>(null)
const statusFilter = ref<'all' | 'active' | 'inactive'>('all')

const statusOptions = [
  { title: 'Todas', value: 'all' },
  { title: 'Ativas', value: 'active' },
  { title: 'Inativas', value: 'inactive' },
]

const sourceOrder = new Intl.Collator('pt-BR', {
  sensitivity: 'base',
  numeric: true,
})

let pendingReload = false
let inFlightLoad: Promise<void> | null = null

function isActive(source: Source): boolean {
  return source.status === 1 
}

const filteredSources = computed(() => {
  const query = (search.value || '').trim().toLocaleLowerCase('pt-BR')

  return sources.value
    .filter((source) => {
      const matchesSearch =
        `${source.name} ${source.url} ${source.description || ''}`
          .toLocaleLowerCase('pt-BR')
          .includes(query)

      const matchesStatus =
        statusFilter.value === 'all' ||
        (statusFilter.value === 'active' && isActive(source)) ||
        (statusFilter.value === 'inactive' && !isActive(source))

      return matchesSearch && matchesStatus
    })
    .sort(
      (a, b) =>
        sourceOrder.compare(a.name, b.name) || a.id - b.id,
    )
})

async function load() {
  if (loading.value) {
    pendingReload = true

    while (loading.value && inFlightLoad) {
      await inFlightLoad
    }

    return
  }

  loading.value = true

  try {
    do {
      pendingReload = false
      error.value = ''

      inFlightLoad = axios
        .get<Source[]>('/fontes')
        .then(({ data }) => {
          sources.value = [...data].sort(
            (a, b) =>
              sourceOrder.compare(a.name, b.name) || a.id - b.id,
          )
        })
        .catch((e) => {
          error.value = apiError(e)
        })

      await inFlightLoad
    } while (pendingReload)
  } finally {
    inFlightLoad = null
    loading.value = false
  }
}

function openCreate() {
  selectedSource.value = null
  createdSource.value = null
  dialog.value = true
}

function openEdit(source: Source) {
  selectedSource.value = { ...source }
  createdSource.value = null
  dialog.value = true
}

async function handleSaved(source: Source) {
  dialog.value = false

  if (selectedSource.value) {
    successMessage.value = 'Fonte atualizada com sucesso.'
  } else {
    createdSource.value = source
    successMessage.value = ''
  }

  selectedSource.value = null

  await load()
}


async function toggleStatus(source: Source) {
  const activate = !isActive(source)

  try {
    error.value = ''

    if (activate) {
      await axios.patch(`/fontes/${source.id}/ativar`)
    } else {
      await axios.patch(`/fontes/${source.id}/desativar`)
    }

    await load()
  } catch (e) {
    error.value = apiError(e)
  }
}

onMounted(load)
</script>

<style scoped>
.sources-page {
  max-width: 1400px;
  margin: auto;
}

.sources-heading,
.sources-toolbar,
.source-row {
  display: flex;
  align-items: center;
  gap: 16px;
}

.sources-heading {
  justify-content: space-between;
  flex-wrap: wrap;
  margin-bottom: 28px;
}

.eyebrow {
  font-size: 10px;
  letter-spacing: 0.12em;
  font-weight: 700;
  color: rgb(var(--v-theme-primary));
  margin-bottom: 6px;
}

.sources-toolbar {
  flex-wrap: wrap;
  margin-bottom: 20px;
}

.sources-toolbar :deep(.v-input) {
  flex: 1;
  min-width: 200px;
  max-width: 500px;
}

.source-list {
  border-top: 1px solid var(--glass-outer-border);
}

.source-row {
  padding: 20px 8px;
  border-bottom: 1px solid var(--glass-outer-border);
}

.source-icon {
  padding: 10px;
  border-radius: 12px;
  background: rgba(var(--v-theme-primary), 0.08);
}

.source-info {
  flex: 1;
  min-width: 0;
}

.source-title {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 10px;
}

.source-url {
  display: inline-block;
  margin-top: 4px;
  overflow-wrap: anywhere;
}

.source-description {
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

.source-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  flex-wrap: wrap;
  gap: 8px;
}

.source-empty {
  text-align: center;
  padding: 64px 20px;
}

@media (max-width: 900px) {
  .source-row {
    align-items: flex-start;
    flex-wrap: wrap;
  }

  .source-info {
    flex-basis: calc(100% - 70px);
  }

  .source-actions {
    width: 100%;
    margin-left: 60px;
    justify-content: flex-start;
  }
}

@media (max-width: 650px) {
  .source-actions {
    margin-left: 0;
  }
}
</style>
