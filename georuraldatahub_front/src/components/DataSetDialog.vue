<template>
  <v-dialog v-model="model" max-width="560">
    <v-card title="Novo conjunto de dados">
      <v-form ref="form" v-model="valid" @submit.prevent="askConfirmation">
        <v-card-text>
          <v-text-field v-model="dataSet.name" label="Nome *" :rules="[required]" />
        </v-card-text>

        <v-card-actions>
          <v-spacer />
          <v-btn type="button" @click="close">Cancelar</v-btn>
          <v-btn type="submit" color="primary" variant="flat" :disabled="!valid">
            Salvar conjunto
          </v-btn>
        </v-card-actions>
      </v-form>

      <ConfirmDialog
        v-model="showConfirm"
        title="Salvar conjunto"
        message="Deseja salvar o conjunto cadastrado?"
        @confirm="save"
      />
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import { nextTick, reactive, ref } from 'vue'
import ConfirmDialog from '@/components/ConfirmDialog.vue'

const model = defineModel<boolean>({ default: false })

const showConfirm = ref(false)

const form = ref<{ resetValidation: () => void } | null>(null)
const valid = ref<boolean | null>(null)

const dataSet = reactive({
  name: '',
})

const required = (v: string | null) => (v ?? '').trim() !== '' || 'Campo obrigatório'

function askConfirmation() {
  if (!valid.value) return
  showConfirm.value = true
}

async function clearForm() {
  Object.assign(dataSet, { name: '' })
  await nextTick()
  form.value?.resetValidation()
}

function close() {
  clearForm()
  model.value = false
}

function save() {
  close()
}
</script>