<template>
  <v-alert type="info" variant="tonal" :class="compact ? 'session-preview-compact' : 'mb-4'">
    <strong>Prévia de cargo · desenvolvimento</strong>
    <p v-if="!compact">
      O login será integrado separadamente. Selecione um cadastro para testar a interface por cargo.
      Isto não autentica o usuário.
    </p>
    <v-select
      :model-value="sessionUser?.id"
      :items="previewUsers"
      item-title="label"
      item-value="id"
      label="Usuário e cargo de teste"
      :density="compact ? 'compact' : undefined"
      :hide-details="compact"
      :loading="previewLoading"
      :disabled="previewLoading || isUploadInProgress || isCollectionInProgress"
      clearable
      @update:model-value="select"
    />
    <v-btn v-if="previewError" variant="text" :loading="previewLoading" @click="retry"
      >Tentar novamente</v-btn
    >
    <p v-if="previewError" role="alert">{{ previewError }}</p>
    <span v-else class="text-caption">Cargo mantido ao navegar e recarregar esta aba.</span>
  </v-alert>
</template>
<script setup lang="ts">
import { onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { sessionUser, allowedNavigation, can } from '@/access/session'
import {
  previewUsers,
  previewLoading,
  previewError,
  loadPreviewUsers,
  selectPreviewUser,
} from '@/access/developmentSession'
import { isUploadInProgress, isCollectionInProgress } from '@/composables/uploadLock'
defineProps<{ compact?: boolean }>()
const router = useRouter()
const route = useRoute()
onMounted(() => loadPreviewUsers())
function openAvailablePage() {
  if (
    route.name === 'login' ||
    route.name === 'access-required' ||
    (route.meta.permission && !can(route.meta.permission))
  )
    void router.replace(allowedNavigation()[0]?.to ?? '/access-required')
}
async function retry() {
  await loadPreviewUsers(true)
  if (sessionUser.value) openAvailablePage()
}
function select(id: number | null) {
  if (previewLoading.value || isUploadInProgress.value || isCollectionInProgress.value) return
  selectPreviewUser(id)
  openAvailablePage()
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
