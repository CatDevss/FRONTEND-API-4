<template>
  <v-dialog v-model="model" max-width="560">
    <v-card title="Nova fonte de dados">
      <v-form ref="form" v-model="valid" @submit.prevent="askConfirmation">
        <v-card-text>
          <v-text-field v-model="dataSource.name" label="Nome *" :rules="[required]" />
          <v-text-field v-model="dataSource.acronym" label="Sigla *" :rules="[required]" />
          <v-text-field
            v-model="dataSource.agency"
            label="Órgão responsável *"
            :rules="[required]"
          />
          <v-text-field
            v-model="dataSource.url"
            label="Endereço de acesso (URL) *"
            :rules="[required, validUrl]"
          />
          <v-textarea v-model="dataSource.description" label="Descrição" rows="2" />

          <v-alert v-if="errorMessage" type="error" variant="tonal" density="compact" class="mb-2">
            {{ errorMessage }}
          </v-alert>
        </v-card-text>

        <v-card-actions>
          <v-spacer />
          <v-btn type="button" :disabled="saving" @click="close">Cancelar</v-btn>
          <v-btn type="submit" color="primary" variant="flat" :disabled="!valid" :loading="saving">
            Salvar fonte
          </v-btn>
        </v-card-actions>
      </v-form>

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
import axios from 'axios'
import ConfirmDialog from '@/components/ConfirmDialog.vue'

const emit = defineEmits<{ saved: [] }>()
const model = defineModel<boolean>({ default: false })

// TODO: por enquanto fixo, no futuro vem de uma sessão de usuário real
const TEMP_USER_ID = 1

const showConfirm = ref(false)
const saving = ref(false)
const errorMessage = ref('')

const form = ref<{ resetValidation: () => void } | null>(null)
const valid = ref<boolean | null>(null)

const dataSource = reactive({
  name: '',
  acronym: '',
  agency: '',
  url: '',
  description: '',
})

const required = (v: string | null) => (v ?? '').trim() !== '' || 'Campo obrigatório'
const validUrl = (v: string | null) =>
  /^https?:\/\/.+/.test(v ?? '') || 'Informe uma URL começando com http:// ou https://'

function askConfirmation() {
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
  errorMessage.value = ''
  model.value = false
}

async function save() {
  saving.value = true
  errorMessage.value = ''

  try {
    await axios.post('/fontes', {
      name: dataSource.name.trim(),
      url: dataSource.url.trim(),
      userId: TEMP_USER_ID,
    })
    emit('saved')
    close()
  } catch (error) {
    errorMessage.value = axios.isAxiosError(error)
      ? (error.response?.data?.message ?? 'Erro ao salvar a fonte.')
      : 'Erro desconhecido ao salvar a fonte.'
  } finally {
    saving.value = false
  }
}
</script>