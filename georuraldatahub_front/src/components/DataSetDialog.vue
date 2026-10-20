<template>
  <v-dialog v-model="model" max-width="560">
    <v-card title="Novo conjunto de dados">
      <v-form ref="form" v-model="valid" @submit.prevent="askConfirmation">
        <v-card-text>
          <v-text-field v-model="dataSet.name" label="Nome *" :rules="[required]" />

          <v-alert v-if="errorMessage" type="error" variant="tonal" density="compact" class="mb-2">
            {{ errorMessage }}
          </v-alert>
        </v-card-text>

        <v-card-actions>
          <v-spacer />
          <v-btn type="button" :disabled="saving" @click="close">Cancelar</v-btn>
          <v-btn type="submit" color="primary" variant="flat" :disabled="!valid" :loading="saving">
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
import axios from 'axios'
import { can, currentUserId } from '@/access/session'
import { apiError } from '@/services/contracts'
import ConfirmDialog from '@/components/ConfirmDialog.vue'

const props = defineProps<{ userId: number }>()
const emit = defineEmits<{ saved: [dataset: { id: number; name: string }] }>()
const model = defineModel<boolean>({ default: false })

const showConfirm = ref(false)
const saving = ref(false)
const errorMessage = ref('')

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
  errorMessage.value = ''
  model.value = false
}

async function save() {
  if (!can('datasets.manage') || currentUserId.value !== props.userId || saving.value) return
  saving.value = true
  errorMessage.value = ''

  try {
    const { data } = await axios.post<{ id: number; name: string }>('/conjuntos', {
      name: dataSet.name.trim(),
      userId: props.userId,
    })
    emit('saved', data)
    close()
  } catch (error) {
    errorMessage.value = apiError(error)
  } finally {
    saving.value = false
  }
}
</script>
