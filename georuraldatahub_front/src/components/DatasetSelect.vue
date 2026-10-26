<template>
  <v-alert v-if="errorMessage" type="error">{{ errorMessage }}</v-alert>
  <v-row v-if="!loading">
    <v-col v-for="d in datasets" :key="d.id" cols="6" md="4">
      <v-card
        variant="outlined"
        :color="modelValue === d.id ? 'primary' : undefined"
        class="pa-4 h-100"
        role="button"
        :aria-pressed="modelValue === d.id"
        :aria-disabled="disabled"
        :tabindex="disabled ? -1 : 0"
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
      <p class="text-medium-emphasis">Nenhum conjunto cadastrado.</p>
    </v-col>
  </v-row>

  <v-progress-circular v-else indeterminate color="primary" />
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import axios from 'axios'
import { apiError } from '@/services/contracts'

interface DatasetOption {
  id: number
  name: string
  userId: number
}

const props = defineProps<{ disabled?: boolean }>()
const modelValue = defineModel<number | null>({ default: null })

const emit = defineEmits<{ 'update:name': [name: string] }>()

const loading = ref(false)
const errorMessage = ref('')
const datasets = ref<DatasetOption[]>([])

async function fetchDatasets() {
  loading.value = true
  try {
    const { data } = await axios.get<DatasetOption[]>('/conjuntos')
    datasets.value = data
  } catch (error) {
    errorMessage.value = apiError(error)
  } finally {
    loading.value = false
  }
}

onMounted(fetchDatasets)

function select(d: DatasetOption) {
  if (props.disabled) return
  modelValue.value = d.id
  emit('update:name', d.name)
}
</script>
