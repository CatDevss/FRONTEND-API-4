<template>
  <v-dialog v-model="model" max-width="560">
    <v-card title="Nova fonte de dados">
      <v-form ref="form" v-model="valid" @submit.prevent="askConfirmation">
        <v-card-text>
          <v-text-field v-model="dataSource.name" label="Nome *" :rules="[required]" />
          <v-text-field
            v-model="dataSource.url"
            label="Endereço de acesso (URL) *"
            :rules="[required, validUrl]"
          />
        </v-card-text>
      </v-form>

      <v-card-actions>
        <v-spacer />
        <v-btn @click="close">Cancelar</v-btn>
        <v-btn color="primary" variant="flat" :disabled="!valid" @click="askConfirmation">
          Salvar fonte
        </v-btn>
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
import { nextTick, reactive, ref } from 'vue'
import ConfirmDialog from '@/components/ConfirmDialog.vue'

// Controls whether the popup is open (the parent screen uses it with v-model)
const model = defineModel<boolean>({ default: false })

// Controls the confirmation popup
const showConfirm = ref(false)

// The form reference and its state (true only when every rule passes)
const form = ref<{ resetValidation: () => void } | null>(null)
const valid = ref<boolean | null>(null)

// Values typed in the form
const dataSource = reactive({
  name: '',
  acronym: '',
  agency: '',
  url: '',
  description: '',
})

// Validation rules: return true when valid, or the error message
const required = (v: string | null) => (v ?? '').trim() !== '' || 'Campo obrigatório'
const validUrl = (v: string | null) =>
  /^https?:\/\/.+/.test(v ?? '') || 'Informe uma URL começando com http:// ou https://'

function askConfirmation() {
  // Safety net: an incomplete form never reaches the confirmation
  if (!valid.value) return
  showConfirm.value = true
}

async function clearForm() {
  Object.assign(dataSource, { name: '', acronym: '', agency: '', url: '', description: '' })
  await nextTick()
  form.value?.resetValidation()
}

function close() {
  clearForm()
  model.value = false
}

function save() {
  // For now it only closes the popup.
  // Later this is where the data source will be saved in the store.
  close()
}
</script>