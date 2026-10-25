import { computed, onBeforeUnmount, ref, watch, type Ref } from 'vue'
import axios from 'axios'
import { can, currentUserId } from '@/access/session'
import { apiError, type Dataset, type DatasetStructure } from '@/services/contracts'
import {
  isRaster,
  supportsTreatment,
  type ApiPage,
  type TreatmentExecution,
  type TreatmentFile,
} from '@/services/processing'

export function useFileTreatment(
  file: Ref<TreatmentFile | null>,
  initialDatasetId: Ref<number | null>,
) {
  const history = ref<TreatmentExecution[]>([]),
    result = ref<TreatmentExecution | null>(null)
  const page = ref(0),
    totalPages = ref(0),
    totalElements = ref(0)
  const historyLoading = ref(false),
    historyError = ref(''),
    actionError = ref(''),
    busy = ref(false)
  const datasets = ref<Dataset[]>([]),
    datasetId = ref<number | null>(null)
  const datasetsLoading = ref(false),
    datasetsError = ref(''),
    checkingMembership = ref(false)
  const membershipError = ref(''),
    associated = ref(false)
  const raster = computed(() => isRaster(file.value?.formatFile ?? null))
  let epoch = 0,
    historyEpoch = 0,
    membershipEpoch = 0
  let disposed = false
  const canStart = computed(
    () =>
      !!file.value &&
      supportsTreatment(file.value.formatFile) &&
      can('treatment.run') &&
      currentUserId.value !== null &&
      !busy.value &&
      !historyLoading.value &&
      !historyError.value &&
      !history.value.some((item) => item.status === 'EM_EXECUCAO') &&
      (raster.value ||
        (!!datasetId.value &&
          associated.value &&
          !checkingMembership.value &&
          !membershipError.value)),
  )

  async function loadHistory() {
    const target = file.value
    if (!target) return
    const current = ++historyEpoch,
      requestedPage = page.value
    historyLoading.value = true
    historyError.value = ''
    history.value = []
    try {
      const { data } = await axios.get<ApiPage<TreatmentExecution>>(
        `/arquivos/${target.id}/tratamentos`,
        { params: { page: requestedPage, size: 20 } },
      )
      if (disposed || current !== historyEpoch || target.id !== file.value?.id) return
      if (!Array.isArray(data.content)) throw new Error('invalid-page')
      history.value = data.content
      totalPages.value = data.totalPages
      totalElements.value = data.totalElements
      if (data.totalPages > 0 && requestedPage >= data.totalPages) page.value = data.totalPages - 1
    } catch (error) {
      if (!disposed && current === historyEpoch)
        historyError.value = apiError(error, 'Não foi possível consultar os tratamentos.')
    } finally {
      if (!disposed && current === historyEpoch) historyLoading.value = false
    }
  }
  async function loadDatasets() {
    const current = epoch
    datasetsLoading.value = true
    datasetsError.value = ''
    try {
      const { data } = await axios.get<Dataset[]>('/conjuntos')
      if (disposed || current !== epoch) return
      datasets.value = data
      if (initialDatasetId.value && data.some((item) => item.id === initialDatasetId.value))
        datasetId.value = initialDatasetId.value
    } catch (error) {
      if (!disposed && current === epoch)
        datasetsError.value = apiError(error, 'Não foi possível listar os conjuntos.')
    } finally {
      if (!disposed && current === epoch) datasetsLoading.value = false
    }
  }
  async function checkMembership() {
    const current = ++membershipEpoch,
      id = datasetId.value,
      target = file.value
    associated.value = false
    membershipError.value = ''
    checkingMembership.value = false
    if (!id || !target || raster.value) return
    checkingMembership.value = true
    try {
      const { data } = await axios.get<DatasetStructure>(`/conjuntos/${id}/estrutura`)
      if (disposed || current !== membershipEpoch || target.id !== file.value?.id) return
      associated.value = data.sources.some((source) =>
        source.files.some((item) => item.id === target.id),
      )
    } catch (error) {
      if (!disposed && current === membershipEpoch)
        membershipError.value = apiError(error, 'Não foi possível conferir o vínculo do arquivo.')
    } finally {
      if (!disposed && current === membershipEpoch) checkingMembership.value = false
    }
  }
  async function start() {
    if (!canStart.value || !file.value || currentUserId.value === null) return
    const current = epoch,
      id = file.value.id,
      userId = currentUserId.value
    const request = { userId, ...(!raster.value ? { datasetId: datasetId.value } : {}) }
    busy.value = true
    actionError.value = ''
    result.value = null
    try {
      const { data } = await axios.post<TreatmentExecution>(`/arquivos/${id}/tratamentos`, request)
      if (disposed || current !== epoch || currentUserId.value !== userId) return
      result.value = data
      return data
    } catch (error) {
      if (!disposed && current === epoch)
        actionError.value = apiError(error, 'Não foi possível tratar o arquivo.')
    } finally {
      if (!disposed && current === epoch) {
        if (page.value !== 0) page.value = 0
        else await loadHistory()
        busy.value = false
      }
    }
  }
  watch(datasetId, () => void checkMembership(), { flush: 'sync' })
  watch(page, () => void loadHistory())
  watch(
    [() => file.value?.id, currentUserId],
    () => {
      ++epoch
      ++historyEpoch
      ++membershipEpoch
      history.value = []
      result.value = null
      totalPages.value = 0
      totalElements.value = 0
      historyError.value = ''
      actionError.value = ''
      datasets.value = []
      datasetsError.value = ''
      associated.value = false
      membershipError.value = ''
      checkingMembership.value = false
      busy.value = false
      datasetId.value = null
      if (file.value) {
        if (page.value !== 0) page.value = 0
        else void loadHistory()
        if (!raster.value && can('treatment.run')) void loadDatasets()
      }
    },
    { immediate: true },
  )
  onBeforeUnmount(() => {
    disposed = true
    ++epoch
    ++historyEpoch
    ++membershipEpoch
  })
  return {
    history,
    result,
    page,
    totalPages,
    totalElements,
    historyLoading,
    historyError,
    actionError,
    busy,
    datasets,
    datasetId,
    datasetsLoading,
    datasetsError,
    checkingMembership,
    membershipError,
    associated,
    raster,
    canStart,
    loadHistory,
    loadDatasets,
    checkMembership,
    start,
  }
}
