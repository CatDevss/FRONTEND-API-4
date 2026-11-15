<template>
  <div class="layer-picker">
    <v-select
      :model-value="modelValue"
      :items="options"
      item-title="label"
      item-value="id"
      :label="label"
      :multiple="multiple"
      :chips="multiple"
      :closable-chips="multiple"
      clearable
      :loading="loading"
      :disabled="disabled"
      @update:model-value="$emit('update:modelValue', $event)"
    />
    <div class="search-row">
      <v-text-field
        v-model="search"
        label="Buscar camada ou conjunto"
        density="compact"
        hide-details
        clearable
      />
      <v-btn variant="text" :loading="loading" @click="load(0)">Buscar</v-btn>
    </div>
    <v-alert v-if="error" type="error" density="compact"
      >{{ error }} <v-btn variant="text" @click="load(page)">Tentar novamente</v-btn></v-alert
    >
    <div class="pages">
      <v-btn size="small" variant="text" :disabled="page === 0 || loading" @click="load(page - 1)"
        >Anterior</v-btn
      ><span>{{ total }} camada(s) · página {{ page + 1 }}</span
      ><v-btn
        size="small"
        variant="text"
        :disabled="(page + 1) * 20 >= total || loading"
        @click="load(page + 1)"
        >Próxima</v-btn
      >
    </div>
  </div>
</template>
<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { listLayers, type Layer } from '@/services/environmentalIndicators'
import { apiError } from '@/services/contracts'
const props = defineProps<{
  modelValue: number | number[] | null
  label: string
  multiple?: boolean
  polygon?: boolean
  disabled?: boolean
}>()
const emit = defineEmits<{
  'update:modelValue': [value: number | number[] | null]
  layers: [value: Layer[]]
}>()
const search = ref(''),
  page = ref(0),
  total = ref(0),
  loading = ref(false),
  error = ref(''),
  rows = ref<Layer[]>([])
const cache = new Map<number, Layer>()
const options = computed(() => {
  const ids = Array.isArray(props.modelValue)
    ? props.modelValue
    : props.modelValue
      ? [props.modelValue]
      : []
  const merged = new Map(rows.value.map((l) => [l.id, l]))
  for (const id of ids) {
    const l = cache.get(id)
    if (l) merged.set(id, l)
  }
  return [...merged.values()]
    .filter((l) => !props.polygon || l.polygons > 0)
    .map((l) => ({ ...l, label: `${l.name} · ${l.dataset} · ${l.source} · versão ${l.versionId}` }))
})
let epoch = 0
async function load(next: number) {
  const request = ++epoch
  loading.value = true
  error.value = ''
  try {
    const data = await listLayers(search.value || '', next)
    if (request !== epoch) return
    rows.value = data.items
    total.value = data.total
    page.value = next
    for (const l of data.items) cache.set(l.id, l)
    emit('layers', [...cache.values()])
  } catch (e) {
    if (request === epoch)
      error.value = apiError(
        e,
        'Não foi possível listar camadas. Confira se o serviço ambiental está habilitado.',
      )
  } finally {
    if (request === epoch) loading.value = false
  }
}
onMounted(() => load(0))
</script>
<style scoped>
.search-row,
.pages {
  display: flex;
  align-items: center;
  gap: 8px;
}
.pages {
  justify-content: space-between;
  font-size: 11px;
  margin: 4px 0 16px;
}
.layer-picker {
  min-width: 0;
}
</style>
