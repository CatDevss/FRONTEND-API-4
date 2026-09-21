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
        <v-btn color="primary" variant="flat" @click="showConfirm = true">Salvar fonte</v-btn>
      </v-card-actions>

      <ConfirmDialog
        v-model="showConfirm"
        title="Salvar fonte"
        message="Deseja salvar a fonte cadastrada?"
        @confirm="save"
      />
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import { reactive, ref } from 'vue'
import ConfirmDialog from '@/components/ConfirmDialog.vue'

// Controls whether the popup is open (the parent screen uses it with v-model)
const model = defineModel<boolean>({ default: false })

// Controls the confirmation popup
const showConfirm = ref(false)

// Values typed in the form
const dataSource = reactive({
  name: '',
  acronym: '',
  agency: '',
  url: '',
  description: '',
})

function save() {
  // For now it only closes the popup.
  // Later this is where the data source will be saved in the store.
  model.value = false
}
</script>