<template>
  <section
    v-if="can('dictionaries.generate')"
    class="dictionary-generator my-4"
    aria-label="Gerar dicionário do conteúdo"
  >
    <h3 class="text-subtitle-2">Criar dicionário a partir do arquivo</h3>
    <p class="text-body-2 my-2">
      {{
        mode === 'collection'
          ? 'Baixa o conteúdo da edição e dos filtros informados para detectar os campos e validar as regras.'
          : 'Lê o arquivo selecionado para detectar os campos e validar as regras. Selecione um único arquivo para gerar o dicionário.'
      }}
      Salva uma nova versão e a seleciona para esta ingestão.
    </p>
    <v-btn
      variant="tonal"
      prepend-icon="mdi-book-plus-outline"
      :loading="busy"
      :disabled="!enabled || !!result"
      @click="generate"
    >
      Gerar e salvar dicionário
    </v-btn>
    <p v-if="busy" class="text-caption mt-2" role="status">
      Lendo o conteúdo, validando e salvando o dicionário…
    </p>
    <v-alert v-if="error" type="error" variant="tonal" class="mt-3" role="alert">{{
      error
    }}</v-alert>
    <div v-if="result" class="mt-3" aria-live="polite">
      <p>
        <strong>Dicionário salvo e selecionado:</strong> {{ result.dictionary.name }} · v{{
          result.dictionary.version
        }}
        · {{ result.dictionary.rules.length }} campos.
      </p>
      <p class="text-body-2 mt-2">Arquivo analisado: {{ result.filename }}.</p>
      <v-alert
        :type="result.validation.status === 'VALIDO' ? 'success' : 'warning'"
        variant="tonal"
        class="my-3"
      >
        {{ result.validation.validRecords }} registro(s) válido(s),
        {{ result.validation.rejectedRecords }} rejeitado(s).
        <span v-if="result.validation.status !== 'VALIDO'"
          >O dicionário foi salvo, mas o conteúdo contém reprovações. Revise o arquivo antes de
          ingerir; as regras de quarentena continuam valendo.</span
        >
      </v-alert>
      <details>
        <summary>Conferir campos detectados</summary>
        <ul class="ml-5 my-2 generated-fields">
          <li v-for="rule in result.dictionary.rules" :key="rule.name">
            {{ rule.name }} · {{ rule.type }} · {{ rule.required ? 'Obrigatório' : 'Opcional' }}
          </li>
        </ul>
      </details>
      <p v-for="warning in result.warnings" :key="warning" class="text-caption mt-2">
        {{ warning }}
      </p>
      <p
        v-for="issue in result.validation.issues"
        :key="issue.recordIndex"
        class="text-caption mt-1"
      >
        Registro {{ issue.recordIndex + 1 }}: {{ issue.errors.join('; ') }}
      </p>
      <v-btn
        class="mt-2"
        variant="text"
        size="small"
        :to="{ path: '/dictionaries', query: { source: result.dictionary.sourceId } }"
        >Revisar dicionário salvo</v-btn
      >
    </div>
  </section>
</template>
<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import axios from 'axios'
import { can, currentUserId } from '@/access/session'
import { isCollectionInProgress, isUploadInProgress } from '@/composables/uploadLock'
import { apiError } from '@/services/contracts'
import type { GeneratedDictionary } from '@/services/dictionaryGeneration'

const props = defineProps<{
  mode: 'collection' | 'upload'
  sourceId: number | null
  userId: number | null
  file?: File | null
  collection?: Record<string, unknown> | null
  disabled?: boolean
}>()
const emit = defineEmits<{ generated: [result: GeneratedDictionary]; busy: [value: boolean] }>()
const busy = ref(false),
  error = ref(''),
  result = ref<GeneratedDictionary | null>(null)
let epoch = 0
const enabled = computed(
  () =>
    can('dictionaries.generate') &&
    !!props.sourceId &&
    !!props.userId &&
    currentUserId.value === props.userId &&
    !props.disabled &&
    !busy.value &&
    !isCollectionInProgress.value &&
    !isUploadInProgress.value &&
    (props.mode === 'collection' ? !!props.collection : !!props.file),
)
watch(
  () => [
    props.sourceId,
    props.userId,
    props.mode,
    props.file,
    props.collection,
    currentUserId.value,
  ],
  () => {
    ++epoch
    result.value = null
    error.value = ''
  },
)
onBeforeUnmount(() => {
  ++epoch
})
async function generate() {
  if (!enabled.value || result.value) return
  const current = ++epoch,
    source = props.sourceId,
    actor = props.userId
  busy.value = true
  error.value = ''
  isCollectionInProgress.value = true
  emit('busy', true)
  try {
    let response
    if (props.mode === 'collection') {
      response = await axios.post<GeneratedDictionary>(
        `/fontes/${source}/dicionarios/gerar-coleta`,
        {
          ...props.collection,
          userId: actor,
        },
      )
    } else {
      const body = new FormData()
      body.append('file', props.file!)
      response = await axios.post<GeneratedDictionary>(
        `/fontes/${source}/dicionarios/gerar-arquivo`,
        body,
        { params: { userId: actor } },
      )
    }
    if (current === epoch && actor === currentUserId.value && can('dictionaries.generate')) {
      result.value = response.data
      emit('generated', response.data)
    }
  } catch (e) {
    if (current === epoch)
      error.value = apiError(e, 'Não foi possível gerar e salvar o dicionário.')
  } finally {
    busy.value = false
    isCollectionInProgress.value = false
    emit('busy', false)
  }
}
</script>
<style scoped>
.dictionary-generator {
  border: 1px solid var(--glass-outer-border);
  border-radius: 12px;
  padding: 16px;
}
.generated-fields {
  max-height: 240px;
  overflow: auto;
}
summary {
  cursor: pointer;
}
</style>
