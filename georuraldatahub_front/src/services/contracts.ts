import axios from 'axios'

export interface Source {
  id: number
  name: string
  url: string
  description: string | null
  status: number
  dateCreation?: string
  userId: number
}
export interface FieldRule {
  name: string
  required: boolean
  type: string
  domain: string[]
  unique: boolean
}
export const fieldTypes = [
  'STRING',
  'NUMBER',
  'INTEGER',
  'BOOLEAN',
  'DATE',
  'LATITUDE',
  'LONGITUDE',
  'GEOMETRY',
]
export interface Dictionary {
  id: number
  sourceId: number
  name: string
  description: string | null
  version: number
  status: string
  rules: FieldRule[]
  createdOn: string
}
export interface ValidationReport {
  status: 'VALIDO' | 'PARCIAL' | 'REJEITADO'
  dictionaryId: number
  dictionaryVersion: number
  validRecords: number
  rejectedRecords: number
  records: { recordIndex: number; rawContent: string; valid: boolean; errors: string[] }[]
}
export interface IngestedFile {
  id: number
  name: string
  formatFile: string | null
  size: number
  hash: string | null
  location: string | null
  ingestionId: number
  receivedDate: string
  userId: number
  validation: ValidationReport | null
}
export interface Connector {
  id: string
  agency: string
  product: string
  access: string
  documentation: string
  limitations: string
}
export interface CollectionMetadata {
  product: string
  competence: string
  format: string
  originFormat: string
  scope: string
  collectedAt: string
  documentation: string
  limitations: string[]
  originals: {
    filename: string
    origin: string
    contentType: string
    size: number
    sha256: string
  }[]
}
export function apiError(
  error: unknown,
  fallback = 'Não foi possível concluir a operação.',
): string {
  const body = axios.isAxiosError(error) ? error.response?.data : undefined
  if (typeof body === 'string' && body.trim()) return body
  for (const key of ['detail', 'message', 'reason']) {
    if (typeof body?.[key] === 'string' && body[key].trim()) return body[key]
  }
  return fallback
}
export function validationMessage(report: ValidationReport | null | undefined): string {
  if (!report) return 'Validação indisponível. Consulte o relatório antes de utilizar os dados.'
  return `${report.status}: ${report.validRecords} registro(s) aprovado(s), ${report.rejectedRecords} rejeitado(s).`
}

export function sourceSupportsProduct(value: string, product: string): boolean {
  try {
    const url = new URL(value)
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) return false
    const agency = productAgencies[product]
    if (!agency) return false
    const slug = agency.split('.')[0]
    return (
      url.hostname === agency ||
      url.hostname.endsWith(`.${agency}`) ||
      (['ICMBIO', 'ICMBIO_EMBARGOS'].includes(product) &&
        url.hostname === 'geoservicos.inde.gov.br' &&
        url.pathname.startsWith('/geoserver/ICMBio/')) ||
      (url.hostname === 'www.gov.br' &&
        (url.pathname === `/${slug}` || url.pathname.startsWith(`/${slug}/`)))
    )
  } catch {
    return false
  }
}

export const productAgencies: Record<string, string> = {
  IBGE_MUNICIPIOS: 'ibge.gov.br',
  IBGE_BIOMAS: 'ibge.gov.br',
  INPE_PRODES: 'inpe.br',
  INPE_QUEIMADAS: 'inpe.br',
  ICMBIO: 'icmbio.gov.br',
  ICMBIO_EMBARGOS: 'icmbio.gov.br',
  MMA: 'mma.gov.br',
  FUNAI: 'funai.gov.br',
  INCRA: 'incra.gov.br',
  SFB: 'florestal.gov.br',
  IBAMA: 'ibama.gov.br',
}
export const supportedProducts = Object.keys(productAgencies)
export interface IngestionUser {
  id: number
  name: string
  userType: string
  userStatus: number
}

export interface Dataset {
  id: number
  name: string
  userId: number | null
}
export interface DatasetStructure extends Dataset {
  sources: {
    id: number
    name: string
    url: string
    files: {
      id: number
      name: string
      formatFile: string
      size: number
      receivedDate: string
      ingestionId: number
      dictionaryId: number
      dictionaryVersion: number
      layers: { fileId: number; name: string; formatFile: string }[]
    }[]
  }[]
}

export interface LayerReference {
  fileId: number
  name: string
  formatFile: string
  size: number | null
  receivedDate: string | null
}

export type VersionStatus = 'BRUTA' | 'QUARENTENA' | 'TRATADA' | 'PUBLICADA'
export const versionStatuses: VersionStatus[] = ['BRUTA', 'QUARENTENA', 'TRATADA', 'PUBLICADA']
export interface FileStage {
  fileId: number
  status: VersionStatus
  versionNumber: number
  location: string | null
}
