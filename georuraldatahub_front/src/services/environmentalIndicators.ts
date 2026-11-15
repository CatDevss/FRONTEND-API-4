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
export async function listLayers(busca: string, page = 0) {
  return (await axios.get<Page<Layer>>('/ambiental/camadas', { params: { busca, page, size: 20 } }))
    .data
}
export async function listFeatures(layer: number, busca: string, campo: string, page = 0) {
  return (
    await axios.get<Page<Feature>>(`/ambiental/camadas/${layer}/feicoes`, {
      params: { busca, campo: campo || undefined, page, size: 20 },
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
export function formatValue(value: unknown): string {
  return typeof value === 'number' && Number.isFinite(value)
    ? new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 4 }).format(value)
    : 'Não disponível'
}
