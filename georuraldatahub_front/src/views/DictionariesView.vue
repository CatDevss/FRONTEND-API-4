<template>
  <div>
    <h1 class="text-h5 mb-4">Dicionários por fonte</h1>
    <v-alert v-if="error" type="error" class="mb-4">{{ error }}</v-alert>
    <v-select
      v-model="sourceId"
      :items="sources"
      item-title="name"
      item-value="id"
      label="Fonte"
      :disabled="busy"
      :loading="loadingSources"
    />
    <v-btn
      v-if="can('dictionaries.manage')"
      class="mb-4"
      :disabled="!sourceId || loading || busy"
      @click="create"
      >Novo dicionário</v-btn
    >
    <v-btn
      class="mb-4 ml-2"
      variant="outlined"
      :disabled="!sourceId || busy"
      :loading="loading"
      @click="load"
      >Atualizar</v-btn
    >
    <p class="mb-4">
      A maior versão da fonte é escolhida automaticamente nas próximas ingestões. Dicionários
      utilizados são imutáveis; crie uma nova versão.
    </p>
    <v-progress-linear v-if="loading" indeterminate />
    <p v-if="sourceId && !loading && !dictionaries.length">Nenhum dicionário cadastrado.</p>
    <v-card v-for="d in dictionaries" :key="d.id" class="mb-3 pa-4">
      <div class="text-h6">
        {{ d.name }} — versão {{ d.version }} <v-chip>{{ d.status }}</v-chip>
      </div>
      <p>{{ d.description }}</p>
      <p class="text-caption">Criado em {{ new Date(d.createdOn).toLocaleString('pt-BR') }}</p>
      <v-btn variant="text" :disabled="busy" @click="open(d, true)">Consultar</v-btn>
      <v-btn
        v-if="can('dictionaries.manage')"
        variant="text"
        :disabled="busy || d.status !== 'RASCUNHO'"
        @click="open(d)"
        >Editar</v-btn
      >
      <v-btn v-if="can('dictionaries.manage')" variant="text" :disabled="busy" @click="version(d)"
        >Criar nova versão</v-btn
      >
      <v-btn
        v-if="can('dictionaries.manage')"
        color="error"
        variant="text"
        :disabled="busy || d.status !== 'RASCUNHO'"
        @click="askDelete(d)"
        >Excluir</v-btn
      >
    </v-card>
    <ConfirmDialog
      v-model="deleteDialog"
      title="Excluir dicionário"
      message="Excluir este rascunho?"
      @confirm="remove"
    />
    <v-dialog v-model="dialog" max-width="1000" :persistent="busy">
      <v-card
        :title="
          readonly ? 'Consultar dicionário' : editingId ? 'Editar rascunho' : 'Novo dicionário'
        "
      >
        <v-card-text>
          <v-alert v-if="editorError" type="error" class="mb-3">{{ editorError }}</v-alert>
          <v-text-field v-model="name" label="Nome" maxlength="100" :disabled="readonly || busy" />
          <v-textarea
            v-model="description"
            label="Descrição"
            maxlength="500"
            rows="2"
            :disabled="readonly || busy"
          />
          <v-card v-for="(rule, i) in rules" :key="i" variant="outlined" class="pa-3 mb-3">
            <v-row>
              <v-col cols="12" md="6"
                ><v-text-field v-model="rule.name" label="Campo" :disabled="readonly || busy"
              /></v-col>
              <v-col cols="12" md="6"
                ><v-select
                  v-model="rule.type"
                  :items="fieldTypes"
                  label="Tipo"
                  :disabled="readonly || busy"
              /></v-col>
            </v-row>
            <v-combobox
              v-model="rule.domain"
              label="Domínio (digite cada valor e pressione Enter)"
              multiple
              chips
              :disabled="readonly || busy"
            />
            <v-checkbox
              v-model="rule.required"
              label="Obrigatório"
              :disabled="readonly || busy"
              hide-details
            />
            <v-checkbox
              v-model="rule.unique"
              label="Único"
              :disabled="readonly || busy"
              hide-details
            />
            <v-btn
              v-if="!readonly"
              variant="text"
              color="error"
              :disabled="busy"
              @click="rules.splice(i, 1)"
              >Remover regra</v-btn
            >
          </v-card>
          <v-btn v-if="!readonly" :disabled="busy" @click="addRule">Adicionar regra</v-btn>
        </v-card-text>
        <v-card-actions
          ><v-spacer /><v-btn :disabled="busy" @click="dialog = false">Fechar</v-btn
          ><v-btn v-if="!readonly" :loading="busy" @click="save">Salvar</v-btn></v-card-actions
        >
      </v-card>
    </v-dialog>
  </div>
</template>
<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import axios from 'axios'
import { can } from '@/access/session'
import ConfirmDialog from '@/components/ConfirmDialog.vue'
import {
  apiError,
  fieldTypes,
  type Dictionary,
  type FieldRule,
  type Source,
} from '@/services/contracts'
const sources = ref<Source[]>([]),
  sourceId = ref<number | null>(null),
  dictionaries = ref<Dictionary[]>([])
const loading = ref(false),
  loadingSources = ref(false),
  busy = ref(false),
  error = ref(''),
  editorError = ref('')
const deleteDialog = ref(false)
const dialog = ref(false),
  readonly = ref(false),
  editingId = ref<number | null>(null),
  deleteTarget = ref<Dictionary | null>(null)
const name = ref(''),
  description = ref(''),
  rules = ref<FieldRule[]>([])
let epoch = 0
async function load() {
  const current = ++epoch
  dictionaries.value = []
  if (!sourceId.value) return
  loading.value = true
  error.value = ''
  try {
    const { data } = await axios.get<Dictionary[]>(`/fontes/${sourceId.value}/dicionarios`)
    if (current === epoch) dictionaries.value = data
  } catch (e) {
    if (current === epoch) error.value = apiError(e)
  } finally {
    if (current === epoch) loading.value = false
  }
}
watch(sourceId, load)
onMounted(async () => {
  loadingSources.value = true
  try {
    sources.value = (await axios.get<Source[]>('/fontes')).data
  } catch (e) {
    error.value = apiError(e)
  } finally {
    loadingSources.value = false
  }
})
function addRule() {
  rules.value.push({ name: '', type: 'STRING', required: false, unique: false, domain: [] })
}
function create() {
  if (!can('dictionaries.manage')) return
  editingId.value = null
  readonly.value = false
  name.value = ''
  description.value = ''
  rules.value = []
  addRule()
  editorError.value = ''
  dialog.value = true
}
function open(d: Dictionary, read = false) {
  editingId.value = d.id
  readonly.value = read || !can('dictionaries.manage')
  name.value = d.name
  description.value = d.description ?? ''
  rules.value = JSON.parse(JSON.stringify(d.rules))
  editorError.value = ''
  dialog.value = true
}
async function save() {
  if (!can('dictionaries.manage')) return
  if (busy.value) return
  editorError.value = ''
  if (
    !name.value.trim() ||
    !rules.value.length ||
    rules.value.some(
      (r) => !r.name.trim() || r.name !== r.name.trim() || !fieldTypes.includes(r.type),
    ) ||
    new Set(rules.value.map((r) => r.name)).size !== rules.value.length
  ) {
    editorError.value =
      'Informe nome e ao menos uma regra com campo único, sem espaços nas extremidades, e tipo válido.'
    return
  }
  busy.value = true
  try {
    const body = { name: name.value.trim(), description: description.value, rules: rules.value }
    if (editingId.value) await axios.put(`/dicionarios/${editingId.value}`, body)
    else await axios.post(`/fontes/${sourceId.value}/dicionarios`, body)
    dialog.value = false
    await load()
  } catch (e) {
    editorError.value = apiError(e)
    await load()
    if (dictionaries.value.find((d) => d.id === editingId.value)?.status === 'UTILIZADO')
      readonly.value = true
  } finally {
    busy.value = false
  }
}
async function version(d: Dictionary) {
  if (!can('dictionaries.manage')) return
  if (busy.value) return
  busy.value = true
  error.value = ''
  try {
    const { data } = await axios.post<Dictionary>(`/dicionarios/${d.id}/versoes`)
    await load()
    open(data)
  } catch (e) {
    error.value = apiError(e)
  } finally {
    busy.value = false
  }
}
function askDelete(d: Dictionary) {
  if (!can('dictionaries.manage')) return
  deleteTarget.value = d
  deleteDialog.value = true
}
async function remove() {
  if (!can('dictionaries.manage')) return
  const d = deleteTarget.value
  deleteTarget.value = null
  if (!d || busy.value) return
  busy.value = true
  error.value = ''
  try {
    await axios.delete(`/dicionarios/${d.id}`)
    await load()
  } catch (e) {
    await load()
    error.value = apiError(e)
  } finally {
    busy.value = false
  }
}
</script>
