import { computed, ref } from 'vue'
import axios from 'axios'
import { can, currentUserId } from '@/access/session'
import {
  beginIngestionProgress,
  updateIngestionProgress,
  finishIngestionProgress,
} from '@/composables/ingestionProgress'
import {
  apiError,
  validationMessage,
  type IngestedFile,
  type ValidationReport,
} from '@/services/contracts'

interface UploadResult {
  fileId?: number | null
  name: string
  success: boolean
  message: string
  validation?: ValidationReport | null
}

export const isCollectionInProgress = ref(false)
export const isUploadInProgress = ref(false)
export const totalFiles = ref(0)
export const completedFiles = ref(0)
export const currentFileName = ref('')
export const currentFileProgress = ref(0) // 0 a 100, progresso do arquivo sendo enviado agora
export const uploadResults = ref<UploadResult[]>([])

// Resumo do lote; a apresentação global fica no IngestionProgressPopup.
export const uploadSnackbarVisible = ref(false)
export const uploadSnackbarMessage = ref('')

let controller: AbortController | null = null

// Progresso geral (0 a 100), somando os arquivos já concluídos + o andamento do atual
export const overallProgress = computed(() => {
  if (totalFiles.value === 0) return 0
  const perFile = 100 / totalFiles.value
  return Math.min(
    100,
    Math.round(completedFiles.value * perFile + (currentFileProgress.value * perFile) / 100),
  )
})

export function cancelUpload() {
  controller?.abort()
}

export async function startUpload(
  sourceId: number,
  files: File[],
  userId: number,
  dictionaryId?: number | null,
  sourceName?: string,
) {
  if (
    isUploadInProgress.value ||
    isCollectionInProgress.value ||
    files.length === 0 ||
    !can('ingestion.run') ||
    currentUserId.value !== userId ||
    (dictionaryId != null && (!Number.isInteger(dictionaryId) || dictionaryId <= 0))
  )
    return

  controller = new AbortController()
  isUploadInProgress.value = true
  uploadResults.value = []
  totalFiles.value = files.length
  completedFiles.value = 0
  currentFileProgress.value = 0
  const progressId = beginIngestionProgress({
    kind: 'manual',
    title: `${files.length} arquivo(s) para envio`,
    source: sourceName || `Fonte #${sourceId}`,
    fileCount: files.length,
  })
  let wasCancelled = false

  for (const file of files) {
    if (controller.signal.aborted || !can('ingestion.run') || currentUserId.value !== userId) {
      wasCancelled = true
      break
    }

    currentFileName.value = file.name
    currentFileProgress.value = 0
    updateIngestionProgress(progressId, {
      stage: 'uploading',
      fileName: file.name,
      percent: null,
      loadedBytes: null,
      totalBytes: null,
    })

    const formData = new FormData()
    formData.append('file', file)

    try {
      const { data } = await axios.post<IngestedFile>(`/fontes/${sourceId}/arquivos`, formData, {
        params: { userId, ...(dictionaryId != null ? { dictionaryId } : {}) },
        signal: controller.signal,
        onUploadProgress: (event) => {
          const percent =
            event.total && event.total > 0
              ? Math.min(100, Math.max(0, Math.floor((event.loaded / event.total) * 100)))
              : null
          updateIngestionProgress(progressId, {
            stage: percent === 100 ? 'validating' : 'uploading',
            loadedBytes: event.loaded,
            totalBytes: event.total ?? null,
            percent,
          })
          if (event.total) {
            currentFileProgress.value = Math.round((event.loaded / event.total) * 100)
          }
        },
      })
      if (controller.signal.aborted || currentUserId.value !== userId || !can('ingestion.run')) {
        wasCancelled = true
        break
      }
      uploadResults.value.push({
        fileId: data.id ?? null,
        name: file.name,
        success: data.validation?.status === 'VALIDO',
        message: validationMessage(data.validation),
        validation: data.validation,
      })
    } catch (error) {
      if (axios.isCancel(error) || controller.signal.aborted) {
        wasCancelled = true
        break
      }
      uploadResults.value.push({
        name: file.name,
        success: false,
        message: apiError(error, 'Não foi possível enviar o arquivo.'),
      })
    }

    completedFiles.value++
    updateIngestionProgress(progressId, { completedCount: completedFiles.value })
  }

  isUploadInProgress.value = false
  controller = null

  const successCount = uploadResults.value.filter((r) => r.success).length
  const failedCount = uploadResults.value.filter((r) => !r.success).length

  if (wasCancelled) {
    uploadSnackbarMessage.value = `Envio cancelado. ${successCount} de ${totalFiles.value} arquivo(s) haviam sido enviados.`
  } else if (failedCount > 0) {
    uploadSnackbarMessage.value = `${successCount} de ${totalFiles.value} arquivo(s) integralmente válidos. ${failedCount} com rejeições, validação indisponível ou erro.`
  } else {
    uploadSnackbarMessage.value = `${successCount} de ${totalFiles.value} arquivo(s) enviado(s) e integralmente válido(s).`
  }
  uploadSnackbarVisible.value = true
  const rejected = uploadResults.value.find(
    (item) => item.validation?.status === 'REJEITADO' || item.validation?.status === 'PARCIAL',
  )
  const registered = uploadResults.value.filter(
    (item) => item.fileId != null || !!item.validation,
  ).length
  finishIngestionProgress(
    progressId,
    wasCancelled
      ? 'cancelled'
      : failedCount === 0
        ? 'completed'
        : registered > 0
          ? 'attention'
          : 'error',
    wasCancelled
      ? 'O acompanhamento foi interrompido. Confira os arquivos já registrados; interromper a requisição não desfaz operações concluídas no servidor.'
      : `${uploadSnackbarMessage.value}${failedCount ? ` ${uploadResults.value.find((item) => !item.success)?.message ?? ''}` : ''}`,
    rejected?.fileId ?? null,
  )
}
