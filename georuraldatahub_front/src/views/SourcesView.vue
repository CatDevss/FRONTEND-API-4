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
      <v-btn
        v-if="can('sources.create')"
        color="primary"
        prepend-icon="mdi-plus"
        @click="dialog = true"
        >Cadastrar fonte</v-btn
      >
    </header>
    <v-alert v-if="createdSource" type="success" variant="tonal" class="mb-4" role="status">
      Fonte {{ createdSource.name }} cadastrada. O próximo passo é definir os campos de validação.
      <v-btn :to="{ path: '/dictionaries', query: { source: createdSource.id } }" variant="text"
        >Configurar dicionário</v-btn
      >
    </v-alert>
    <div class="sources-toolbar">
      <v-text-field
        v-model="search"
        label="Buscar fonte por nome ou URL"
        prepend-inner-icon="mdi-magnify"
        variant="outlined"
        density="compact"
        hide-details
        clearable
      />
      <span class="text-caption text-medium-emphasis">{{ filteredSources.length }} fonte(s)</span>
      <v-btn
        variant="text"
        :loading="loading"
        :disabled="loading"
        prepend-icon="mdi-refresh"
        @click="load"
        >Atualizar</v-btn
      >
    </div>
    <v-alert v-if="error" type="error" class="my-4" role="alert">{{ error }}</v-alert>
    <v-progress-linear v-if="loading" indeterminate class="my-4" />
    <div class="source-list">
      <article v-for="source in filteredSources" :key="source.id" class="source-row">
        <div class="source-icon"><v-icon icon="mdi-database-outline" color="primary" /></div>
        <div class="source-info">
          <h2 class="text-subtitle-1 font-weight-bold">{{ source.name }}</h2>
          <p class="text-caption text-medium-emphasis">{{ source.url }}</p>
        </div>
        <v-btn
          v-if="can('dictionaries.read')"
          :to="{ path: '/dictionaries', query: { source: source.id } }"
          variant="tonal"
          size="small"
          prepend-icon="mdi-book-open-outline"
          >{{
            can('dictionaries.manage') ? 'Configurar dicionários' : 'Consultar dicionários'
          }}</v-btn
        >
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
            ? 'Tente outro nome ou endereço.'
            : 'Cadastre uma fonte e depois configure o dicionário que será usado nas ingestões.'
        }}
      </p>
      <v-btn
        v-if="!search && can('sources.create')"
        color="primary"
        class="mt-4"
        @click="dialog = true"
        >Cadastrar fonte</v-btn
      >
    </div>
    <DataSourceDialog
      v-if="currentUserId && can('sources.create')"
      v-model="dialog"
      :user-id="currentUserId"
      @saved="created"
    />
  </div>
</template>
<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import axios from 'axios'
import DataSourceDialog from '@/components/DataSourceDialog.vue'
import { can, currentUserId } from '@/access/session'
import { apiError, type Source } from '@/services/contracts'
const sources = ref<Source[]>([]),
  dialog = ref(false),
  loading = ref(false),
  error = ref('')
const search = ref(''),
  createdSource = ref<Source | null>(null)
const sourceOrder = new Intl.Collator('pt-BR', { sensitivity: 'base', numeric: true })
const filteredSources = computed(() => {
  const query = (search.value || '').trim().toLocaleLowerCase('pt-BR')
  return sources.value.filter((s) =>
    `${s.name} ${s.url}`.toLocaleLowerCase('pt-BR').includes(query),
  )
})
async function load() {
  if (loading.value) return
  loading.value = true
  error.value = ''
  try {
    const { data } = await axios.get<Source[]>('/fontes')
    sources.value = [...data].sort((a, b) => sourceOrder.compare(a.name, b.name) || a.id - b.id)
  } catch (e) {
    error.value = apiError(e)
  } finally {
    loading.value = false
  }
}
async function created(source: Source) {
  createdSource.value = source
  await load()
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
.source-info p {
  overflow-wrap: anywhere;
}
.source-empty {
  text-align: center;
  padding: 64px 20px;
}
@media (max-width: 650px) {
  .source-row {
    flex-wrap: wrap;
  }
  .source-row > .v-btn {
    margin-left: 60px;
  }
}
</style>
