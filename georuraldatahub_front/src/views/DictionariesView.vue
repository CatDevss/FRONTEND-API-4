<template>
  <div class="dictionary-page">
    <header class="page-heading">
      <div>
        <p class="eyebrow">CONFIGURAÇÃO DOS DADOS</p>
        <h1 class="text-h5 font-weight-bold">Dicionários por fonte</h1>
        <p class="text-body-2 text-medium-emphasis mt-1">
          Escolha a fonte, confira as versões e configure os campos que serão validados.
        </p>
      </div>
      <v-btn to="/sources" variant="text" prepend-icon="mdi-database-outline">Ver fontes</v-btn>
    </header>

    <div class="dictionary-workbench">
      <aside class="dictionary-sidebar" aria-label="Fontes e versões">
        <v-select
          :model-value="sourceId"
          :items="sources"
          item-title="name"
          item-value="id"
          label="Fonte dos dados"
          variant="outlined"
          density="compact"
          hide-details
          :disabled="busy || loadingSources"
          :loading="loadingSources"
          @update:model-value="requestSource"
        />
        <v-alert v-if="sourcesError" type="error" density="compact" class="mt-3">
          {{ sourcesError }}<v-btn variant="text" @click="loadSources">Tentar novamente</v-btn>
        </v-alert>
        <template v-if="sourceId">
          <p class="source-url text-caption text-medium-emphasis mt-3">{{ selectedSource?.url }}</p>
          <div class="version-heading">
            <h2 class="text-subtitle-2">
              Versões <span class="text-medium-emphasis">({{ dictionaries.length }})</span>
            </h2>
            <v-btn
              variant="text"
              size="small"
              :disabled="busy || loading"
              :loading="loading"
              @click="refresh"
              >Atualizar</v-btn
            >
          </div>
          <v-btn
            v-if="can('dictionaries.manage')"
            block
            color="primary"
            variant="tonal"
            prepend-icon="mdi-plus"
            :disabled="busy || loading"
            @click="requestAction(create)"
            >Novo dicionário</v-btn
          >
          <v-progress-linear v-if="loading" indeterminate class="mt-3" />
          <div v-if="!loading" class="version-list">
            <button
              v-for="d in dictionaries"
              :key="d.id"
              type="button"
              class="version-item"
              :class="{ selected: selectedDictionary?.id === d.id }"
              :disabled="busy"
              :aria-pressed="selectedDictionary?.id === d.id"
              @click="requestAction(() => open(d, true))"
            >
              <div class="version-title">
                <strong>v{{ d.version }}</strong
                ><span v-if="d.id === latest?.id" class="latest-badge">Mais recente</span>
              </div>
              <span class="dictionary-name">{{ d.name }}</span>
              <span class="text-caption text-medium-emphasis">{{
                d.status === 'UTILIZADO' ? 'Utilizado · somente leitura' : 'Rascunho · editável'
              }}</span>
            </button>
          </div>
          <p
            v-if="!loading && !error && !dictionaries.length"
            class="text-body-2 text-medium-emphasis mt-4"
          >
            Esta fonte ainda não tem dicionário. Cadastre os campos para habilitar a ingestão.
          </p>
        </template>
        <p v-else-if="!loadingSources" class="text-body-2 text-medium-emphasis mt-4">
          {{
            sources.length
              ? 'Selecione uma fonte para começar.'
              : 'Cadastre uma fonte antes de definir seu dicionário.'
          }}
        </p>
      </aside>

      <section class="dictionary-content" aria-label="Configuração do dicionário">
        <v-alert v-if="error" type="error" density="compact" class="mb-4" role="alert">{{
          error
        }}</v-alert>
        <v-alert v-if="success" type="success" density="compact" class="mb-4" role="status">{{
          success
        }}</v-alert>
        <template v-if="editorOpen">
          <div class="editor-heading">
            <div>
              <p class="eyebrow">{{ selectedSource?.name }}</p>
              <h2 class="text-h6">
                {{ readonly ? name : editingId ? 'Editar rascunho' : 'Novo dicionário' }}
              </h2>
              <p class="text-caption text-medium-emphasis">
                {{
                  selectedDictionary
                    ? `Versão ${selectedDictionary.version} · ${selectedDictionary.status}`
                    : 'A versão será atribuída pelo backend ao salvar.'
                }}
              </p>
            </div>
            <div v-if="selectedDictionary && can('dictionaries.manage')" class="editor-actions">
              <v-btn
                variant="tonal"
                :disabled="busy || selectedDictionary.status !== 'RASCUNHO' || !readonly"
                @click="readonly = false"
                >Editar</v-btn
              >
              <v-btn
                variant="outlined"
                :disabled="busy"
                @click="requestAction(() => version(selectedDictionary!))"
                >Criar nova versão</v-btn
              >
              <v-btn
                color="error"
                variant="text"
                :disabled="busy || selectedDictionary.status !== 'RASCUNHO'"
                @click="askDelete(selectedDictionary)"
                >Excluir</v-btn
              >
            </div>
          </div>
          <v-alert
            v-if="selectedDictionary?.status === 'UTILIZADO'"
            type="info"
            variant="tonal"
            density="compact"
            class="my-4"
            >Este dicionário já foi utilizado e está bloqueado. Crie uma nova versão para alterar os
            campos.</v-alert
          >
          <v-alert v-if="editorError" type="error" class="my-4" role="alert">{{
            editorError
          }}</v-alert>
          <div class="dictionary-metadata">
            <v-text-field
              v-model="name"
              label="Nome do dicionário"
              placeholder="Ex.: Malha municipal do IBGE"
              maxlength="100"
              variant="outlined"
              density="compact"
              :readonly="readonly"
              :disabled="busy"
              hide-details="auto"
            />
            <v-textarea
              v-model="description"
              label="Descrição (opcional)"
              maxlength="500"
              rows="2"
              auto-grow
              variant="outlined"
              density="compact"
              :readonly="readonly"
              :disabled="busy"
              hide-details="auto"
            />
          </div>
          <div class="rules-heading">
            <div>
              <h3 class="text-subtitle-1 font-weight-bold">
                Campos e regras <span class="text-medium-emphasis">({{ rules.length }})</span>
              </h3>
              <p class="text-caption text-medium-emphasis">
                Use o nome exato da coluna do CSV ou do atributo do GeoJSON.
              </p>
            </div>
            <v-btn
              v-if="!readonly"
              variant="tonal"
              size="small"
              prepend-icon="mdi-plus"
              :disabled="busy"
              @click="addRule"
              >Adicionar campo</v-btn
            >
          </div>
          <div class="rules-table">
            <div class="rule-table-header" aria-hidden="true">
              <span>Nome do campo</span><span>Tipo de dado</span><span>Restrições</span
              ><span>Valores permitidos</span><span />
            </div>
            <div v-for="(rule, i) in rules" :key="rule.key" class="rule-row">
              <v-text-field
                v-model="rule.name"
                label="Campo"
                :aria-label="`Nome do campo ${i + 1}`"
                placeholder="Ex.: codigo_municipio"
                variant="outlined"
                density="compact"
                :readonly="readonly"
                :disabled="busy"
                :error-messages="fieldError(rule, i)"
                hide-details="auto"
              />
              <v-select
                v-model="rule.type"
                :items="typeOptions"
                label="Tipo"
                :aria-label="`Tipo do campo ${i + 1}`"
                variant="outlined"
                density="compact"
                :readonly="readonly"
                :disabled="busy"
                hide-details="auto"
              />
              <div class="rule-flags">
                <v-checkbox
                  v-model="rule.required"
                  label="Obrigatório"
                  density="compact"
                  :readonly="readonly"
                  :disabled="busy"
                  hide-details
                /><v-checkbox
                  v-model="rule.unique"
                  label="Único"
                  density="compact"
                  :readonly="readonly"
                  :disabled="busy"
                  hide-details
                />
              </div>
              <v-combobox
                v-model="rule.domain"
                label="Valores permitidos"
                :aria-label="`Valores permitidos do campo ${i + 1}`"
                placeholder="Qualquer valor"
                hint="Digite um valor e pressione Enter"
                persistent-hint
                multiple
                chips
                closable-chips
                variant="outlined"
                density="compact"
                :readonly="readonly"
                :disabled="busy"
              />
              <v-btn
                v-if="!readonly"
                class="rule-remove"
                icon="mdi-close"
                variant="text"
                size="small"
                :aria-label="`Remover campo ${i + 1}`"
                :disabled="busy"
                @click="rules.splice(i, 1)"
              />
            </div>
            <p v-if="!rules.length" class="text-body-2 pa-4">
              Adicione pelo menos um campo para salvar o dicionário.
            </p>
          </div>
          <footer class="editor-footer">
            <p class="text-caption text-medium-emphasis">
              A maior versão da fonte é usada automaticamente nas próximas ingestões, inclusive como
              rascunho.
            </p>
            <div v-if="!readonly" class="editor-actions">
              <span v-if="dirty" class="text-caption text-warning">Alterações não salvas</span
              ><v-btn :disabled="busy" variant="text" @click="requestAction(closeEditor)"
                >Cancelar</v-btn
              ><v-btn color="primary" :loading="busy" :disabled="busy" @click="save"
                >Salvar dicionário</v-btn
              >
            </div>
          </footer>
        </template>
        <div v-else class="dictionary-empty">
          <v-icon icon="mdi-book-open-page-variant-outline" size="48" color="primary" />
          <h2 class="text-h6 mt-4">Regras claras para receber seus dados</h2>
          <p class="text-body-2 text-medium-emphasis mt-2">
            {{
              sourceId
                ? 'Escolha uma versão na lateral ou crie o primeiro dicionário desta fonte.'
                : 'Comece escolhendo a fonte na lateral. Cada fonte tem seus próprios campos e versões.'
            }}
          </p>
          <v-btn
            v-if="sourceId && !loading && can('dictionaries.manage')"
            color="primary"
            class="mt-5"
            @click="create"
            >Criar dicionário</v-btn
          >
          <v-btn
            v-else-if="!sources.length && !loadingSources && can('sources.create')"
            to="/sources"
            variant="tonal"
            class="mt-5"
            >Cadastrar fonte</v-btn
          >
        </div>
      </section>
    </div>
    <ConfirmDialog
      v-model="deleteDialog"
      title="Excluir dicionário"
      :message="`Excluir o rascunho ${deleteTarget?.name || ''}? Esta operação exclui a versão selecionada.`"
      @confirm="remove"
    />
    <ConfirmDialog
      v-model="discardDialog"
      title="Descartar alterações?"
      message="Há alterações não salvas neste dicionário. Deseja descartá-las para continuar?"
      @confirm="discard"
    />
  </div>
</template>
<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, onBeforeRouteLeave } from 'vue-router'
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

interface EditorRule extends FieldRule {
  key: number
}
const route = useRoute()
const sources = ref<Source[]>([]),
  sourceId = ref<number | null>(null),
  dictionaries = ref<Dictionary[]>([])
const loading = ref(false),
  loadingSources = ref(false),
  busy = ref(false)
const error = ref(''),
  sourcesError = ref(''),
  editorError = ref(''),
  success = ref('')
const readonly = ref(true),
  editingId = ref<number | null>(null),
  editorOpen = ref(false)
const selectedDictionary = computed(() => dictionaries.value.find((d) => d.id === editingId.value))
const selectedSource = computed(() => sources.value.find((s) => s.id === sourceId.value))
const latest = computed(() => dictionaries.value[0])
const name = ref(''),
  description = ref(''),
  rules = ref<EditorRule[]>([]),
  baseline = ref('')
const deleteDialog = ref(false),
  deleteTarget = ref<Dictionary | null>(null),
  discardDialog = ref(false)
let nextRuleKey = 0,
  epoch = 0
let pendingAction: (() => void) | null = null
let leaveDecision: ((value: boolean) => void) | null = null
const typeLabels = [
  'Texto',
  'Número decimal',
  'Número inteiro',
  'Verdadeiro / falso',
  'Data',
  'Latitude',
  'Longitude',
  'Geometria',
]
const typeOptions = fieldTypes.map((value, i) => ({ title: `${typeLabels[i]} (${value})`, value }))
function body() {
  return {
    name: name.value.trim(),
    description: description.value,
    rules: rules.value.map(({ name, type, required, unique, domain }) => ({
      name,
      type,
      required,
      unique,
      domain,
    })),
  }
}
const dirty = computed(
  () => editorOpen.value && !readonly.value && JSON.stringify(body()) !== baseline.value,
)
function requestAction(action: () => void) {
  if (busy.value) return
  if (!dirty.value) {
    action()
    return
  }
  pendingAction = action
  discardDialog.value = true
}
function discard() {
  baseline.value = JSON.stringify(body())
  pendingAction?.()
  pendingAction = null
  leaveDecision?.(true)
  leaveDecision = null
}
watch(discardDialog, (open) => {
  if (!open) {
    // The confirm event is emitted synchronously before this watcher runs.
    pendingAction = null
    leaveDecision?.(false)
    leaveDecision = null
  }
})
if (route)
  onBeforeRouteLeave(() => {
    if (busy.value) return false
    if (!dirty.value) return true
    discardDialog.value = true
    return new Promise<boolean>((resolve) => {
      leaveDecision = resolve
    })
  })
function requestSource(id: number | null) {
  requestAction(() => {
    sourceId.value = id
  })
}
watch(sourceId, () => {
  closeEditor()
  dictionaries.value = []
  void load()
})
watch(
  () => route?.query?.source,
  (value) => {
    const id = Number(value)
    if (sources.value.some((s) => s.id === id) && id !== sourceId.value) requestSource(id)
  },
)
async function loadSources() {
  loadingSources.value = true
  sourcesError.value = ''
  try {
    sources.value = [...(await axios.get<Source[]>('/fontes')).data].sort(
      (a, b) => a.name.localeCompare(b.name, 'pt-BR') || a.id - b.id,
    )
    const requested = Number(route?.query?.source)
    if (!sourceId.value && sources.value.some((s) => s.id === requested)) sourceId.value = requested
  } catch (e) {
    sourcesError.value = apiError(e)
  } finally {
    loadingSources.value = false
  }
}
onMounted(loadSources)
async function load(preferredId = editingId.value, preserveEditor = false) {
  const current = ++epoch,
    source = sourceId.value
  error.value = ''
  if (!source) {
    dictionaries.value = []
    loading.value = false
    return
  }
  loading.value = true
  try {
    const { data } = await axios.get<Dictionary[]>(`/fontes/${source}/dicionarios`)
    if (current !== epoch) return
    dictionaries.value = [...data].sort((a, b) => b.version - a.version || b.id - a.id)
    if (!preserveEditor) {
      const target = dictionaries.value.find((d) => d.id === preferredId) ?? latest.value
      if (target) open(target, true)
      else closeEditor()
    } else if (selectedDictionary.value?.status === 'UTILIZADO') readonly.value = true
  } catch (e) {
    if (current === epoch) error.value = apiError(e)
  } finally {
    if (current === epoch) loading.value = false
  }
}
function refresh() {
  requestAction(() => {
    void load()
  })
}
function addRule() {
  rules.value.push({
    key: ++nextRuleKey,
    name: '',
    type: 'STRING',
    required: false,
    unique: false,
    domain: [],
  })
}
function create() {
  if (!can('dictionaries.manage') || !sourceId.value || busy.value) return
  editingId.value = null
  readonly.value = false
  editorOpen.value = true
  name.value = ''
  description.value = ''
  rules.value = []
  addRule()
  editorError.value = ''
  success.value = ''
  baseline.value = JSON.stringify(body())
}
function open(d: Dictionary, read = false) {
  editingId.value = d.id
  readonly.value = read || d.status !== 'RASCUNHO' || !can('dictionaries.manage')
  name.value = d.name
  description.value = d.description ?? ''
  rules.value = d.rules.map((r) => ({ ...r, domain: [...r.domain], key: ++nextRuleKey }))
  editorError.value = ''
  editorOpen.value = true
  baseline.value = JSON.stringify(body())
}
function closeEditor() {
  editorOpen.value = false
  editingId.value = null
  editorError.value = ''
  success.value = ''
}
function fieldError(rule: FieldRule, index: number) {
  if (!rule.name && !editorError.value) return ''
  if (!rule.name.trim()) return 'Informe o nome do campo.'
  if (rule.name !== rule.name.trim()) return 'Remova os espaços nas extremidades.'
  if (rules.value.some((r, i) => i !== index && r.name === rule.name))
    return 'Este nome já foi usado.'
  return ''
}
async function save() {
  if (!can('dictionaries.manage') || readonly.value || !sourceId.value || busy.value) return
  editorError.value = ''
  success.value = ''
  if (
    !name.value.trim() ||
    !rules.value.length ||
    rules.value.some((r, i) => fieldError(r, i) || !r.name.trim() || !fieldTypes.includes(r.type))
  ) {
    editorError.value = 'Informe um nome e ao menos um campo com nome único e tipo válido.'
    return
  }
  busy.value = true
  const source = sourceId.value
  try {
    const payload = body()
    const { data } = editingId.value
      ? await axios.put<Dictionary>(`/dicionarios/${editingId.value}`, payload)
      : await axios.post<Dictionary>(`/fontes/${source}/dicionarios`, payload)
    dictionaries.value = [...dictionaries.value.filter((d) => d.id !== data.id), data].sort(
      (a, b) => b.version - a.version,
    )
    open(data, true)
    success.value = `Dicionário salvo. Versão ${data.version} disponível para a fonte ${selectedSource.value?.name}.`
  } catch (e) {
    editorError.value = apiError(e)
    await load(editingId.value, true)
  } finally {
    busy.value = false
  }
}
async function version(d: Dictionary) {
  if (!can('dictionaries.manage') || busy.value) return
  busy.value = true
  error.value = ''
  success.value = ''
  try {
    const { data } = await axios.post<Dictionary>(`/dicionarios/${d.id}/versoes`)
    dictionaries.value = [...dictionaries.value, data].sort((a, b) => b.version - a.version)
    open(data)
    success.value = `Versão ${data.version} criada com os campos da versão ${d.version}. Ela já pode ser selecionada automaticamente nas próximas ingestões.`
  } catch (e) {
    error.value = apiError(e)
  } finally {
    busy.value = false
  }
}
function askDelete(d: Dictionary) {
  if (!can('dictionaries.manage') || d.status !== 'RASCUNHO' || busy.value) return
  deleteTarget.value = d
  deleteDialog.value = true
}
async function remove() {
  const d = deleteTarget.value
  if (!can('dictionaries.manage') || !d || d.status !== 'RASCUNHO' || busy.value) return
  busy.value = true
  error.value = ''
  try {
    await axios.delete(`/dicionarios/${d.id}`)
    closeEditor()
    await load(null)
    success.value = 'Rascunho excluído.'
  } catch (e) {
    await load(editingId.value, true)
    error.value = apiError(e)
  } finally {
    busy.value = false
    deleteTarget.value = null
  }
}
</script>
<style scoped>
.dictionary-page {
  max-width: 1600px;
  margin: auto;
}
.page-heading,
.editor-heading,
.rules-heading,
.version-heading,
.editor-footer,
.editor-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}
.page-heading {
  margin-bottom: 24px;
}
.eyebrow {
  font-size: 10px;
  letter-spacing: 0.12em;
  font-weight: 700;
  color: rgb(var(--v-theme-primary));
  margin-bottom: 6px;
}
.dictionary-workbench {
  display: grid;
  grid-template-columns: 260px minmax(0, 1fr);
  min-height: 580px;
  border: 1px solid var(--glass-outer-border);
  border-radius: 16px;
  background: rgba(var(--v-theme-surface), 0.45);
  overflow: hidden;
}
.dictionary-sidebar {
  padding: 20px 16px;
  border-right: 1px solid var(--glass-outer-border);
  background: rgba(var(--v-theme-background), 0.3);
}
.source-url {
  overflow-wrap: anywhere;
}
.version-heading {
  margin: 24px 0 12px;
}
.version-list {
  display: grid;
  gap: 8px;
  margin-top: 16px;
}
.version-item {
  display: grid;
  gap: 5px;
  padding: 12px;
  text-align: left;
  border: 1px solid transparent;
  border-radius: 8px;
  color: inherit;
  background: transparent;
  cursor: pointer;
  width: 100%;
}
.version-item:hover {
  background: rgba(var(--v-theme-on-surface), 0.04);
}
.version-item.selected {
  background: rgba(var(--v-theme-primary), 0.08);
  border-color: rgba(var(--v-theme-primary), 0.35);
}
.version-item:focus-visible {
  outline: 2px solid rgb(var(--v-theme-primary));
  outline-offset: 2px;
}
.version-title {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
}
.latest-badge {
  color: rgb(var(--v-theme-primary));
  font-size: 10px;
}
.dictionary-name {
  overflow-wrap: anywhere;
  font-size: 13px;
}
.dictionary-content {
  min-width: 0;
  padding: 24px;
}
.dictionary-empty {
  min-height: 440px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  max-width: 420px;
  margin: auto;
}
.dictionary-metadata {
  display: grid;
  gap: 16px;
  margin: 24px 0;
}
.rules-heading {
  margin-bottom: 16px;
}
.rules-table {
  border: 1px solid var(--glass-outer-border);
  border-radius: 10px;
  overflow: auto;
}
.rule-table-header,
.rule-row {
  display: grid;
  grid-template-columns: minmax(150px, 1fr) minmax(160px, 1fr) 136px minmax(150px, 1fr) 32px;
  gap: 10px;
  padding: 12px;
}
.rule-table-header {
  font-size: 11px;
  color: rgba(var(--v-theme-on-surface), 0.6);
  background: rgba(var(--v-theme-on-surface), 0.03);
}
.rule-row {
  border-top: 1px solid var(--glass-outer-border);
  align-items: start;
}
.rule-flags :deep(.v-selection-control) {
  min-height: 26px;
}
.rule-flags :deep(.v-label) {
  font-size: 11px;
}
.editor-footer {
  margin-top: 24px;
  padding-top: 16px;
  border-top: 1px solid var(--glass-outer-border);
}
.editor-footer > p {
  flex: 1;
  min-width: 180px;
}
@media (max-width: 1250px) {
  .rule-table-header {
    display: none;
  }
  .rule-row {
    grid-template-columns: minmax(120px, 1fr) minmax(140px, 1fr) 32px;
  }
  .rule-flags {
    grid-row: 2;
  }
  .rule-row > :nth-child(4) {
    grid-row: 2;
    grid-column: 2;
  }
  .rule-remove {
    grid-column: 3;
    grid-row: 1;
  }
}
@media (max-width: 850px) {
  .dictionary-workbench {
    grid-template-columns: 1fr;
  }
  .dictionary-sidebar {
    border-right: 0;
    border-bottom: 1px solid var(--glass-outer-border);
  }
  .version-list {
    display: flex;
    overflow: auto;
  }
  .version-item {
    min-width: 180px;
    max-width: 240px;
  }
  .dictionary-content {
    padding: 16px;
  }
}
</style>
