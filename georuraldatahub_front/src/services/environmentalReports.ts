import axios from 'axios'
import type { AnalysisArea, AreaCalculation } from './environmentalBatch'
import type { Page } from './environmentalIndicators'
import type { HistoryFilters } from './environmentalHistoryFilters'
export interface SavedReport {
  id: string
  name: string
  indicator: string
  parameters: Record<string, unknown>
  total: number
  createdAt: string
  completed: number
  failed: number
}
export async function reportsAvailable() {
  return (
    (await axios.get<{ enabled: boolean }>('/ambiental/relatorios/recursos')).data.enabled === true
  )
}
export async function createReport(
  layerId: number,
  areas: AnalysisArea[],
  indicator: string,
  parameters: Record<string, unknown>,
) {
  const id = crypto.randomUUID()
  const request = { id, layerId, indicator, parameters, featureIds: areas.map((area) => area.id) }
  try {
    return (await axios.post<SavedReport>('/ambiental/relatorios', request)).data
  } catch (error) {
    // Uma resposta perdida nao autoriza criar outro relatorio nem repetir o calculo.
    if (axios.isAxiosError(error) && !error.response) {
      try {
        return (await getReport(id)).report
      } catch {
        throw error
      }
    }
    throw error
  }
}
export async function calculateReportArea(id: string, feature: number) {
  return (
    await axios.post<Record<string, unknown>>(
      `/ambiental/relatorios/${id}/feicoes/${feature}/calcular`,
      undefined,
      { timeout: 310000 },
    )
  ).data
}
export async function recordReportFailure(id: string, feature: number, message: string) {
  await axios.post(`/ambiental/relatorios/${id}/feicoes/${feature}/falha`, { message })
}
export async function listReports(
  busca = '',
  indicador = '',
  page = 0,
  signal?: AbortSignal,
  filters: HistoryFilters = {},
) {
  return (
    await axios.get<Page<SavedReport>>('/ambiental/relatorios', {
      params: { busca, indicador, page, size: 20, ...filters },
      timeout: 30000,
      ...(signal ? { signal } : {}),
    })
  ).data
}
export async function getReport(id: string, page = 0) {
  return (
    await axios.get<{ report: SavedReport; items: AreaCalculation[]; total: number }>(
      '/ambiental/relatorios/' + id,
      { params: { page, size: 100 } },
    )
  ).data
}
export async function loadWholeReport(id: string) {
  const first = await getReport(id)
  const rows = [...first.items]
  for (let page = 1; rows.length < first.total; page++) {
    const next = await getReport(id, page)
    if (!next.items.length)
      throw new Error('Não foi possível carregar todas as áreas do relatório.')
    rows.push(...next.items)
  }
  return {
    report: first.report,
    areas: rows.map((row) => row.area),
    entries: rows.filter((row) => row.snapshot || row.error),
  }
}

export async function reportDeletionAvailable(): Promise<boolean> {
  return (
    (
      await axios.get<{ deletionEnabled?: boolean }>('/ambiental/relatorios/recursos', {
        timeout: 30000,
      })
    ).data.deletionEnabled === true
  )
}
export async function deleteReport(id: string, user: number) {
  await axios.delete(`/ambiental/relatorios/${id}`, { params: { usuarioId: user }, timeout: 30000 })
}

export async function calculationDeletionAvailable(): Promise<boolean> {
  return (
    (
      await axios.get<{ calculationDeletionEnabled?: boolean }>('/ambiental/relatorios/recursos', {
        timeout: 30000,
      })
    ).data.calculationDeletionEnabled === true
  )
}
export async function deleteCalculation(id: number, user: number) {
  await axios.delete(`/ambiental/calculos/${id}`, { params: { usuarioId: user }, timeout: 30000 })
}
