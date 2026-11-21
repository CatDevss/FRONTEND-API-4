import axios from 'axios'
export interface Layer {
  id: number
  name: string
  datasetId: number
  dataset: string
  versionId: number
  file: string
  source: string
  geometry: string
  features: number
  srid: number
  composed: boolean
  polygons: number
}
export interface Feature {
  id: number
  name: string
  attributes: string | null
}
export interface Page<T> {
  items: T[]
  total: number
  page: number
  size: number
}
export const indicators = [
  { id: 'icv', name: 'ICV · Cobertura vegetal nativa', roles: ['vegetacao'] },
  { id: 'irl', name: 'IRL · Reserva legal', roles: ['reservaLegal'] },
  { id: 'iapp', name: 'IAPP · APP conservada', roles: ['app', 'vegetacao'] },
  { id: 'isap', name: 'ISAP · Áreas protegidas', roles: ['areasProtegidas'] },
  { id: 'iae', name: 'IAE · Áreas embargadas', roles: ['embargos'] },
  { id: 'idesmat', name: 'IDesmat · Desmatamento', roles: ['desmatamento'] },
  { id: 'ifc', name: 'IFC · Focos de calor', roles: ['focos'] },
] as const
export const roleNames: Record<string, string> = {
  vegetacao: 'Vegetação nativa',
  reservaLegal: 'Reserva legal',
  app: 'APP',
  areasProtegidas: 'Áreas protegidas',
  embargos: 'Embargos',
  desmatamento: 'Desmatamento',
  focos: 'Focos de calor',
}
export interface LayerFilters {
  conjunto?: number
  tipo?: string
  fonte?: string
  poligonal?: boolean
}
export async function listLayers(busca: string, page = 0, filters: LayerFilters = {}) {
  return (
    await axios.get<Page<Layer>>('/ambiental/camadas', {
      params: { busca, page, size: 20, ...filters },
    })
  ).data
}
export async function listFeatures(
  layer: number,
  busca: string,
  campo: string,
  page = 0,
  size = 20,
) {
  return (
    await axios.get<Page<Feature>>(`/ambiental/camadas/${layer}/feicoes`, {
      params: { busca, campo: campo || undefined, page, size },
    })
  ).data
}
export async function calculate(
  feature: number,
  indicator: string,
  parameters: Record<string, unknown>,
) {
  return (
    await axios.post<Record<string, unknown>>(
      `/imoveis/${feature}/indicadores/${indicator}`,
      parameters,
      { timeout: 310000 },
    )
  ).data
}
export async function calculateAndSave(
  feature: number,
  indicator: string,
  parameters: Record<string, unknown>,
) {
  return (
    await axios.post<Record<string, unknown>>(
      `/imoveis/${feature}/indicadores/${indicator}/calcular`,
      parameters,
      { timeout: 310000 },
    )
  ).data
}
export function formatValue(value: unknown): string {
  return typeof value === 'number' && Number.isFinite(value)
    ? new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 4 }).format(value)
    : 'Não disponível'
}

export interface ImportableVersion {
  id: number
  number: number
  fileId: number
  file: string
  source: string
  format: string
  importedLayers: number
}
export async function listVersions(dataset: number, busca: string, page = 0) {
  return (
    await axios.get<Page<ImportableVersion>>(`/conjuntos/${dataset}/versoes-importaveis`, {
      params: { busca, page, size: 20 },
    })
  ).data
}
export async function importLayer(dataset: number, version: number, repair = false) {
  return (
    await axios.post<{ camadaId: number; quantidade: number }>(
      `/conjuntos/${dataset}/versoes/${version}/camada-oracle`,
      undefined,
      { timeout: 310000, ...(repair ? { params: { corrigirGeometria: true } } : {}) },
    )
  ).data
}
export async function layerDetails(id: number) {
  return (await axios.get<{ layer: Layer; origins: Layer[] }>(`/ambiental/camadas/${id}`)).data
}
export async function combineLayers(dataset: number, nome: string, camadas: number[]) {
  return (
    await axios.post<{ camadaId: number; quantidade: number }>(
      `/conjuntos/${dataset}/camadas/combinar`,
      { nome, camadas },
      { timeout: 310000 },
    )
  ).data
}
export type ResultMap = import('geojson').FeatureCollection & { aviso?: string }

export async function loadResultMap(
  feature: number,
  indicator: string,
  parameters: Record<string, unknown>,
) {
  return (
    await axios.post<ResultMap>(`/imoveis/${feature}/indicadores/${indicator}/mapa`, parameters, {
      timeout: 310000,
    })
  ).data
}

export interface HistoryEntry {
  id: number
  featureId: number
  name: string
  indicator: string
  calculatedAt: string
  rule: string
}
export interface HistoryDetail {
  calculation: HistoryEntry
  parameters: Record<string, unknown>
  result: Record<string, unknown>
}
export async function listHistory(busca: string, indicador: string, page = 0) {
  return (
    await axios.get<Page<HistoryEntry>>('/ambiental/calculos', {
      params: { busca, indicador, page, size: 20 },
    })
  ).data
}
export async function getHistory(id: number) {
  return (await axios.get<HistoryDetail>(`/ambiental/calculos/${id}`)).data
}
