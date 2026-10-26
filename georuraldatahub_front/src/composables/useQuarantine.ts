import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import axios from 'axios'
import { can, currentUserId } from '@/access/session'
import { apiError, type ValidationReport } from '@/services/contracts'
import {
  quarantineClosed,
  quarantineStatuses,
  treatmentError,
  type QuarantineRecord,
  type QuarantinePage,
} from '@/services/quarantine'

export function useQuarantine() {
  const route = useRoute(),
    router = useRouter()
  const scope = ref<'all' | 'available' | 'mine'>('all')
  const status = ref<string | null>(null),
    page = ref(0),
    size = ref(20)
  const rows = ref<QuarantineRecord[]>([]),
    totalElements = ref(0),
    totalPages = ref(0)
  const loading = ref(false),
    listError = ref('')
  const selectedId = ref<number | null>(null),
    detail = ref<QuarantineRecord | null>(null)
  const detailLoading = ref(false),
    detailError = ref(''),
    treatment = ref('')
  const busy = ref(false),
    actionError = ref(''),
    actionMessage = ref('')
  const confirmResolve = ref(false)
  let resolution: { id: number; userId: number; treatment: string } | null = null
  const correctionOpen = ref(false)
  const reportOpen = ref(false),
    reportLoading = ref(false),
    reportError = ref('')
  const report = ref<ValidationReport | null>(null)
  let listEpoch = 0,
    detailEpoch = 0,
    reportEpoch = 0,
    alive = true
  const fileId = computed(() => {
    const value = Number(route.query.fileId)
    return Number.isSafeInteger(value) && value > 0 ? value : null
  })
  const ready = computed(() => can('quarantine.read') && currentUserId.value !== null)
  const writable = computed(
    () =>
      !!detail.value &&
      ready.value &&
      can('quarantine.manage') &&
      !detailLoading.value &&
      !detailError.value &&
      !quarantineClosed(detail.value) &&
      quarantineStatuses.some((entry) => entry.value === detail.value!.status),
  )
  const canClaim = computed(() => writable.value && detail.value?.responsibleId === null)
  const canEdit = computed(
    () => writable.value && detail.value?.responsibleId === currentUserId.value,
  )
  const canCorrect = computed(() => canEdit.value && !!detail.value?.validationReportUrl)
  const observationError = computed(() => treatmentError(treatment.value))
  const dirty = computed(() => treatment.value !== (detail.value?.treatment ?? ''))

  async function loadList() {
    const epoch = ++listEpoch
    rows.value = []
    listError.value = ''
    loading.value = true
    if (!ready.value) {
      loading.value = false
      totalElements.value = 0
      totalPages.value = 0
      return
    }
    try {
      const { data } = await axios.get<QuarantinePage>('/quarentenas', {
        params: {
          page: page.value,
          size: size.value,
          ...(status.value ? { status: status.value } : {}),
          ...(scope.value === 'available' ? { unassigned: true } : {}),
          ...(scope.value === 'mine' ? { responsibleId: currentUserId.value } : {}),
          ...(fileId.value !== null ? { fileId: fileId.value } : {}),
        },
      })
      if (!alive || epoch !== listEpoch) return
      const lastPage = Math.max(0, data.totalPages - 1)
      if (page.value > lastPage) {
        page.value = lastPage
        await loadList()
        return
      }
      rows.value = data.content
      page.value = data.page
      totalElements.value = data.totalElements
      totalPages.value = data.totalPages
      if (selectedId.value === null && data.content.length) void select(data.content[0]!.id)
    } catch (error) {
      if (alive && epoch === listEpoch) {
        listError.value = apiError(error, 'Não foi possível carregar a quarentena.')
        totalElements.value = 0
        totalPages.value = 0
      }
    } finally {
      if (alive && epoch === listEpoch) loading.value = false
    }
  }
  function clearReport() {
    ++reportEpoch
    reportOpen.value = false
    reportLoading.value = false
    report.value = null
    reportError.value = ''
  }
  async function loadDetail(id: number, preserveDraft = false) {
    const epoch = ++detailEpoch
    detailLoading.value = true
    detailError.value = ''
    try {
      const { data } = await axios.get<QuarantineRecord>(`/quarentenas/${id}`)
      if (!alive || epoch !== detailEpoch || selectedId.value !== id) return
      const keepDraft =
        preserveDraft &&
        dirty.value &&
        !quarantineClosed(data) &&
        data.responsibleId === currentUserId.value
      if (data.validationReportUrl !== detail.value?.validationReportUrl) clearReport()
      detail.value = data
      if (!keepDraft) treatment.value = data.treatment ?? ''
    } catch (error) {
      if (alive && epoch === detailEpoch) {
        detailError.value = apiError(error, 'Não foi possível consultar a análise.')
        if (axios.isAxiosError(error) && error.response?.status === 404) detail.value = null
      }
    } finally {
      if (alive && epoch === detailEpoch) detailLoading.value = false
    }
  }
  function resetSelection(id: number | null = null) {
    ++detailEpoch
    selectedId.value = id
    detail.value = null
    detailLoading.value = false
    detailError.value = ''
    treatment.value = ''
    actionError.value = ''
    actionMessage.value = ''
    confirmResolve.value = false
    resolution = null
    correctionOpen.value = false
    clearReport()
  }
  async function select(id: number) {
    if (busy.value || !ready.value) return
    resetSelection(id)
    await loadDetail(id)
  }
  async function refresh() {
    if (busy.value) return
    await Promise.allSettled([
      loadList(),
      ...(selectedId.value !== null ? [loadDetail(selectedId.value, true)] : []),
    ])
  }
  function changePage(value: number) {
    if (busy.value || value < 0 || value === page.value) return
    page.value = value
    void loadList()
  }
  function requestResolve() {
    if (
      busy.value ||
      !canEdit.value ||
      observationError.value ||
      !detail.value ||
      currentUserId.value === null
    )
      return
    resolution = {
      id: detail.value.id,
      userId: currentUserId.value,
      treatment: treatment.value.trim(),
    }
    confirmResolve.value = true
  }
  async function act(action: 'assumir' | 'observacao' | 'resolver') {
    if (busy.value || !ready.value || !detail.value || currentUserId.value === null) return
    if (action === 'assumir' ? !canClaim.value : !canEdit.value || !!observationError.value) return
    if (
      action === 'resolver' &&
      (!resolution ||
        resolution.id !== detail.value.id ||
        resolution.userId !== currentUserId.value)
    )
      return
    const id = detail.value.id,
      userId = currentUserId.value
    const body =
      action === 'assumir'
        ? { userId }
        : {
            userId,
            treatment: action === 'resolver' ? resolution!.treatment : treatment.value.trim(),
          }
    busy.value = true
    actionError.value = ''
    actionMessage.value = ''
    confirmResolve.value = false
    resolution = null
    try {
      const { data } =
        action === 'observacao'
          ? await axios.patch<QuarantineRecord>(`/quarentenas/${id}/observacao`, body)
          : await axios.post<QuarantineRecord>(`/quarentenas/${id}/${action}`, body)
      if (!alive || selectedId.value !== id || currentUserId.value !== userId) return
      ++detailEpoch
      detail.value = data
      treatment.value = data.treatment ?? ''
      actionMessage.value =
        action === 'assumir'
          ? 'Correção assumida.'
          : action === 'observacao'
            ? 'Observação salva.'
            : 'Análise encerrada. Os dados rejeitados continuam sem aprovação.'
      await Promise.allSettled([loadList(), loadDetail(id)])
      if (action === 'assumir' && alive && selectedId.value === id) await openCorrection()
    } catch (error) {
      if (!alive || selectedId.value !== id || currentUserId.value !== userId) return
      actionError.value = apiError(error)
      if (axios.isAxiosError(error) && [403, 404, 409].includes(error.response?.status ?? 0))
        await Promise.allSettled([loadList(), loadDetail(id, true)])
    } finally {
      if (alive) busy.value = false
    }
  }
  async function fetchReport() {
    const url = detail.value?.validationReportUrl
    if (!url || !ready.value || detailLoading.value) return
    const epoch = ++reportEpoch
    reportLoading.value = true
    report.value = null
    reportError.value = ''
    try {
      const { data } = await axios.get<ValidationReport>(url)
      if (alive && epoch === reportEpoch) report.value = data
    } catch (error) {
      if (alive && epoch === reportEpoch)
        reportError.value = apiError(error, 'Não foi possível carregar o relatório original.')
    } finally {
      if (alive && epoch === reportEpoch) reportLoading.value = false
    }
  }
  async function showReport() {
    if (!detail.value?.validationReportUrl || !ready.value || detailLoading.value) return
    reportOpen.value = true
    await fetchReport()
  }
  async function openCorrection() {
    if (!canCorrect.value || detailLoading.value) return
    correctionOpen.value = true
    if (!report.value && !reportLoading.value) await fetchReport()
  }
  function clearFileFilter() {
    if (!busy.value) void router.replace({ query: { ...route.query, fileId: undefined } })
  }
  watch(fileId, () => resetSelection())
  watch([scope, status, size, fileId], () => {
    page.value = 0
    void loadList()
  })
  watch(confirmResolve, (open) => {
    if (!open) resolution = null
  })
  watch(currentUserId, () => {
    resetSelection()
    page.value = 0
    void loadList()
  })
  void loadList()
  onBeforeUnmount(() => {
    alive = false
    ++listEpoch
    ++detailEpoch
    ++reportEpoch
  })
  return {
    scope,
    status,
    page,
    size,
    rows,
    totalElements,
    totalPages,
    loading,
    listError,
    selectedId,
    detail,
    detailLoading,
    detailError,
    treatment,
    busy,
    actionError,
    actionMessage,
    confirmResolve,
    correctionOpen,
    reportOpen,
    reportLoading,
    reportError,
    report,
    fileId,
    ready,
    canClaim,
    canEdit,
    canCorrect,
    observationError,
    dirty,
    loadList,
    loadDetail,
    select,
    refresh,
    changePage,
    requestResolve,
    act,
    showReport,
    fetchReport,
    openCorrection,
    clearFileFilter,
  }
}