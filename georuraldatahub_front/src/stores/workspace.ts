import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import axios from 'axios'
import { can } from '@/access/session'
import {
  apiError,
  layerKey,
  type Dataset,
  type DatasetStructure,
  type LayerReference,
} from '@/services/contracts'
import { positiveId, type TreatmentExecution } from '@/services/processing'

export interface LayerRuntime {
  loading: boolean
  error: string
  featureCount: number | null
}
export const layerColors = ['#FE5000', '#85B3C5', '#9DB79A', '#D2B477', '#B9A7CF', '#7DBDB3']
export const useWorkspaceStore = defineStore('workspace', () => {
  const selectedDatasetId = ref<number | null>(null)
  const activeTab = ref<'map' | 'meters'>('map')
  const datasets = ref<Dataset[]>([]),
    structure = ref<DatasetStructure | null>(null)
  const references = ref<LayerReference[]>([])
  const treatedReferences = ref<Record<number, LayerReference[]>>({})
  const loadingDatasets = ref(false),
    loadingWorkspace = ref(false),
    membershipBusy = ref(false)
  const datasetsError = ref(''),
    structureError = ref(''),
    referencesError = ref(''),
    membershipError = ref('')
  const visibility = ref<Record<number, Record<number, boolean>>>({})
  const opacity = ref<Record<number, Record<number, number>>>({})
  const runtime = ref<Record<number, LayerRuntime>>({})
  const revision = ref(0)
  let listEpoch = 0
  let controller: AbortController | null = null
  const selectedDataset = computed(() =>
    datasets.value.find((d) => d.id === selectedDatasetId.value),
  )
  const fileIds = computed(
    () => new Set(structure.value?.sources.flatMap((s) => s.files.map((f) => f.id)) ?? []),
  )
  const availableReferences = computed(() => {
    const treated =
      selectedDatasetId.value === null
        ? []
        : (treatedReferences.value[selectedDatasetId.value] ?? [])
    return [...references.value, ...treated].filter((r) => fileIds.value.has(r.fileId))
  })
  const visibleLayerIds = computed(() =>
    availableReferences.value.filter((r) => isVisible(layerKey(r))).map(layerKey),
  )
  const fileCount = computed(() => fileIds.value.size)
  function isVisible(id: number) {
    return (
      selectedDatasetId.value !== null && visibility.value[selectedDatasetId.value]?.[id] === true
    )
  }
  function setVisibility(id: number, visible: boolean) {
    const dataset = selectedDatasetId.value
    if (dataset === null || !availableReferences.value.some((r) => layerKey(r) === id)) return
    visibility.value[dataset] ??= {}
    visibility.value[dataset][id] = visible
  }
  function getOpacity(id: number) {
    return selectedDatasetId.value === null
      ? 1
      : (opacity.value[selectedDatasetId.value]?.[id] ?? 1)
  }
  function setOpacity(id: number, value: number) {
    if (selectedDatasetId.value === null) return
    const dataset = selectedDatasetId.value
    opacity.value[dataset] ??= {}
    opacity.value[dataset][id] = Math.min(1, Math.max(0.1, value))
  }
  function colorFor(id: number) {
    return layerColors[Math.abs(id) % layerColors.length] ?? '#FE5000'
  }
  function updateRuntime(id: number, state: LayerRuntime, expectedRevision: number) {
    if (expectedRevision === revision.value) runtime.value[id] = state
  }
  async function loadDatasets() {
    const epoch = ++listEpoch
    loadingDatasets.value = true
    datasetsError.value = ''
    try {
      const { data } = await axios.get<Dataset[]>('/conjuntos')
      if (epoch !== listEpoch) return
      datasets.value = data
      if (selectedDatasetId.value !== null && !data.some((d) => d.id === selectedDatasetId.value))
        await selectDataset(null)
    } catch (e) {
      if (epoch === listEpoch)
        datasetsError.value = apiError(e, 'Não foi possível listar os conjuntos.')
    } finally {
      if (epoch === listEpoch) loadingDatasets.value = false
    }
  }
  async function selectDataset(id: number | null) {
    selectedDatasetId.value = id
    await refresh()
  }
  function invalidate() {
    controller?.abort()
    ++revision.value
    structure.value = null
    references.value = []
    runtime.value = {}
    structureError.value = ''
    referencesError.value = ''
    membershipError.value = ''
    loadingWorkspace.value = selectedDatasetId.value !== null
  }
  async function refresh() {
    invalidate()
    const current = revision.value,
      id = selectedDatasetId.value
    if (id === null) return
    const request = new AbortController()
    controller = request
    loadingWorkspace.value = true
    const [tree, layers] = await Promise.allSettled([
      axios.get<DatasetStructure>(`/conjuntos/${id}/estrutura`, { signal: request.signal }),
      axios.get<LayerReference[]>(`/conjuntos/${id}/camadas`, { signal: request.signal }),
    ])
    if (current !== revision.value || selectedDatasetId.value !== id) return
    if (tree.status === 'fulfilled') structure.value = tree.value.data
    else structureError.value = apiError(tree.reason, 'Não foi possível carregar o explorador.')
    if (layers.status === 'fulfilled') references.value = layers.value.data
    else
      referencesError.value = apiError(
        layers.reason,
        'Não foi possível listar as referências de visualização.',
      )
    if (tree.status === 'fulfilled' && layers.status === 'fulfilled') {
      treatedReferences.value[id] = (treatedReferences.value[id] ?? []).filter((r) =>
        fileIds.value.has(r.fileId),
      )
      const available = new Set(availableReferences.value.map(layerKey))
      visibility.value[id] = Object.fromEntries(
        Object.entries(visibility.value[id] ?? {}).filter(([key]) => available.has(Number(key))),
      )
    }
    loadingWorkspace.value = false
  }
  function layersForFile(
    file: DatasetStructure['sources'][number]['files'][number],
  ): LayerReference[] {
    const treated =
      selectedDatasetId.value === null
        ? []
        : (treatedReferences.value[selectedDatasetId.value] ?? [])
    return [
      ...file.layers.map((r) => ({ ...r, size: file.size, receivedDate: file.receivedDate })),
      ...treated.filter((r) => r.fileId === file.id),
    ]
  }
  function registerTreatment(execution: TreatmentExecution) {
    const datasetId = execution.parameters?.request?.datasetId
    if (
      execution.status !== 'CONCLUIDO' ||
      !positiveId(execution.layerId) ||
      !positiveId(datasetId) ||
      datasetId !== selectedDatasetId.value ||
      !fileIds.value.has(execution.fileId)
    )
      return false
    const file = structure.value?.sources
      .flatMap((s) => s.files)
      .find((f) => f.id === execution.fileId)
    if (!file) return false
    const reference: LayerReference = {
      fileId: file.id,
      layerId: execution.layerId,
      outputVersionId: execution.outputVersionId,
      name: `${file.name} · tratamento ${execution.id} · camada ${execution.layerId}`,
      formatFile: 'geojson',
      size: null,
      receivedDate: execution.finishedAt,
    }
    const entries = treatedReferences.value[datasetId] ?? []
    treatedReferences.value[datasetId] = [
      ...entries.filter((r) => r.layerId !== reference.layerId),
      reference,
    ]
    activeTab.value = 'map'
    setVisibility(layerKey(reference), true)
    return true
  }
  async function changeMembership(
    fileId: number,
    associate: boolean,
    datasetId = selectedDatasetId.value,
  ) {
    if (!can('datasets.manage') || datasetId === null || membershipBusy.value) return false
    membershipBusy.value = true
    membershipError.value = ''
    try {
      const path = `/conjuntos/${datasetId}/arquivos/${fileId}`
      if (associate) await axios.put(path)
      else await axios.delete(path)
      if (selectedDatasetId.value === datasetId) await refresh()
      return true
    } catch (e) {
      membershipError.value = apiError(e)
      return false
    } finally {
      membershipBusy.value = false
    }
  }
  function reset() {
    controller?.abort()
    ++revision.value
    ++listEpoch
    selectedDatasetId.value = null
    activeTab.value = 'map'
    datasets.value = []
    structure.value = null
    references.value = []
    treatedReferences.value = {}
    visibility.value = {}
    opacity.value = {}
    runtime.value = {}
    loadingDatasets.value = false
    loadingWorkspace.value = false
    datasetsError.value = ''
    structureError.value = ''
    referencesError.value = ''
    membershipError.value = ''
  }
  return {
    selectedDatasetId,
    visibility,
    opacity,
    activeTab,
    datasets,
    structure,
    references,
    treatedReferences,
    revision,
    selectedDataset,
    availableReferences,
    visibleLayerIds,
    fileCount,
    fileIds,
    runtime,
    loadingDatasets,
    loadingWorkspace,
    membershipBusy,
    datasetsError,
    structureError,
    referencesError,
    membershipError,
    loadDatasets,
    selectDataset,
    refresh,
    invalidate,
    changeMembership,
    reset,
    isVisible,
    setVisibility,
    colorFor,
    getOpacity,
    setOpacity,
    updateRuntime,
    layersForFile,
    registerTreatment,
  }
})
