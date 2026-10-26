import { readonly, ref } from 'vue'

type ProgressStatus = 'running' | 'completed' | 'attention' | 'error' | 'cancelled'
export interface IngestionProgress {
  id: number
  kind: 'manual' | 'automatic'
  status: ProgressStatus
  stage: 'uploading' | 'validating' | 'collecting' | 'finished'
  title: string
  source: string
  fileName: string
  fileCount: number
  completedCount: number
  loadedBytes: number | null
  totalBytes: number | null
  percent: number | null
  startedAt: number
  finishedAt: number | null
  message: string
  fileId: number | null
}
const progress = ref<IngestionProgress | null>(null)
export const ingestionProgress = readonly(progress)
let sequence = 0
export function beginIngestionProgress(
  input: Pick<IngestionProgress, 'kind' | 'title' | 'source' | 'fileCount'>,
) {
  const id = ++sequence
  progress.value = {
    ...input,
    id,
    status: 'running',
    stage: input.kind === 'manual' ? 'uploading' : 'collecting',
    fileName: '',
    completedCount: 0,
    loadedBytes: null,
    totalBytes: null,
    percent: null,
    startedAt: Date.now(),
    finishedAt: null,
    message: '',
    fileId: null,
  }
  return id
}
export function updateIngestionProgress(
  id: number,
  patch: Partial<
    Pick<
      IngestionProgress,
      'stage' | 'fileName' | 'completedCount' | 'loadedBytes' | 'totalBytes' | 'percent'
    >
  >,
) {
  if (progress.value?.id === id && progress.value.status === 'running')
    Object.assign(progress.value, patch)
}
export function finishIngestionProgress(
  id: number,
  status: Exclude<ProgressStatus, 'running'>,
  message: string,
  fileId: number | null = null,
) {
  if (progress.value?.id !== id || progress.value.status !== 'running') return
  Object.assign(progress.value, {
    status,
    stage: 'finished',
    finishedAt: Date.now(),
    message,
    fileId,
  })
}
export function clearIngestionProgress() {
  progress.value = null
}
