<template>
  <div class="quality-panel">
    <v-alert
      :type="status === 'Dados presentes nas fontes' ? 'info' : 'warning'"
      variant="tonal"
      density="compact"
    >
      <strong>{{ status }}</strong>
      <p v-for="message in messages" :key="message">{{ message }}</p>
      <p v-if="status === 'Disponibilidade não informada'">
        Resultado de uma versão anterior, sem metadados de disponibilidade. Os valores salvos foram
        preservados.
      </p>
      <p v-if="isZero">
        Zero encontrado nas fontes consultadas. Isso não comprova ausência de ocorrências em fontes
        não carregadas.
      </p>
    </v-alert>
    <details v-if="repairs.length" class="repair-trace">
      <summary>{{ repairs.length }} registro(s) de reparo neste cálculo</summary>
      <ul>
        <li v-for="(repair, index) in repairs" :key="index">
          <strong>{{
            repair.nome || (repair.papel === 'areaAnalise' ? areaName : `Feição ${repair.feicaoId}`)
          }}</strong>
          ·
          {{
            roleNames[repair.papel] ??
            (repair.papel === 'areaAnalise' ? 'Área de análise' : repair.papel)
          }}<br />
          {{ repair.registro.metodo }} · diagnóstico {{ repair.registro.diagnosticoOriginal }} ·
          tolerância {{ repair.registro.tolerancia }} m
        </li>
      </ul>
      <p>
        O arquivo original foi preservado. Registros antigos sem esta informação não comprovam que a
        geometria nunca foi reparada.
      </p>
    </details>
  </div>
</template>
<script setup lang="ts">
import { computed } from 'vue'
import { resultAvailability, resultRepairs } from '@/services/environmentalQuality'
import { metricGroups } from '@/services/environmentalReport'
import { roleNames } from '@/services/environmentalIndicators'
const props = defineProps<{ result: Record<string, unknown>; areaName?: string }>()
const status = computed(() => resultAvailability(props.result))
const repairs = computed(() => resultRepairs(props.result))
const groups = computed(
  () =>
    metricGroups
      .map((key) => props.result[key])
      .filter((g) => g && typeof g === 'object') as Record<string, unknown>[],
)
const messages = computed(() => [
  ...new Set(groups.value.map((g) => g.mensagem).filter((v): v is string => typeof v === 'string')),
])
const isZero = computed(() =>
  groups.value.some(
    (g) => g.situacao === 'DADOS_PRESENTES' && (g.quantidade === 0 || g.areaHa === 0),
  ),
)
</script>
<style scoped>
.quality-panel {
  margin: 20px 0;
}
.quality-panel p {
  font-size: 12px;
  line-height: 1.7;
  margin-top: 6px;
}
.repair-trace {
  margin-top: 16px;
  font-size: 12px;
  line-height: 1.7;
}
.repair-trace summary {
  cursor: pointer;
}
.repair-trace ul {
  padding-left: 20px;
}
.repair-trace li {
  margin: 12px 0;
  overflow-wrap: anywhere;
}
</style>
