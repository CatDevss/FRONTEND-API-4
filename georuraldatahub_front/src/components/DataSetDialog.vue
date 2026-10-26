<template>
  <v-dialog v-model="model" max-width="560" :persistent="saving">
    <v-card title="Novo conjunto de dados">
      <v-form ref="form" @submit.prevent="save">
        <v-card-text>
          <p class="text-body-2 text-medium-emphasis mb-5">
            Crie o conjunto agora e escolha depois os arquivos das fontes que vão compô-lo.
          </p>
          <v-text-field
            v-model="dataSet.name"
            label="Nome do conjunto"
            placeholder="Ex.: Análise ambiental do Paraná"
            variant="outlined"
            autofocus
            :rules="[required]"
            :disabled="saving"
            maxlength="100"
          />

          <v-alert v-if="errorMessage" type="error" variant="tonal" density="compact" class="mb-2">
            {{ errorMessage }}
          </v-alert>
        </v-card-text>

        <v-card-actions>
          <v-spacer />
          <v-btn type="button" :disabled="saving" @click="close">Cancelar</v-btn>
          <v-btn
            type="submit"
            color="primary"
            variant="flat"
            :disabled="saving || !dataSet.name.trim()"
            :loading="saving"
          >
            Criar conjunto
          </v-btn>
        </v-card-actions>
      </v-form>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import { nextTick, reactive, ref, watch } from 'vue'
import axios from 'axios'
import { can, currentUserId } from '@/access/session'
import { apiError } from '@/services/contracts'

const props = defineProps<{ userId: number }>()
const emit = defineEmits<{ saved: [dataset: { id: number; name: string }] }>()
const model = defineModel<boolean>({ default: false })

const saving = ref(false)
const errorMessage = ref('')

const form = ref<{ resetValidation: () => void } | null>(null)

const dataSet = reactive({
  name: '',
})

const required = (v: string | null) => (v ?? '').trim() !== '' || 'Campo obrigatório'

async function clearForm() {
  Object.assign(dataSet, { name: '' })
  await nextTick()
  form.value?.resetValidation()
}

function close() {
  if (saving.value) return
  clearForm()
  errorMessage.value = ''
  model.value = false
}

async function save() {
  if (!can('datasets.manage') || currentUserId.value !== props.userId || saving.value) return
  if (!dataSet.name.trim()) {
    errorMessage.value = 'Informe o nome do conjunto.'
    return
  }
  saving.value = true
  errorMessage.value = ''

  try {
    const { data } = await axios.post<{ id: number; name: string }>('/conjuntos', {
      name: dataSet.name.trim(),
      userId: props.userId,
    })
    emit('saved', data)
    void clearForm()
    model.value = false
  } catch (error) {
    errorMessage.value = apiError(error)
  } finally {
    saving.value = false
  }
}
watch(model, (open) => {
  if (!open && !saving.value) {
    void clearForm()
    errorMessage.value = ''
  }
})
</script>
