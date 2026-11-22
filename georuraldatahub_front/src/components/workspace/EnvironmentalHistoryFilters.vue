<template>
  <div class="period-filters">
    <div class="layer-filter">
      <EnvironmentalLayerPicker
        :model-value="modelValue.camadaId ?? null"
        label="Camada da área (opcional)"
        :disabled="disabled"
        polygon
        @update:model-value="layerChanged"
        @layers="layers = $event"
      />
    </div>
    <v-text-field
      :model-value="modelValue.inicio ?? ''"
      label="Período dos dados: de"
      type="date"
      variant="outlined"
      hide-details
      :disabled="disabled"
      @update:model-value="change('inicio', $event)"
    />
    <v-text-field
      :model-value="modelValue.fim ?? ''"
      label="Período dos dados: até"
      type="date"
      variant="outlined"
      hide-details
      :disabled="disabled"
      @update:model-value="change('fim', $event)"
    />
  </div>
  <p class="period-note">
    Datas opcionais. Inclui cálculos cujo período analisado cruza o intervalo escolhido. Resultados
    sem período ficam fora da busca por datas. Para um único dia, use a mesma data nos dois campos.
  </p>
</template>
<script setup lang="ts">
import { ref } from 'vue'
import EnvironmentalLayerPicker from './EnvironmentalLayerPicker.vue'
import type { HistoryFilters } from '@/services/environmentalHistoryFilters'
import type { Layer } from '@/services/environmentalIndicators'
const props = defineProps<{ modelValue: HistoryFilters; disabled?: boolean }>()
const emit = defineEmits<{
  'update:modelValue': [filters: HistoryFilters]
  layerLabel: [label: string]
}>()
const layers = ref<Layer[]>([])
function layerChanged(value: number | number[] | null) {
  const id = typeof value === 'number' ? value : undefined
  emit('update:modelValue', { ...props.modelValue, camadaId: id })
  const selected = layers.value.find((layer) => layer.id === id)
  emit('layerLabel', selected ? `${selected.name} · ${selected.source}` : '')
}
function change(key: 'inicio' | 'fim', value: string | null) {
  emit('update:modelValue', { ...props.modelValue, [key]: value || undefined })
}
</script>
<style scoped>
.period-filters {
  display: grid;
  grid-template-columns: minmax(240px, 2fr) repeat(2, minmax(160px, 1fr));
  align-items: start;
  gap: 12px;
}
.layer-filter {
  min-width: 0;
}
.period-note {
  font-size: 12px;
  line-height: 1.7;
  color: rgba(var(--v-theme-on-surface), 0.65);
  margin: 12px 0 20px;
}
@media (max-width: 800px) {
  .period-filters {
    grid-template-columns: 1fr;
  }
}
</style>
