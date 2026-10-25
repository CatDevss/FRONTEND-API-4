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
  INVALID_COLUMN_COUNT: 'Quantidade de colunas diferente do cabeçalho',
  INVALID_FILE_STRUCTURE: 'Estrutura do arquivo inválida',
  UNSUPPORTED_FORMAT: 'Formato não suportado',
  MALFORMED_FILE: 'Arquivo malformado',
  EMPTY_FILE: 'Arquivo vazio',
}
export interface ParsedValidationError {
  code: string
  label: string
  detail: string
}
/**
 * Separa "CODIGO: detalhe" das mensagens do back. Aceita também o código sozinho
 * (ex.: "INVALID_GEOMETRY"); mensagens sem código conhecido ficam inteiras em `detail`.
 */
export function parseValidationError(message: string): ParsedValidationError {
  const separator = message.indexOf(':')
  const candidate = (separator > 0 ? message.slice(0, separator) : message).trim()
  if (!Object.prototype.hasOwnProperty.call(validationErrorLabels, candidate))
    return { code: '', label: '', detail: message }
  return {
    code: candidate,
    label: validationErrorLabels[candidate]!,
    detail: separator > 0 ? message.slice(separator + 1).trim() : '',
  }
}
/** Erros que atingem o arquivo inteiro (índice negativo) e registros rejeitados individualmente. */
export function correctionTargets(report: ValidationReport | null | undefined) {
  const records = report?.records ?? []
  return {
    fileErrors: records.filter((entry) => !entry.valid && entry.recordIndex < 0),
    rejected: records.filter((entry) => !entry.valid && entry.recordIndex >= 0),
  }
}

/**
 * Quem resolve cada erro:
 * - operator: dado do registro que o operador corrige manualmente;
 * - manager: campo que não existe no dicionário, o gestor precisa incluí-lo;
 * - either: valor fora do domínio do dicionário (erro de digitação ou domínio incompleto);
 * - file: erro do arquivo inteiro, não se resolve editando campos.
 */
export type ErrorOwner = 'operator' | 'manager' | 'either' | 'file'
const fileLevelCodes = new Set([
  'EMPTY_FILE',
  'MALFORMED_FILE',
  'INVALID_FILE_STRUCTURE',
  'UNSUPPORTED_FORMAT',
])
export function errorOwner(message: string, recordIndex: number): ErrorOwner {
  const { code } = parseValidationError(message)
  if (code === 'UNKNOWN_FIELD') return 'manager'
  if (code === 'UNKNOWN_VALUE') return 'either'
  if (fileLevelCodes.has(code) || recordIndex < 0) return 'file'
  return 'operator'
}
export const errorOwnerLabels: Record<ErrorOwner, string> = {
  operator: 'Operador corrige',
  manager: 'Depende do dicionário (gestor)',
  either: 'Operador ou gestor',
  file: 'Reenviar o arquivo',
}
/** `editable`: há algo que o operador pode corrigir; `needsManager`: há campo ausente do dicionário. */
export function recordCorrection(entry: { recordIndex: number; errors: string[] }) {
  const owners = entry.errors.map((message) => errorOwner(message, entry.recordIndex))
  return {
    editable: owners.some((owner) => owner === 'operator' || owner === 'either'),
    needsManager: owners.includes('manager'),
  }
}
/** Registros GeoJSON/JSON chegam como objeto; CSV chega como uma linha de valores entre aspas. */
export function editorKind(rawContent: string): 'json' | 'text' {
  return rawContent.trim().startsWith('{') ? 'json' : 'text'
}
export function initialDraft(rawContent: string): string {
  if (editorKind(rawContent) === 'json') {
    try {
      return JSON.stringify(JSON.parse(rawContent), null, 2)
    } catch {
      // mantém o texto original quando não é um JSON válido
    }
  }
  return rawContent
}
export function draftError(draft: string, rawContent: string): string {
  if (!draft.trim()) return 'A correção não pode ficar vazia.'
  if (editorKind(rawContent) === 'text') return ''
  try {
    const value: unknown = JSON.parse(draft)
    return value !== null && typeof value === 'object' && !Array.isArray(value)
      ? ''
      : 'O registro precisa ser um objeto JSON.'
  } catch {
    return 'JSON inválido. Confira vírgulas, aspas e chaves.'
  }
}