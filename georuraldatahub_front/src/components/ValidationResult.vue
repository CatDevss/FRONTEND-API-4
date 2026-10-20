<template>
  <v-alert
    :type="
      report.status === 'VALIDO' ? 'success' : report.status === 'PARCIAL' ? 'warning' : 'error'
    "
    variant="tonal"
    class="my-3"
  >
    {{ validationMessage(report) }}
    <div>Dicionário {{ report.dictionaryId }}, versão {{ report.dictionaryVersion }}.</div>
    <div>
      {{
        report.status === 'REJEITADO'
          ? 'Arquivo bloqueado para tratamento e visualização.'
          : 'Somente os registros aprovados ficam disponíveis para tratamento e visualização.'
      }}
    </div>
  </v-alert>
  <v-data-table :headers="headers" :items="report.records" :items-per-page="10" density="compact">
    <template #[`item.recordIndex`]="{ item }">{{
      item.recordIndex < 0 ? 'Arquivo' : item.recordIndex
    }}</template>
    <template #[`item.valid`]="{ item }">{{ item.valid ? 'Aprovado' : 'Rejeitado' }}</template>
    <template #[`item.errors`]="{ item }"
      ><div v-for="message in item.errors" :key="message">{{ message }}</div></template
    >
    <template #[`item.rawContent`]="{ item }">
      <pre class="raw-content">{{ item.rawContent }}</pre>
    </template>
  </v-data-table>
</template>
<script setup lang="ts">
import { validationMessage, type ValidationReport } from '@/services/contracts'
defineProps<{ report: ValidationReport }>()
const headers = [
  { title: 'Índice do registro', key: 'recordIndex' },
  { title: 'Resultado', key: 'valid' },
  { title: 'Erros', key: 'errors' },
  { title: 'Conteúdo original', key: 'rawContent' },
]
</script>
<style scoped>
.raw-content {
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  max-width: 480px;
  max-height: 180px;
  overflow: auto;
}
</style>
