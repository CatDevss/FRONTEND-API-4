import { computed, ref } from 'vue'
import axios from 'axios'

interface UploadResult {
  name: string
  success: boolean
  message: string
}

export const isUploadInProgress = ref(false)
export const totalFiles = ref(0)
export const completedFiles = ref(0)
export const currentFileName = ref('')
export const currentFileProgress = ref(0) // 0 a 100, progresso do arquivo sendo enviado agora
export const uploadResults = ref<UploadResult[]>([])

// Snackbar global com o resultado final, mostrado pelo App.vue
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

function describeError(status: number | undefined, backendMessage: string | undefined): string {
  if (status === 409) return 'Este arquivo já foi enviado anteriormente para este conjunto.'
  if (status === 404) return 'Conjunto não encontrado. Tente selecionar o conjunto novamente.'
  if (backendMessage) return backendMessage
  return 'Não foi possível enviar o arquivo. Tente novamente.'
}

export function cancelUpload() {
  controller?.abort()
}

export async function startUpload(datasetId: number, files: File[], userId: number) {
  if (isUploadInProgress.value) return 

  controller = new AbortController()
  isUploadInProgress.value = true
  uploadResults.value = []
  totalFiles.value = files.length
  completedFiles.value = 0
  currentFileProgress.value = 0
  let wasCancelled = false

  for (const file of files) {
    if (controller.signal.aborted) {
      wasCancelled = true
      break
    }

    currentFileName.value = file.name
    currentFileProgress.value = 0

    const formData = new FormData()
    formData.append('file', file)

    try {
      await axios.post(`/conjuntos/${datasetId}/arquivos`, formData, {
        params: { userId },
        headers: { 'Content-Type': 'multipart/form-data' },
        signal: controller.signal,
        onUploadProgress: (event) => {
          if (event.total) {
            currentFileProgress.value = Math.round((event.loaded / event.total) * 100)
          }
        },
      })
      uploadResults.value.push({ name: file.name, success: true, message: 'Enviado com sucesso' })
    } catch (error) {
      if (axios.isCancel(error) || controller.signal.aborted) {
        wasCancelled = true
        break
      }
      const status = axios.isAxiosError(error) ? error.response?.status : undefined
      const backendMessage = axios.isAxiosError(error) ? error.response?.data?.message : undefined
      uploadResults.value.push({
        name: file.name,
        success: false,
        message: describeError(status, backendMessage),
      })
    }

    completedFiles.value++
  }

  isUploadInProgress.value = false
  controller = null

  const successCount = uploadResults.value.filter((r) => r.success).length
  const failedCount = uploadResults.value.filter((r) => !r.success).length

  if (wasCancelled) {
    uploadSnackbarMessage.value = `Envio cancelado. ${successCount} de ${totalFiles.value} arquivo(s) haviam sido enviados.`
  } else if (failedCount > 0) {
    uploadSnackbarMessage.value = `${successCount} de ${totalFiles.value} arquivo(s) enviados. ${failedCount} falharam.`
  } else {
    uploadSnackbarMessage.value = `${successCount} de ${totalFiles.value} arquivo(s) enviado(s) com sucesso.`
  }
  uploadSnackbarVisible.value = true
}