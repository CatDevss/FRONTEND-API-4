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
      </v-card-title>  <v-card-text>
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

    <!-- 2. Abrangência geográfica -->
    <v-card class="mb-6" :disabled="!step2Unlocked">
      <v-card-title>
        2. Abrangência geográfica
        <v-icon v-if="!step2Unlocked" icon="mdi-lock-outline" size="small" class="ml-1" />
      </v-card-title>
      <v-card-subtitle v-if="!step2Unlocked">
        Escolha uma fonte de dados para liberar esta etapa.
      </v-card-subtitle>
      <v-card-text>
        <v-btn-toggle
          v-model="scope"
          mandatory
          color="primary"
          variant="outlined"
          divided
          class="mb-4"
          :disabled="!step2Unlocked"
        >
          <v-btn value="all">Todos os 399 municípios do Paraná</v-btn>
          <v-btn value="select">Selecionar municípios</v-btn>
        </v-btn-toggle>

        <div v-if="scope === 'select'">
          <v-text-field
            v-model="search"
            label="Buscar município..."
            prepend-inner-icon="mdi-magnify"
            hide-details
            class="mb-3"
          />
          <div class="border rounded pa-2" style="max-height: 240px; overflow-y: auto">
            <v-checkbox
              v-for="m in filteredMunicipalities"
              :key="m"
              v-model="selected"
              :value="m"
              :label="m"
              density="compact"
              hide-details
            />
          </div>
          <p v-if="selected.length > 0" class="text-caption text-primary mt-2">
            {{ selected.length }} município(s) selecionado(s)
          </p>
        </div>

        <v-alert
          v-else-if="scope === 'all'"
          color="primary"
          variant="tonal"
          density="compact"
          icon="mdi-check"
        >
          Todos os 399 municípios do Paraná serão incluídos na carga.
        </v-alert>
      </v-card-text>
    </v-card>

    <!-- 3. Agendamento -->
    <v-card class="mb-6" :disabled="!step3Unlocked">
      <v-card-title>
        3. Agendamento
        <v-icon v-if="!step3Unlocked" icon="mdi-lock-outline" size="small" class="ml-1" />
      </v-card-title>
      <v-card-subtitle v-if="!step3Unlocked">
        Defina a abrangência geográfica (e selecione ao menos um município, se for o caso)
        para liberar esta etapa.
      </v-card-subtitle>
      <v-card-text>
        <v-btn-toggle
          v-model="schedule"
          mandatory
          color="primary"
          variant="outlined"
          divided
          class="mb-4"
          :disabled="!step3Unlocked"
        >
          <v-btn value="now" prepend-icon="mdi-lightning-bolt">Executar agora</v-btn>
          <v-btn value="later" prepend-icon="mdi-calendar">Agendar para</v-btn>
        </v-btn-toggle>

        <v-row v-if="schedule === 'later'">
          <v-col cols="12" sm="8">
            <v-text-field
              v-model="scheduledDate"
              label="Data"
              type="date"
              :disabled="!step3Unlocked"
            />
          </v-col>
          <v-col cols="12" sm="4">
            <v-text-field
              v-model="scheduledTime"
              label="Horário"
              type="time"
              :disabled="!step3Unlocked"
            />
          </v-col>
        </v-row>

        <p v-else-if="schedule === 'now'" class="text-caption text-medium-emphasis">
          A carga será iniciada imediatamente no Airflow. Tempo estimado:
          <strong>~2h 40min</strong> para {{ totalMunicipalities }} municípios.
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
        Defina o agendamento para liberar o início da carga.
      </v-card-subtitle>
      <v-card-text>
        <v-row class="mb-4" :class="{ 'opacity-50': !step4Unlocked }">
          <v-col v-for="item in summary" :key="item.label" cols="12" sm="4">
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

    <ConfirmDialog
      v-model="showConfirm"
      title="Iniciar carga"
      message="Deseja iniciar a carga com os parâmetros selecionados?"
      @confirm="startLoad"
    />
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

const router = useRouter()

const TOTAL_MUNICIPALITIES = 399

const showDataSourceDialog = ref(false)

//PUXAR DA BASE DE DADOS
const sources = [
  { id: 'IBGE', label: 'IBGE', description: 'Censo Agropecuário' },
  { id: 'IBAMA', label: 'IBAMA', description: 'Licenças Ambientais' },
  { id: 'INCRA', label: 'INCRA', description: 'Georreferenciamento' },
  { id: 'MapBiomas', label: 'MapBiomas', description: 'Cobertura Vegetal' },
]

//PUXAR DA BASE DE DADOS
const municipalities = [
  'Curitiba', 'Londrina', 'Maringá', 'Cascavel', 'Ponta Grossa',
  'Foz do Iguaçu', 'Guarapuava', 'Paranaguá', 'Apucarana', 'Campo Mourão',
  'Araucária', 'Francisco Beltrão', 'Toledo', 'Pinhais', 'Colombo',
  'Almirante Tamandaré', 'Umuarama', 'Cambé', 'Ibiporã', 'Rolândia',
  'Sarandi', 'Cianorte', 'Fazenda Rio Grande', 'Paranavaí', 'Telêmaco Borba',
]

// Nothing is chosen at the beginning
const source = ref('')
const scope = ref<'all' | 'select' | null>(null)
const search = ref('')
const selected = ref<string[]>([])
const schedule = ref<'now' | 'later' | null>(null)
const scheduledDate = ref(new Date().toISOString().slice(0, 10))
const scheduledTime = ref('06:00')
const showMessage = ref(false)
const showConfirm = ref(false)

// Each step is unlocked only when the previous one is complete
const step2Unlocked = computed(() => source.value !== '')

const step3Unlocked = computed(
  () =>
    step2Unlocked.value &&
    (scope.value === 'all' || (scope.value === 'select' && selected.value.length > 0)),
)

const step4Unlocked = computed(
  () =>
    step3Unlocked.value &&
    (schedule.value === 'now' ||
      (schedule.value === 'later' && scheduledDate.value !== '' && scheduledTime.value !== '')),
)

const steps = computed(() => [
  { title: '1. Fonte', unlocked: true },
  { title: '2. Municípios', unlocked: step2Unlocked.value },
  { title: '3. Agendamento', unlocked: step3Unlocked.value },
  { title: '4. Confirmar', unlocked: step4Unlocked.value },
])

const filteredMunicipalities = computed(() =>
  municipalities.filter((m) => m.toLowerCase().includes(search.value.toLowerCase())),
)

const totalMunicipalities = computed(() =>
  scope.value === 'all' ? TOTAL_MUNICIPALITIES : selected.value.length,
)

const summary = computed(() => [
  { label: 'Fonte', value: source.value || '—' },
  {
    label: 'Municípios',
    value: scope.value ? `${totalMunicipalities.value} de ${TOTAL_MUNICIPALITIES}` : '—',
  },
  {
    label: 'Execução',
    value:
      schedule.value === 'now'
        ? 'Imediata'
        : schedule.value === 'later'
          ? `${scheduledDate.value} · ${scheduledTime.value}`
          : '—',
  },
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