<template>
  <v-alert type="info" variant="tonal" :class="compact ? 'session-preview-compact' : 'mb-4'">
    <strong>Prévia de permissões — desenvolvimento</strong>
    <p v-if="!compact">
      O login será integrado separadamente. Selecione um cadastro para testar a interface por cargo.
      Isto não autentica o usuário.
    </p>
    <v-select
      :model-value="sessionUser?.id"
      :items="users"
      item-title="label"
      item-value="id"
      label="Cadastro para prévia"
      :density="compact ? 'compact' : undefined"
      :hide-details="compact"
      :loading="loading"
      :disabled="isUploadInProgress || isCollectionInProgress"
      clearable
      @update:model-value="select"
    />
    <p v-if="error">{{ error }}</p>
  </v-alert>
</template>
<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import axios from 'axios'
import { apiError, type IngestionUser } from '@/services/contracts'
import { sessionUser, setSessionUser, allowedNavigation } from '@/access/session'
import { isUploadInProgress, isCollectionInProgress } from '@/composables/uploadLock'
defineProps<{ compact?: boolean }>()
const users = ref<(IngestionUser & { label: string })[]>([]),
  loading = ref(false),
  error = ref('')
const router = useRouter()
onMounted(async () => {
  loading.value = true
  try {
    users.value = (await axios.get<IngestionUser[]>('/usuarios')).data
      .filter((u) => u.userStatus === 1)
      .map((u) => ({ ...u, label: `${u.name} — ${u.userType}` }))
  } catch (e) {
    error.value = apiError(e)
  } finally {
    loading.value = false
  }
})
function select(id: number | null) {
  if (isUploadInProgress.value || isCollectionInProgress.value) return
  setSessionUser(users.value.find((u) => u.id === id) ?? null)
  void router.replace(allowedNavigation()[0]?.to ?? '/access-required')
}
</script>

<style scoped>
.session-preview-compact {
  flex: 0 0 auto;
  margin: 0;
  border-radius: 0;
  padding: 6px 12px;
}
.session-preview-compact :deep(.v-alert__content) {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px 16px;
}
.session-preview-compact strong {
  font-size: 11px;
}
.session-preview-compact :deep(.v-input) {
  flex: 1;
  min-width: 200px;
  max-width: 440px;
}
</style>
