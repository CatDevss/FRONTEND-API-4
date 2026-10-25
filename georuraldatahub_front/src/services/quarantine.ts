export interface QuarantineRecord {
  id: number
  ingestionId: number | null
  fileId: number | null
  fileName: string | null
  sourceId: number | null
  sourceName: string | null
  status: string | null
  reason: string | null
  treatment: string | null
  dateEntry: string | null
  dateResolution: string | null
  responsibleId: number | null
  responsibleName: string | null
  validationReportUrl: string | null
}

export interface QuarantinePage {
  content: QuarantineRecord[]
  page: number
  size: number
  totalElements: number
  totalPages: number
}

export const quarantineStatuses = [
  { value: 'ARQUIVO_REJEITADO', title: 'Arquivo rejeitado' },
  { value: 'REGISTROS_REJEITADOS', title: 'Registros rejeitados' },
  { value: 'EM_ANALISE', title: 'Em análise' },
  { value: 'RESOLVIDA', title: 'Resolvida' },
]
export function quarantineStatus(status: string | null) {
  return (
    quarantineStatuses.find((entry) => entry.value === status)?.title ?? status ?? 'Não informado'
  )
}
export function quarantineClosed(record: QuarantineRecord) {
  return record.status === 'RESOLVIDA' || record.dateResolution !== null
}
export function treatmentBytes(value: string) {
  return new TextEncoder().encode(value.trim()).length
}
export function treatmentError(value: string) {
  if (!value.trim()) return 'A observação é obrigatória.'
  return treatmentBytes(value) > 500 ? 'A observação excede o limite de 500 bytes UTF-8.' : ''
}
export function quarantineDate(value: string | null) {
  if (!value) return 'Não informada'
  const parts = value.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?/)
  return parts
    ? `${parts[3]}/${parts[2]}/${parts[1]} às ${parts[4]}:${parts[5]}${parts[6] ? `:${parts[6]}` : ''}`
    : value.replace('T', ' ')
}
