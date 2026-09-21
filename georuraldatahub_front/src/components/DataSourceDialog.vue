<template>
  <v-dialog v-model="model" max-width="560">
    <v-card title="Nova fonte de dados">
      <v-card-text>
        <v-text-field v-model="dataSource.name" label="Nome *" />
        <v-text-field v-model="dataSource.acronym" label="Sigla *" />
        <v-text-field v-model="dataSource.agency" label="Órgão responsável *" />
        <v-text-field v-model="dataSource.url" label="Endereço de acesso (URL) *" />
        <v-textarea v-model="dataSource.description" label="Descrição" rows="2" />
      </v-card-text>
      <v-card-actions>
        <v-spacer />
        <v-btn @click="model = false">Cancelar</v-btn>
        <v-btn color="primary" variant="flat">Salvar fonte</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import { reactive } from 'vue'

// Controls whether the popup is open (the parent screen uses it with v-model)
const model = defineModel<boolean>({ default: false })

// Values typed in the form
const dataSource = reactive({
  name: '',
  acronym: '',
  agency: '',
  url: '',
  description: '',
})
</script>