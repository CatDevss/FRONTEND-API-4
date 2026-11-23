import { supportedProducts, type CollectionMetadata } from './contracts'

export interface CollectionEdition {
  competence: string
  url: string | null
  format: string
  description: string
}
export interface CollectionAvailability {
  product: string
  temporalMode: 'DIARIO' | 'EDICOES_PUBLICADAS' | 'BASE_ATUAL' | 'ANUAL'
  editions: CollectionEdition[]
  limitation: string
}
export interface CollectionVerification {
  status: 'DISPONIVEL' | 'SEM_REGISTROS'
  records: number
  bytes: number
  collection: CollectionMetadata
}
export const currentProducts = ['ICMBIO', 'ICMBIO_EMBARGOS', 'FUNAI', 'INCRA', 'IBAMA']
export const bboxProducts = [...currentProducts, 'MMA', 'SFB', 'INPE_PRODES']

export function parseBbox(value: string): number[] | undefined {
  if (!value.trim()) return undefined
  const coordinates = value.split(',').map((n) => (n.trim() ? Number(n) : NaN))
  if (coordinates.length !== 4 || coordinates.some((n) => !Number.isFinite(n)))
    throw new Error('Informe quatro coordenadas numéricas: oeste, sul, leste, norte.')
  const [west, south, east, north] = coordinates as [number, number, number, number]
  if (west < -180 || east > 180 || south < -90 || north > 90 || west >= east || south >= north)
    throw new Error(
      'O recorte deve ter oeste menor que leste e sul menor que norte, dentro dos limites de longitude e latitude.',
    )
  return coordinates
}
export function collectionParameters(
  product: string,
  competence: string,
  municipality = '',
  biome = '',
  bbox = '',
) {
  if (!supportedProducts.includes(product))
    throw new Error('Produto sem coleta automática disponível.')
  competence = competence.trim().toUpperCase()
  if (currentProducts.includes(product)) {
    if (competence !== 'ATUAL') throw new Error('Este produto aceita somente a base ATUAL.')
  } else if (product === 'IBGE_BIOMAS') {
    if (!['2019', '2025'].includes(competence)) throw new Error('Selecione a edição 2019 ou 2025.')
  } else if (product === 'INPE_QUEIMADAS') {
    const day = new Date(`${competence}T00:00:00Z`)
    const today = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Sao_Paulo',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date())
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(competence) ||
      !Number.isFinite(day.getTime()) ||
      day.toISOString().slice(0, 10) !== competence ||
      competence >= today
    )
      throw new Error('Informe um dia válido já encerrado (AAAA-MM-DD).')
  } else if (product === 'MMA') {
    if (!/^(ATUAL|\d{4}|\d{4}-(0[1-9]|1[0-2]))$/.test(competence))
      throw new Error('Informe ATUAL, um ano (AAAA) ou uma edição (AAAA-MM).')
  } else if (!/^\d{4}$/.test(competence))
    throw new Error('Informe o ano publicado com quatro dígitos.')
  const parameters: { competence: string; municipality?: string; biome?: string; bbox?: number[] } =
    { competence }
  if (product === 'IBGE_MUNICIPIOS' && municipality.trim()) {
    if (!/^41\d{5}$/.test(municipality.trim()))
      throw new Error('Informe um código IBGE do Paraná válido.')
    parameters.municipality = municipality.trim()
  }
  if (product === 'INPE_PRODES') {
    if (!['CERRADO', 'MATA_ATLANTICA'].includes(biome)) throw new Error('Selecione o bioma.')
    parameters.biome = biome
  }
  if (bboxProducts.includes(product)) {
    const parsed = parseBbox(bbox)
    if (parsed) parameters.bbox = parsed
  }
  return parameters
}
