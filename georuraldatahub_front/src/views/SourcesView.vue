<template>
  <div>
    <h1 class="text-h5 mb-4">Fontes de dados</h1>
    <v-btn v-if="can('sources.create')" color="primary" class="mb-4" @click="dialog = true"
      >Cadastrar fonte</v-btn
    >
    <v-btn variant="text" :loading="loading" @click="load">Atualizar</v-btn>
    <v-alert v-if="error" type="error">{{ error }}</v-alert>
    <v-card v-for="source in sources" :key="source.id" class="pa-4 mb-3"
      ><h2 class="text-h6">{{ source.name }}</h2>
      <p style="overflow-wrap: anywhere">{{ source.url }}</p></v-card
    >
    <p v-if="!loading && !error && !sources.length">Nenhuma fonte cadastrada.</p>
    <DataSourceDialog
      v-if="currentUserId && can('sources.create')"
      v-model="dialog"
      :user-id="currentUserId"
      @saved="load"
    />
  </div>
</template>
<script setup lang="ts">
import { onMounted, ref } from 'vue'
import axios from 'axios'
import DataSourceDialog from '@/components/DataSourceDialog.vue'
import { can, currentUserId } from '@/access/session'
import { apiError, type Source } from '@/services/contracts'
const sources = ref<Source[]>([]),
  dialog = ref(false),
  loading = ref(false),
  error = ref('')
const sourceOrder = new Intl.Collator('pt-BR', { sensitivity: 'base', numeric: true })
async function load() {
  loading.value = true
  error.value = ''
  try {
    const { data } = await axios.get<Source[]>('/fontes')
    sources.value = [...data].sort((a, b) => sourceOrder.compare(a.name, b.name) || a.id - b.id)
  } catch (e) {
    error.value = apiError(e)
  } finally {
    loading.value = false
  }
}
onMounted(load)
</script>
