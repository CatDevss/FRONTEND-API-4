<template>
  <v-row>
    <v-col v-for="d in datasets" :key="d.id" cols="6" md="4">
      <v-card
        variant="outlined"
        :color="modelValue === d.id ? 'primary' : undefined"
        class="pa-4 h-100"
        role="button"
        tabindex="0"
        :aria-pressed="modelValue === d.id"
        @click="select(d.id)"
        @keydown.enter="select(d.id)"
        @keydown.space.prevent="select(d.id)"
      >
        <div class="d-flex align-center justify-space-between">
          <div>
            <div class="text-subtitle-2">{{ d.name }}</div>
            <div class="text-caption text-medium-emphasis">{{ d.frequency }}</div>
          </div>
          <v-icon v-if="modelValue === d.id" icon="mdi-check-circle" color="primary" />
        </div>
      </v-card>
    </v-col>

    <v-col v-if="datasets.length === 0" cols="12">
      <p class="text-medium-emphasis">Nenhum conjunto cadastrado ainda.</p>
    </v-col>
  </v-row>
</template>

<script setup lang="ts">
interface DatasetOption {
  id: string
  name: string
  frequency: string
}

const modelValue = defineModel<string>({ default: '' })

// TODO: filtrar por fonte selecionada e vir da store quando ela existir
//PUXAR DA BASE DE DADOS
const datasets: DatasetOption[] = [
  { id: 'censo-agropecuario', name: 'Censo Agropecuário', frequency: 'Anual' },
  { id: 'licencas-ambientais', name: 'Licenças Ambientais', frequency: 'Mensal' },
  { id: 'georreferenciamento', name: 'Georreferenciamento', frequency: 'Sob demanda' },
]

function select(id: string) {
  modelValue.value = id
}
</script>