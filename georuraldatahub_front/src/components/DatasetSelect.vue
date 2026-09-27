<template>
  <v-row v-if="!loading">
    <v-col v-for="d in datasets" :key="d.id" cols="6" md="4">
      <v-card
        variant="outlined"
        :color="modelValue === d.id ? 'primary' : undefined"
        class="pa-4 h-100"
        role="button"
        tabindex="0"
        :aria-pressed="modelValue === d.id"
        @click="select(d)"
        @keydown.enter="select(d)"
        @keydown.space.prevent="select(d)"
      >
        <div class="d-flex align-center justify-space-between">
          <div class="text-subtitle-2">{{ d.name }}</div>
          <v-icon v-if="modelValue === d.id" icon="mdi-check-circle" color="primary" />
        </div>
      </v-card>
    </v-col>

    <v-col v-if="datasets.length === 0" cols="12">
      <p class="text-medium-emphasis">Nenhum conjunto cadastrado para esta fonte.</p>
    </v-col>
  </v-row>

  <v-progress-circular v-else indeterminate color="primary" />
</template>

<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import axios from 'axios'

interface DatasetOption {
  id: number
  name: string
  sourceId: number
}

const props = defineProps<{ sourceId: number | null }>()
const modelValue = defineModel<number | null>({ default: null })

const emit = defineEmits<{ 'update:name': [name: string] }>()

const loading = ref(false)
const allDatasets = ref<DatasetOption[]>([])
const datasets = ref<DatasetOption[]>([])

async function fetchDatasets() {
  loading.value = true
  try {
    const { data } = await axios.get<DatasetOption[]>('/conjuntos')
    allDatasets.value = data
    filterBySource()
  } catch (error) {
    console.error('Erro ao carregar conjuntos', error)
  } finally {
    loading.value = false
  }
}

function filterBySource() {
  datasets.value = props.sourceId
    ? allDatasets.value.filter((d) => d.sourceId === props.sourceId)
    : []
}

watch(() => props.sourceId, filterBySource)

onMounted(fetchDatasets)

function select(d: DatasetOption) {
  modelValue.value = d.id
  emit('update:name', d.name)
}
</script>