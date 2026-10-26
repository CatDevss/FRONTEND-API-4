<template>
  <v-dialog v-model="model" max-width="760" :persistent="workspace.membershipBusy">
    <v-card title="Adicionar arquivos existentes">
      <v-card-text>
        <p class="mb-4">
          Selecione arquivos recebidos por uma fonte. Eles podem participar de vários conjuntos;
          nenhuma cópia ou nova validação é feita.
        </p>
        <v-alert v-if="error || workspace.membershipError" type="error" class="mb-3">{{
          error || workspace.membershipError
        }}</v-alert>
        <v-select
          v-model="sourceId"
          :items="sources"
          item-title="name"
          item-value="id"
          label="Fonte"
          :disabled="workspace.membershipBusy"
          :loading="sourcesLoading"
          clearable
        />
        <v-progress-linear v-if="filesLoading" indeterminate />
        <v-list v-if="!filesLoading"
          ><v-list-item
            v-for="file in files"
            :key="file.id"
            :title="file.name"
            :subtitle="`${file.formatFile} · ${file.size} bytes`"
            ><template #append
              ><v-btn
                :disabled="workspace.membershipBusy || workspace.fileIds.has(file.id)"
                @click="workspace.changeMembership(file.id, true)"
                >{{ workspace.fileIds.has(file.id) ? 'Associado' : 'Adicionar' }}</v-btn
              ></template
            ></v-list-item
          ></v-list
        >
        <p v-if="sourceId && !filesLoading && !files.length && !error">
          Esta fonte ainda não tem arquivos recebidos.
        </p>
      </v-card-text>
      <v-card-actions
        ><v-spacer /><v-btn :disabled="workspace.membershipBusy" @click="model = false"
          >Concluir</v-btn
        ></v-card-actions
      >
    </v-card>
  </v-dialog>
</template>
<script setup lang="ts">
import { ref, watch } from 'vue'
import axios from 'axios'
import { useWorkspaceStore } from '@/stores/workspace'
import { apiError, type Source, type IngestedFile } from '@/services/contracts'
const model = defineModel<boolean>({ default: false })
const workspace = useWorkspaceStore(),
  sources = ref<Source[]>([]),
  files = ref<IngestedFile[]>([])
const sourceId = ref<number | null>(null),
  sourcesLoading = ref(false),
  filesLoading = ref(false),
  error = ref('')
let sourceEpoch = 0,
  fileEpoch = 0
watch(model, async (open) => {
  const epoch = ++sourceEpoch
  if (!open) return
  sourcesLoading.value = true
  error.value = ''
  workspace.membershipError = ''
  try {
    const { data } = await axios.get<Source[]>('/fontes')
    if (epoch === sourceEpoch) sources.value = data
  } catch (e) {
    if (epoch === sourceEpoch) error.value = apiError(e)
  } finally {
    if (epoch === sourceEpoch) sourcesLoading.value = false
  }
})
watch(sourceId, async (id) => {
  const epoch = ++fileEpoch
  files.value = []
  error.value = ''
  if (!id) {
    filesLoading.value = false
    return
  }
  filesLoading.value = true
  try {
    const { data } = await axios.get<IngestedFile[]>(`/fontes/${id}/arquivos`)
    if (epoch === fileEpoch) files.value = data
  } catch (e) {
    if (epoch === fileEpoch) error.value = apiError(e)
  } finally {
    if (epoch === fileEpoch) filesLoading.value = false
  }
})
</script>
