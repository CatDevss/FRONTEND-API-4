import type { ValidationReport } from '@/services/contracts'

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

const validationErrorLabels: Record<string, string> = {
  REQUIRED_FIELD: 'Campo obrigatório',
  UNKNOWN_FIELD: 'Campo não previsto no dicionário',
  INVALID_TYPE: 'Tipo de valor inválido',
  UNKNOWN_VALUE: 'Valor não permitido',
  DUPLICATE_VALUE: 'Valor duplicado',
  INVALID_GEOMETRY: 'Geometria inválida',
  INVALID_COORDINATES: 'Coordenadas inválidas',
  INVALID_RECORD_STRUCTURE: 'Estrutura do registro inválida',
  INVALID_FILE_STRUCTURE: 'Estrutura do arquivo inválida',
  UNSUPPORTED_FORMAT: 'Formato não suportado',
  MALFORMED_FILE: 'Arquivo malformado',
}
export interface ParsedValidationError {
  code: string
  label: string
  detail: string
}
/** Separa "CODIGO: detalhe" das mensagens do back; mensagens sem código conhecido ficam inteiras em `detail`. */
export function parseValidationError(message: string): ParsedValidationError {
  const separator = message.indexOf(':')
  const code = separator > 0 ? message.slice(0, separator).trim() : ''
  if (!Object.prototype.hasOwnProperty.call(validationErrorLabels, code))
    return { code: '', label: '', detail: message }
  return { code, label: validationErrorLabels[code]!, detail: message.slice(separator + 1).trim() }
}
/** Erros que atingem o arquivo inteiro (índice negativo) e registros rejeitados individualmente. */
export function correctionTargets(report: ValidationReport | null | undefined) {
  const records = report?.records ?? []
  return {
    fileErrors: records.filter((entry) => !entry.valid && entry.recordIndex < 0),
    rejected: records.filter((entry) => !entry.valid && entry.recordIndex >= 0),
  }
}