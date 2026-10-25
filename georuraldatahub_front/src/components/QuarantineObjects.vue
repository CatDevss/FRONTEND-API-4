<template>
  <section class="quarantine-objects mt-5" aria-label="Objetos preservados em quarentena">
    <div class="d-flex align-center justify-space-between ga-3">
      <h3 class="text-subtitle-1">Objetos da quarentena</h3>
      <v-btn size="small" variant="text" :disabled="loading" @click="load">Atualizar</v-btn>
    </div>
    <p class="text-caption text-medium-emphasis my-2">
      Caminhos internos do bucket, sem links públicos de download. A quarentena preserva os dados
      rejeitados e o relatório original.
    </p>
    <v-progress-linear
      v-if="loading"
      indeterminate
      aria-label="Consultando objetos da quarentena"
    />
    <v-alert v-if="error" type="error" variant="tonal" role="alert"
      >{{ error }}<v-btn variant="text" @click="load">Tentar novamente</v-btn></v-alert
    >
    <p v-else-if="!loading && !items.length" class="text-body-2">
      Nenhum registro de quarentena retornado para este arquivo.
    </p>
    <article v-for="item in items" :key="item.id" class="quarantine-object">
      <strong class="text-body-2"
        >Quarentena {{ item.id }} · {{ item.status || 'Status não informado' }}</strong
      >
      <p v-if="item.reason" class="text-body-2 my-2 reason">{{ item.reason }}</p>
      <dl>
        <dt>Objeto rejeitado</dt>
        <dd>{{ item.quarantineLocation || 'Caminho não informado' }}</dd>
        <dt>Relatório armazenado</dt>
        <dd>{{ item.quarantineReportLocation || 'Caminho não informado' }}</dd>
      </dl>
    </article>
    <v-pagination
      v-if="totalPages > 1"
      :model-value="page + 1"
      :length="totalPages"
      :total-visible="5"
      :disabled="loading"
      @update:model-value="page = $event - 1"
    />
  </section>
</template>
<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from 'vue'
import axios from 'axios'
import { apiError } from '@/services/contracts'
import type { ApiPage, QuarantineObject } from '@/services/processing'
const props = defineProps<{ fileId: number }>()
const items = ref<QuarantineObject[]>([]),
  page = ref(0),
  totalPages = ref(0),
  loading = ref(false),
  error = ref('')
let epoch = 0,
  disposed = false
async function load() {
  const current = ++epoch
  loading.value = true
  error.value = ''
  items.value = []
  try {
    const { data } = await axios.get<ApiPage<QuarantineObject>>('/quarentenas', {
      params: { fileId: props.fileId, page: page.value, size: 20 },
    })
    if (disposed || current !== epoch) return
    if (!Array.isArray(data.content)) throw new Error('invalid-page')
    items.value = data.content
    totalPages.value = data.totalPages
  } catch (e) {
    if (!disposed && current === epoch)
      error.value = apiError(e, 'Não foi possível consultar os objetos da quarentena.')
  } finally {
    if (!disposed && current === epoch) loading.value = false
  }
}
watch(page, () => void load())
watch(
  () => props.fileId,
  () => {
    if (page.value !== 0) page.value = 0
    else void load()
  },
  { immediate: true },
)
onBeforeUnmount(() => {
  disposed = true
  ++epoch
})
</script>
<style scoped>
.quarantine-objects {
  border: 1px solid var(--glass-outer-border);
  border-radius: 18px;
  padding: 18px;
}
.quarantine-object {
  padding: 14px 0;
  border-top: 1px solid var(--glass-outer-border);
}
dt {
  font-size: 11px;
  opacity: 0.65;
  margin-top: 10px;
}
dd {
  font-family: monospace;
  font-size: 12px;
  overflow-wrap: anywhere;
  margin-top: 4px;
}
.reason {
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}
</style>
