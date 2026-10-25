import type { Polygon, MultiPolygon } from 'geojson'

export interface ApiPage<T> {
  content: T[]
  page: number
  size: number
  totalElements: number
  totalPages: number
}
export interface TreatmentExecution {
  id: number
  fileId: number
  inputVersionId: number
  userId: number
  status: string
  startedAt: string | null
  finishedAt: string | null
  outputVersionId: number | null
  layerId: number | null
  rasterId: number | null
  inputCount: number | null
  outputCount: number | null
  error: string | null
  parameters: { request?: { datasetId?: number | null }; [key: string]: unknown } | null
  provenance: unknown
}
export interface TreatmentFile {
  id: number
  name: string
  formatFile: string | null
}
export interface RasterEntry {
  id: number
  versionId: number
  location: string
  sourceSrid: number
  coverageSrid: number
  width: number
  height: number
  bandCount: number
}
export interface RasterDetail {
  id: number
  versionId: number
  location: string
  sourceSrid: number
  coverageSrid: number
  metadata: {
    kind?: string
    toolVersion?: string
    geotransform?: number[]
    bands?: { number: number; dataType: string; noData: string | null; unit: string | null }[]
    summary?: {
      width?: number
      height?: number
      bandCount?: number
      pixelWidth?: number
      pixelHeight?: number
      pixelUnit?: string
      footprint?: Polygon | MultiPolygon
    }
  } | null
}
export interface QuarantineObject {
  id: number
  fileId: number | null
  status: string | null
  reason: string | null
  quarantineLocation: string | null
  quarantineReportLocation: string | null
}
export const uploadExtensions = ['csv', 'json', 'geojson', 'zip', 'gpkg', 'tif', 'tiff'] as const
export function isRaster(format: string | null) {
  return ['tif', 'tiff'].includes((format ?? '').toLowerCase())
}
export function supportsTreatment(format: string | null) {
  return (uploadExtensions as readonly string[]).includes((format ?? '').toLowerCase())
}
export function treatmentStatus(status: string) {
  return (
    (
      { EM_EXECUCAO: 'Em execução', CONCLUIDO: 'Concluído', FALHOU: 'Falhou' } as Record<
        string,
        string
      >
    )[status] ?? status
  )
}
export function treatmentMapLocation(execution: TreatmentExecution) {
  const datasetId = execution.parameters?.request?.datasetId
  if (execution.status !== 'CONCLUIDO' || !positiveId(execution.layerId) || !positiveId(datasetId))
    return null
  return { path: '/home', query: { dataset: String(datasetId), treatment: String(execution.id) } }
}
export function positiveId(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0
}
export function processingDate(value: string | null) {
  if (!value) return 'Não informado'
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?/.exec(value)
  return match ? `${match[3]}/${match[2]}/${match[1]} ${match[4]}:${match[5]}` : value
}
