<template>
  <div class="mx-auto" style="max-width: 900px">
    <h1 class="text-h5 font-weight-bold">Nova carga de dados</h1>
    <p class="text-medium-emphasis mb-4">
      Configure os parâmetros de ingestão e inicie o pipeline no Airflow
    </p>

    <!-- Indicador de etapas -->
    <div class="d-flex align-center ga-2 mb-6 text-caption">
      <template v-for="(step, i) in steps" :key="step.title">
        <v-icon v-if="i > 0" icon="mdi-chevron-right" size="small" />
        <span :class="step.unlocked ? 'text-primary font-weight-medium' : 'text-medium-emphasis'">
          {{ step.title }}
        </span>
      </template>
    </div>

    <!-- 1. Fonte de dados (sempre liberada) -->
    <v-card class="mb-6">
      <v-card-title class="d-flex align-center">
        1. Fonte de dados
        <v-spacer />
        <v-btn
          size="small"
          variant="outlined"
          prepend-icon="mdi-plus"
          @click="showDataSourceDialog = true"
        >
          Nova fonte
        </v-btn>
      </v-card-title>
      <v-card-subtitle v-if="!step2Unlocked">
        Selecione uma fonte ou cadastre uma nova
      </v-card-subtitle>
      <v-card-text>
        <v-progress-circular v-if="loadingSources" indeterminate color="primary" />
        <v-row v-else>
          <v-col v-for="s in sources" :key="s.id" cols="6" md="3">
            <v-card
              variant="outlined"
              :color="source === s.id ? 'primary' : undefined"
              class="pa-4 text-center h-100"
              role="button"
              tabindex="0"
              :aria-pressed="source === s.id"
              @click="selectSource(s)"
              @keydown.enter="selectSource(s)"
              @keydown.space.prevent="selectSource(s)"
            >
              <v-avatar
                rounded="lg"
                size="40"
                :color="source === s.id ? 'primary' : 'grey-lighten-2'"
              >
                {{ s.name.slice(0, 2).toUpperCase() }}
              </v-avatar>
              <div class="text-subtitle-2 mt-2">{{ s.name }}</div>
              <v-icon v-if="source === s.id" icon="mdi-check-circle" color="primary" class="mt-1" />
            </v-card>
          </v-col>

          <v-col v-if="sources.length === 0" cols="12">
            <p class="text-medium-emphasis">Nenhuma fonte cadastrada ainda.</p>
          </v-col>
        </v-row>
      </v-card-text>
    </v-card>

    <!-- 2. Conjunto (libera após escolher a fonte) -->
    <v-card class="mb-6" :disabled="!step2Unlocked">
      <v-card-title class="d-flex align-center">
        2. Conjunto
        <v-icon v-if="!step2Unlocked" icon="mdi-lock-outline" size="small" class="ml-1" />
        <v-spacer />
        <v-btn
          size="small"
          variant="outlined"
          prepend-icon="mdi-plus"
          @click="showDataSetDialog = true"
        >
          Novo conjunto
        </v-btn>
      </v-card-title>
      <v-card-subtitle v-if="!step2Unlocked">
        Escolha uma fonte de dados para liberar esta etapa.
      </v-card-subtitle>
      <v-card-text>
        <DatasetSelect
          :key="datasetSelectKey"
          v-model="dataset"
          :source-id="source"
          @update:name="datasetName = $event"
        />
      </v-card-text>
    </v-card>

    <!-- 3. Arquivo -->
    <v-card class="mb-6" :disabled="!step2Unlocked">
      <v-card-title>
        3. Arquivo
        <v-icon v-if="!step2Unlocked" icon="mdi-lock-outline" size="small" class="ml-1" />
      </v-card-title>
      <v-card-subtitle v-if="!step2Unlocked">
        Escolha uma fonte de dados para liberar esta etapa.
      </v-card-subtitle>
      <v-card-text>
        <FileUploadList v-model="uploadedFiles" :allowed-extensions="allowedExtensions" />
      </v-card-text>
    </v-card>

    <!-- 4. Resumo e ação -->
    <v-card class="mb-6">
      <v-card-title>
        4. Resumo da carga
        <v-icon v-if="!step4Unlocked" icon="mdi-lock-outline" size="small" class="ml-1" />
      </v-card-title>
      <v-card-subtitle v-if="!step4Unlocked">
        Anexe um arquivo para liberar o início da carga.
      </v-card-subtitle>
      <v-card-text>
        <v-row class="mb-4" :class="{ 'opacity-50': !step4Unlocked }">
          <v-col v-for="item in summary" :key="item.label" cols="12" sm="6">
            <v-card variant="outlined" class="pa-3">
              <div class="text-caption text-medium-emphasis text-uppercase">{{ item.label }}</div>
              <div class="text-subtitle-2">{{ item.value }}</div>
            </v-card>
          </v-col>
        </v-row>

        <v-btn
          color="primary"
          prepend-icon="mdi-lightning-bolt"
          :disabled="!step4Unlocked || isUploadInProgress"
          @click="showConfirm = true"
        >
          Iniciar carga
        </v-btn>
      </v-card-text>
    </v-card>

    <DataSourceDialog v-model="showDataSourceDialog" @saved="fetchSources" />
    <DataSetDialog v-model="showDataSetDialog" :source-id="source" @saved="fetchDatasetsAgain" />

    <ConfirmDialog
      v-model="showConfirm"
      title="Iniciar carga"
      message="Deseja iniciar a carga com os parâmetros selecionados?"
      @confirm="confirmStart"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import axios from 'axios'
import ConfirmDialog from '@/components/ConfirmDialog.vue'
import DataSourceDialog from '@/components/DataSourceDialog.vue'
import DataSetDialog from '@/components/DataSetDialog.vue'
import FileUploadList from '@/components/upload/FileUploadList.vue'
import DatasetSelect from '@/components/DatasetSelect.vue'
import { isUploadInProgress, startUpload } from '@/composables/uploadLock'

interface SourceOption {
  id: number
  name: string
}

const router = useRouter()
const showDataSourceDialog = ref(false)
const showDataSetDialog = ref(false)

const sources = ref<SourceOption[]>([])
const loadingSources = ref(false)

const datasetSelectKey = ref(0)

function fetchDatasetsAgain() {
  datasetSelectKey.value++
}

async function fetchSources() {
  loadingSources.value = true
  try {
    const { data } = await axios.get<SourceOption[]>('/fontes')
    sources.value = data
  } catch (error) {
    console.error('Erro ao carregar fontes', error)
  } finally {
    loadingSources.value = false
  }
}

onMounted(fetchSources)

// TODO: por enquanto fixo, no futuro vem de uma sessão de usuário real
const TEMP_USER_ID = 1

// Nothing is chosen at the beginning
const source = ref<number | null>(null)
const dataset = ref<number | null>(null)
const datasetName = ref('')
const uploadedFiles = ref<File[]>([])
const allowedExtensions = ['shp', 'gpkg', 'geojson', 'csv', 'tif', 'tiff']
const showConfirm = ref(false)

function selectSource(s: SourceOption) {
  source.value = s.id
  dataset.value = null // trocar de fonte limpa o conjunto escolhido
  datasetName.value = ''
}

const sourceName = computed(() => sources.value.find((s) => s.id === source.value)?.name ?? '')

// Each step is unlocked only when the previous one is complete
const step2Unlocked = computed(() => source.value !== null)

const step3Unlocked = computed(
  () => step2Unlocked.value && dataset.value !== null && uploadedFiles.value.length > 0,
)

const step4Unlocked = computed(() => step3Unlocked.value)

const steps = computed(() => [
  { title: '1. Fonte', unlocked: true },
  { title: '2. Conjunto', unlocked: step2Unlocked.value },
  { title: '3. Arquivo', unlocked: step3Unlocked.value },
  { title: '4. Confirmar', unlocked: step4Unlocked.value },
])

const summary = computed(() => [
  { label: 'Fonte', value: sourceName.value || '—' },
  { label: 'Conjunto', value: datasetName.value || '—' },
  {
    label: 'Arquivo',
    value:
      uploadedFiles.value.length > 0
        ? uploadedFiles.value.map((file) => file.name).join(', ')
        : '—',
  },
])

function cancel() {
  router.push('/home')
}

function confirmStart() {
  if (!step4Unlocked.value || dataset.value === null) return
  // Dispara o envio no gerenciador global — continua rodando mesmo se o usuário sair desta tela
  startUpload(dataset.value, uploadedFiles.value, TEMP_USER_ID)
}
</script>