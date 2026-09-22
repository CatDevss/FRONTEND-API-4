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
        <v-row>
          <v-col v-for="s in sources" :key="s.id" cols="6" md="3">
            <v-card
              variant="outlined"
              :color="source === s.id ? 'primary' : undefined"
              class="pa-4 text-center h-100"
              @click="source = s.id"
            >
              <v-avatar
                rounded="lg"
                size="40"
                :color="source === s.id ? 'primary' : 'grey-lighten-2'"
              >
                {{ s.id.slice(0, 2) }}
              </v-avatar>
              <div class="text-subtitle-2 mt-2">{{ s.label }}</div>
              <div class="text-caption text-medium-emphasis">{{ s.description }}</div>
              <v-icon v-if="source === s.id" icon="mdi-check-circle" color="primary" class="mt-1" />
            </v-card>
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
        <!-- TODO: seleção de conjunto cadastrado ainda não implementada -->
        <p class="text-caption text-medium-emphasis">
          Seleção de conjunto em construção. Por enquanto, cadastre um conjunto com o botão acima.
        </p>
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
        <v-file-input
          v-model="uploadedFile"
          label="Arquivo de dados *"
          accept=".csv,.json,.xlsx"
          prepend-icon="mdi-paperclip"
          show-size
          :disabled="!step2Unlocked"
        />
        <p v-if="uploadedFile" class="text-caption text-primary mt-2">
          Arquivo selecionado: {{ uploadedFile.name }}
        </p>
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

        <v-btn variant="outlined" class="mr-3" @click="cancel">Cancelar</v-btn>
        <v-btn
          color="primary"
          prepend-icon="mdi-lightning-bolt"
          :disabled="!step4Unlocked"
          @click="showConfirm = true"
        >
          Iniciar carga
        </v-btn>
      </v-card-text>
    </v-card>

    <DataSourceDialog v-model="showDataSourceDialog" />
    <DataSetDialog v-model="showDataSetDialog" />

    <ConfirmDialog
      v-model="showConfirm"
      title="Iniciar carga"
      message="Deseja iniciar a carga com os parâmetros selecionados?"
      @confirm="startLoad"
    />

    <v-snackbar v-model="showMessage" :timeout="3000">Carga iniciada (simulação).</v-snackbar>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import ConfirmDialog from '@/components/ConfirmDialog.vue'
import DataSourceDialog from '@/components/DataSourceDialog.vue'
import DataSetDialog from '@/components/DataSetDialog.vue'

const router = useRouter()

const showDataSourceDialog = ref(false)
const showDataSetDialog = ref(false)

//PUXAR DA BASE DE DADOS
const sources = [
  { id: 'IBGE', label: 'IBGE', description: 'Censo Agropecuário' },
  { id: 'IBAMA', label: 'IBAMA', description: 'Licenças Ambientais' },
  { id: 'INCRA', label: 'INCRA', description: 'Georreferenciamento' },
  { id: 'MapBiomas', label: 'MapBiomas', description: 'Cobertura Vegetal' },
]

// Nothing is chosen at the beginning
const source = ref('')
const uploadedFile = ref<File | null>(null)
const showMessage = ref(false)
const showConfirm = ref(false)

// Each step is unlocked only when the previous one is complete
const step2Unlocked = computed(() => source.value !== '')

// TODO: quando a seleção de conjunto existir, incluir essa condição aqui também
const step3Unlocked = computed(() => step2Unlocked.value && uploadedFile.value !== null)

const step4Unlocked = computed(() => step3Unlocked.value)

const steps = computed(() => [
  { title: '1. Fonte', unlocked: true },
  { title: '2. Conjunto', unlocked: step2Unlocked.value },
  { title: '3. Arquivo', unlocked: step3Unlocked.value },
  { title: '4. Confirmar', unlocked: step4Unlocked.value },
])

const summary = computed(() => [
  { label: 'Fonte', value: source.value || '—' },
  { label: 'Arquivo', value: uploadedFile.value ? uploadedFile.value.name : '—' },
])

function cancel() {
  router.push('/home')
}

function startLoad() {
  if (!step4Unlocked.value) return
  // For now only shows a message. When the load tracking screen exists,
  // replace this with: router.push('/load-tracking')
  showMessage.value = true
}
</script>
