<template>
  <v-dialog v-model="model" max-width="560" persistent>
    <v-card :title="isEditing ? 'Editar fonte de dados' : 'Nova fonte de dados'">
      <v-form ref="form" v-model="valid" @submit.prevent="askConfirmation">
        <v-card-text>
          <v-text-field v-model="dataSource.name" label="Nome *" :rules="[required]" maxlength="100" />
          
          <v-text-field v-model="dataSource.url" label="Endereço de acesso (URL) *" :rules="[required, validUrl]"
            maxlength="200" />

          <v-textarea v-model="dataSource.description" label="Descrição"
            placeholder="Descreva a origem e a finalidade dos dados." hint="Campo opcional. Máximo de 500 caracteres."
            persistent-hint counter="500" maxlength="500" rows="3" auto-grow />

          <v-alert v-if="errorMessage" type="error" variant="tonal" density="compact" class="mb-2">
            {{ errorMessage }}
          </v-alert>
        </v-card-text>

        <v-card-actions>
          <v-spacer />

          <v-btn type="button" :disabled="saving" @click="close">
            Cancelar
          </v-btn>

          <v-btn type="submit" color="primary" variant="flat" :disabled="!valid || saving" :loading="saving">
            {{ isEditing ? 'Salvar alterações' : 'Salvar fonte' }}
          </v-btn>
        </v-card-actions>
      </v-form>

      <ConfirmDialog v-model="showConfirm" :title="isEditing ? 'Editar fonte' : 'Cadastrar fonte'" :message="isEditing
          ? 'Deseja salvar as alterações desta fonte?'
          : 'Deseja cadastrar esta fonte?'
        " @confirm="save" />
    </v-card>
    ```

  </v-dialog>
</template>

<script setup lang="ts">
import { computed, nextTick, reactive, ref, watch } from 'vue'
import axios from 'axios'
import { can, currentUserId } from '@/access/session'
import { apiError, type Source } from '@/services/contracts'
import ConfirmDialog from '@/components/ConfirmDialog.vue'

const props = defineProps<{
  userId: number
  source?: Source | null
}>()

const emit = defineEmits<{
  saved: [source: Source]
}>()

const model = defineModel<boolean>({ default: false })

const showConfirm = ref(false)
const saving = ref(false)
const errorMessage = ref('')
const valid = ref<boolean | null>(null)

const form = ref<{
  resetValidation: () => void
  validate: () => Promise<{ valid: boolean }>
} | null>(null)

const isEditing = computed(() => props.source != null)

const dataSource = reactive({
  name: '',
  url: '',
  description: '',
})

const required = (value: string | null) =>
  (value ?? '').trim() !== '' || 'Campo obrigatório'

const validUrl = (value: string | null) => {
  try {
    const url = new URL((value ?? '').trim())

    return (
      ['http:', 'https:'].includes(url.protocol) ||
      'Informe uma URL começando com http:// ou https://'
    )
  } catch {
    return 'Informe uma URL válida'
  }
}

watch(
  [model, () => props.source],
  async ([isOpen, source]) => {
    if (!isOpen) return

    Object.assign(dataSource, {
      name: source?.name ?? '',
      url: source?.url ?? '',
      description: source?.description ?? '',
    })

    errorMessage.value = ''
    showConfirm.value = false

    await nextTick()
    form.value?.resetValidation()
  },
  { immediate: true },
)

function askConfirmation() {
  if (!valid.value || saving.value) return

  showConfirm.value = true
}

async function close() {
  if (saving.value) return

  showConfirm.value = false
  model.value = false
  errorMessage.value = ''

  Object.assign(dataSource, {
    name: '',
    url: '',
    description: '',
  })

  await nextTick()
  form.value?.resetValidation()
}

async function save() {
  if (saving.value) return

  if (isEditing.value) {
    if (!can('sources.update')) return
  } else {
    if (!can('sources.create')) return
    if (currentUserId.value !== props.userId) return
  }

  const result = await form.value?.validate()

  if (!result?.valid) return

  saving.value = true
  errorMessage.value = ''

  const payload = {
    name: dataSource.name.trim(),
    url: dataSource.url.trim(),
    description: dataSource.description.trim() || null,
  }

  try {
    let savedSource: Source

    if (props.source) {
      const { data } = await axios.put<Source>(
        `/fontes/${props.source.id}`,
        payload,
      )

      savedSource = data
    } else {
      const { data } = await axios.post<Source>('/fontes', {
        ...payload,
        userId: props.userId,
      })

      savedSource = data
    }

    showConfirm.value = false
    emit('saved', savedSource)

    await close()
  } catch (error) {
    errorMessage.value = apiError(error)
    showConfirm.value = false
  } finally {
    saving.value = false
  }
}
</script>
