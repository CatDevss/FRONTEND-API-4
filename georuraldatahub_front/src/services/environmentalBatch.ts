import axios from 'axios'
import { calculate, calculateAndSave, listFeatures } from './environmentalIndicators'
import { apiError } from './contracts'
import type { CalculationSnapshot } from './environmentalReport'
export interface AnalysisArea {
  id: number
  name: string
}
export interface AreaCalculation {
  area: AnalysisArea
  snapshot?: CalculationSnapshot
  error?: string
  unconfirmed?: boolean
}
export async function allAnalysisAreas(
  layer: number,
  stopped: () => boolean,
): Promise<AnalysisArea[]> {
  const areas = new Map<number, AnalysisArea>()
  let page = 0,
    total = 0
  do {
    if (stopped()) return []
    const data = await listFeatures(layer, '', '', page++, 100)
    total = data.total
    if (!data.items.length && areas.size < total)
      throw new Error('A listagem de áreas ficou incompleta. Nenhum cálculo foi iniciado.')
    for (const item of data.items) areas.set(item.id, { id: item.id, name: item.name })
    if (page * 100 >= total) break
  } while (true)
  if (areas.size !== total)
    throw new Error('A camada mudou durante a listagem. Atualize e tente novamente.')
  return [...areas.values()]
}
export async function calculateAreas(
  areas: AnalysisArea[],
  indicator: string,
  parameters: Record<string, unknown>,
  save: boolean,
  stopped: () => boolean,
  completed: (entry: AreaCalculation) => void,
) {
  const params = JSON.parse(JSON.stringify(parameters)) as Record<string, unknown>
  // Cada chamada salva uma área. Interromper não desfaz os cálculos já concluídos.
  for (const area of areas) {
    if (stopped()) break
    try {
      const result = await (save ? calculateAndSave : calculate)(area.id, indicator, params)
      completed({
        area,
        snapshot: {
          name: area.name,
          featureId: area.id,
          indicator,
          parameters: JSON.parse(JSON.stringify(params)),
          result,
        },
      })
    } catch (error) {
      const noResponse = axios.isAxiosError(error) && !error.response
      completed({
        area,
        unconfirmed: noResponse,
        error: noResponse
          ? `Sem confirmação do servidor.${save ? ' Consulte o histórico antes de tentar novamente.' : ''}`
          : apiError(error, 'Não foi possível calcular esta área.'),
      })
      if (
        noResponse ||
        (axios.isAxiosError(error) && [401, 403].includes(error.response?.status ?? 0))
      )
        break
    }
  }
}
