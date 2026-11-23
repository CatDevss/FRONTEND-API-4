<template>
  <aside class="inspection" aria-label="Informações do local" @keydown.esc.stop="$emit('close')">
    <header class="inspection-header">
      <div>
        <h2>Informações do local</h2>
        <p>{{ result.latitude.toFixed(5) }}, {{ result.longitude.toFixed(5) }}</p>
      </div>
      <button type="button" aria-label="Fechar informações do local" @click="$emit('close')">
        ×
      </button>
    </header>
    <div class="inspection-body">
      <p class="inspection-summary" role="status">
        {{ result.groups.length }} camada(s) · {{ total }} feição(ões)
      </p>
      <p class="inspection-help">
        Clique em outro local para consultar. Pontos e linhas próximos ao clique também são
        incluídos.
      </p>
      <p v-if="result.pending.length" role="status" class="inspection-warning">
        Carregando {{ result.pending.join(', ') }}. Os resultados serão atualizados automaticamente.
      </p>
      <p v-if="result.failed.length" role="alert" class="inspection-warning">
        Não foi possível consultar: {{ result.failed.join(', ') }}. Veja o erro no explorador.
      </p>
      <p v-if="!total && !result.pending.length" class="inspection-empty">
        Nenhuma feição das camadas visíveis foi encontrada neste local.
      </p>
      <section
        v-for="group in result.groups"
        :key="group.fileId"
        class="inspection-layer"
        :style="{ '--layer-color': group.color }"
      >
        <h3><span class="layer-swatch" />{{ group.name }}</h3>
        <p class="feature-count">{{ group.features.length }} feição(ões) neste local</p>
        <details
          v-for="(feature, index) in group.features.slice(0, limits[group.fileId] ?? 20)"
          :key="index"
          class="inspection-feature"
          open
        >
          <summary>
            Feição {{ index + 1
            }}<span v-if="feature.id !== undefined"> · ID {{ feature.id }}</span>
          </summary>
          <dl v-if="Object.keys(feature.properties ?? {}).length">
            <div v-for="(value, key) in feature.properties" :key="key">
              <dt>{{ key }}</dt>
              <dd>{{ formatValue(value) }}</dd>
            </div>
          </dl>
          <p v-else class="inspection-empty">Esta feição não possui atributos.</p>
        </details>
        <button
          v-if="group.features.length > (limits[group.fileId] ?? 20)"
          type="button"
          class="show-more"
          @click="limits[group.fileId] = (limits[group.fileId] ?? 20) + 20"
        >
          Mostrar mais feições ({{ Math.min(limits[group.fileId] ?? 20, group.features.length) }} de
          {{ group.features.length }})
        </button>
      </section>
    </div>
  </aside>
</template>
<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { MapInspection } from '@/services/mapInspection'
const props = defineProps<{ result: MapInspection }>()
defineEmits<{ close: [] }>()
const limits = ref<Record<number, number>>({})
const total = computed(() =>
  props.result.groups.reduce((sum, group) => sum + group.features.length, 0),
)
watch(
  () => [props.result.latitude, props.result.longitude],
  () => {
    limits.value = {}
  },
)
function formatValue(value: unknown): string {
  if (value === null || value === undefined) return '—'
  return typeof value === 'object' ? JSON.stringify(value) : String(value)
}
</script>
<style scoped>
.inspection {
  width: min(100%, 390px);
  min-height: 0;
  max-height: 100%;
  display: flex;
  flex-direction: column;
  border: 1px solid rgba(var(--v-theme-on-surface), 0.14);
  border-radius: 18px;
  background: rgba(var(--v-theme-surface), 0.98);
  color: rgb(var(--v-theme-on-surface));
  box-shadow: 0 8px 28px #0005;
  overflow: hidden;
  pointer-events: auto;
}
.inspection-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  padding: 16px;
  border-bottom: 1px solid rgba(var(--v-theme-on-surface), 0.1);
}
h2 {
  font-size: 15px;
}
.inspection-header p {
  font-size: 11px;
  margin-top: 4px;
  font-variant-numeric: tabular-nums;
  color: rgba(var(--v-theme-on-surface), 0.65);
}
button {
  color: inherit;
  cursor: pointer;
  border-radius: 8px;
}
.inspection-header button {
  font-size: 26px;
  line-height: 30px;
  min-width: 32px;
}
button:hover {
  background: rgba(var(--v-theme-on-surface), 0.1);
}
button:focus-visible,
summary:focus-visible {
  outline: 2px solid rgb(var(--v-theme-primary));
  outline-offset: -2px;
}
.inspection-body {
  overflow: auto;
  padding: 14px 16px;
  scrollbar-width: thin;
  overscroll-behavior: contain;
}
.inspection-summary {
  font-size: 12px;
  font-weight: 600;
}
.inspection-help,
.inspection-empty,
.inspection-warning {
  font-size: 12px;
  line-height: 1.6;
  margin: 8px 0 12px;
  color: rgba(var(--v-theme-on-surface), 0.7);
}
.inspection-warning {
  color: #ffe14a;
}
.inspection-layer {
  margin-top: 16px;
  padding-top: 14px;
  border-top: 2px solid var(--layer-color);
}
h3 {
  display: flex;
  gap: 8px;
  align-items: baseline;
  overflow-wrap: anywhere;
  font-size: 13px;
}
.layer-swatch {
  width: 9px;
  height: 9px;
  flex: 0 0 9px;
  border-radius: 50%;
  background: var(--layer-color);
}
.feature-count {
  font-size: 11px;
  margin: 5px 0 10px;
  color: rgba(var(--v-theme-on-surface), 0.65);
}
.inspection-feature {
  margin: 8px 0;
  border: 1px solid rgba(var(--v-theme-on-surface), 0.1);
  border-radius: 10px;
  overflow: hidden;
}
summary {
  padding: 10px;
  font-size: 12px;
  cursor: pointer;
  overflow-wrap: anywhere;
  background: rgba(var(--v-theme-on-surface), 0.04);
}
dl > div {
  padding: 8px 10px;
  border-top: 1px solid rgba(var(--v-theme-on-surface), 0.06);
}
dt {
  font-size: 10px;
  color: rgba(var(--v-theme-on-surface), 0.6);
  overflow-wrap: anywhere;
}
dd {
  font-size: 12px;
  margin-top: 3px;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}
.inspection-feature .inspection-empty {
  padding: 0 10px;
}
.show-more {
  width: 100%;
  padding: 10px;
  font-size: 12px;
  color: var(--layer-color);
}
</style>
