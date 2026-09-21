<template>
  <div class="mx-auto" style="max-width: 900px">
    <h1 class="text-h5 font-weight-bold">Nova carga de dados</h1>
    <p class="text-medium-emphasis mb-4">
      Configure os parâmetros de ingestão e inicie o pipeline no Airflow
    </p>

    <v-breadcrumbs
      :items="['1. Fonte', '2. Municípios', '3. Agendamento', '4. Confirmar']"
      divider="›"
      class="pa-0 mb-6"
    />

    <!-- 1. Fonte de dados -->
    <v-card class="mb-6">
      <v-card-title>1. Fonte de dados</v-card-title>
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

    <!-- 2. Abrangência geográfica -->
    <v-card class="mb-6">
      <v-card-title>2. Abrangência geográfica</v-card-title>
      <v-card-text>
        <v-btn-toggle v-model="scope" mandatory color="primary" variant="outlined" divided class="mb-4">
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

        <v-alert v-else color="primary" variant="tonal" density="compact" icon="mdi-check">
          Todos os 399 municípios do Paraná serão incluídos na carga.
        </v-alert>
      </v-card-text>
    </v-card>

    <!-- 3. Agendamento -->
    <v-card class="mb-6">
      <v-card-title>3. Agendamento</v-card-title>
      <v-card-text>
        <v-btn-toggle v-model="schedule" mandatory color="primary" variant="outlined" divided class="mb-4">
          <v-btn value="now" prepend-icon="mdi-lightning-bolt">Executar agora</v-btn>
          <v-btn value="later" prepend-icon="mdi-calendar">Agendar para</v-btn>
        </v-btn-toggle>

        <v-row v-if="schedule === 'later'">
          <v-col cols="12" sm="8">
            <v-text-field v-model="scheduledDate" label="Data" type="date" />
          </v-col>
          <v-col cols="12" sm="4">
            <v-text-field v-model="scheduledTime" label="Horário" type="time" />
          </v-col>
        </v-row>

        <p v-else class="text-caption text-medium-emphasis">
          A carga será iniciada imediatamente no Airflow. Tempo estimado:
          <strong>~2h 40min</strong> para {{ totalMunicipalities }} municípios.
        </p>
      </v-card-text>
    </v-card>

    <!-- Resumo e ação -->
    <v-card class="mb-6">
      <v-card-title>Resumo da carga</v-card-title>
      <v-card-text>
        <v-row class="mb-4">
          <v-col v-for="item in summary" :key="item.label" cols="12" sm="4">
            <v-card variant="outlined" class="pa-3">
              <div class="text-caption text-medium-emphasis text-uppercase">{{ item.label }}</div>
              <div class="text-subtitle-2">{{ item.value }}</div>
            </v-card>
          </v-col>
        </v-row>

        <v-btn variant="outlined" class="mr-3" @click="cancel">Cancelar</v-btn>
        <v-btn color="primary" prepend-icon="mdi-lightning-bolt" @click="startLoad">
          Iniciar carga
        </v-btn>
      </v-card-text>
    </v-card>

    <v-snackbar v-model="showMessage" :timeout="3000">Carga iniciada (simulação).</v-snackbar>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()

const TOTAL_MUNICIPALITIES = 399

const sources = [
  { id: 'IBGE', label: 'IBGE', description: 'Censo Agropecuário' },
  { id: 'IBAMA', label: 'IBAMA', description: 'Licenças Ambientais' },
  { id: 'INCRA', label: 'INCRA', description: 'Georreferenciamento' },
  { id: 'MapBiomas', label: 'MapBiomas', description: 'Cobertura Vegetal' },
]

const municipalities = [
  'Curitiba', 'Londrina', 'Maringá', 'Cascavel', 'Ponta Grossa',
  'Foz do Iguaçu', 'Guarapuava', 'Paranaguá', 'Apucarana', 'Campo Mourão',
  'Araucária', 'Francisco Beltrão', 'Toledo', 'Pinhais', 'Colombo',
  'Almirante Tamandaré', 'Umuarama', 'Cambé', 'Ibiporã', 'Rolândia',
  'Sarandi', 'Cianorte', 'Fazenda Rio Grande', 'Paranavaí', 'Telêmaco Borba',
]

const source = ref('IBGE')
const scope = ref<'all' | 'select'>('all')
const search = ref('')
const selected = ref<string[]>([])
const schedule = ref<'now' | 'later'>('now')
const scheduledDate = ref(new Date().toISOString().slice(0, 10))
const scheduledTime = ref('06:00')
const showMessage = ref(false)

const filteredMunicipalities = computed(() =>
  municipalities.filter((m) => m.toLowerCase().includes(search.value.toLowerCase())),
)

const totalMunicipalities = computed(() =>
  scope.value === 'all' ? TOTAL_MUNICIPALITIES : selected.value.length,
)

const summary = computed(() => [
  { label: 'Fonte', value: source.value },
  { label: 'Municípios', value: `${totalMunicipalities.value} de ${TOTAL_MUNICIPALITIES}` },
  {
    label: 'Execução',
    value: schedule.value === 'now' ? 'Imediata' : `${scheduledDate.value} · ${scheduledTime.value}`,
  },
])

function cancel() {
  router.push('/home')
}

function startLoad() {
  // For now only shows a message. When the load tracking screen exists,
  // replace this with: router.push('/load-tracking')
  showMessage.value = true
}
</script>