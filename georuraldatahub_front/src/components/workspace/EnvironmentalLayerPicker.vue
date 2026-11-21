<template>
  <v-autocomplete
    variant="outlined"
    :menu-props="{ contentClass: 'environmental-menu' }"
    :model-value="modelValue"
    :items="options"
    item-title="label"
    item-value="id"
    :label="label"
    :multiple="multiple"
    :chips="multiple"
    :closable-chips="multiple"
    clearable
    no-filter
    :loading="loading"
    :disabled="disabled"
    no-data-text="Nenhuma camada encontrada"
    @update:model-value="$emit('update:modelValue', $event)"
    @update:search="searchChanged"
  >
    <template #item="{ props: itemProps, item }"
      ><v-list-item
        v-bind="itemProps"
        :title="item.name"
        :subtitle="`${item.dataset} · ${item.source} · ${item.features} feições`"
    /></template>
    <template #append-item
      ><div class="pages" @mousedown.prevent>
        <v-btn
          size="small"
          variant="text"
          :disabled="page === 0 || loading"
          @click.stop="load(page - 1)"
          >Anterior</v-btn
        ><span>{{ total }} camadas</span
        ><v-btn
          size="small"
          variant="text"
          :disabled="(page + 1) * 20 >= total || loading"
          @click.stop="load(page + 1)"
          >Próxima</v-btn
        >
      </div></template
    >
  </v-autocomplete>
  <v-alert v-if="error" type="error" density="compact"
    >{{ error }} <v-btn variant="text" @click="load(page)">Tentar novamente</v-btn></v-alert
  >
</template>
<script setup lang="ts">
import { computed, onMounted, onBeforeUnmount, ref, watch } from 'vue'
import { listLayers, type Layer } from '@/services/environmentalIndicators'
import { apiError } from '@/services/contracts'
const props = defineProps<{
  modelValue: number | number[] | null
  label: string
  multiple?: boolean
  polygon?: boolean
  disabled?: boolean
  dataset?: number
  originalsOnly?: boolean
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
    .filter((l) => !props.originalsOnly || !l.composed)
    .map((l) => ({ ...l, label: `${l.name} · ${l.source}` }))
})
let epoch = 0,
  timer: ReturnType<typeof setTimeout> | undefined
function searchChanged(value: string) {
  if (props.disabled || options.value.some((l) => l.label === value)) return
  clearTimeout(timer)
  search.value = value || ''
  timer = setTimeout(() => void load(0), 300)
}
async function load(next: number) {
  const request = ++epoch
  loading.value = true
  error.value = ''
  try {
    const data = await listLayers(search.value, next, {
      conjunto: props.dataset,
      poligonal: props.polygon || undefined,
    })
    if (request !== epoch) return
    rows.value = data.items
    total.value = data.total
    page.value = next
    for (const l of data.items) cache.set(l.id, l)
    emit('layers', [...cache.values()])
  } catch (e) {
    if (request === epoch) {
      rows.value = []
      error.value = apiError(e, 'Não foi possível listar camadas. Confira o serviço ambiental.')
    }
  } finally {
    if (request === epoch) loading.value = false
  }
}
watch(
  () => props.dataset,
  () => {
    cache.clear()
    void load(0)
  },
)
onMounted(() => load(0))
onBeforeUnmount(() => {
  epoch++
  clearTimeout(timer)
})
</script>
<style scoped>
.pages {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px;
  font-size: 11px;
}
</style>
