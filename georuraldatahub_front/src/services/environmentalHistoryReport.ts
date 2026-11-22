import { listHistory, getHistory, type HistoryEntry } from './environmentalIndicators'
import { metricGroups, type CalculationSnapshot } from './environmentalReport'
import type { AreaCalculation } from './environmentalBatch'
import { apiError } from './contracts'
import type { HistoryFilters } from './environmentalHistoryFilters'
export interface HistoricalGroup {
  indicator: string
  entries: AreaCalculation[]
}
export async function historicalReport(
  search: string,
  indicator: string,
  signal: AbortSignal,
  progress: (done: number, total: number) => void,
  filters: HistoryFilters = {},
): Promise<HistoricalGroup[]> {
  const rows = new Map<number, HistoryEntry>()
  let expected = 0
  for (let page = 0; ; page++) {
    signal.throwIfAborted()
    const data = await listHistory(search, indicator, page, signal, filters)
    if (!Array.isArray(data.items)) throw new Error('O histórico retornou uma resposta inválida.')
    if (!page) expected = data.total
    if (data.total !== expected)
      throw new Error('O histórico mudou durante a consulta. Atualize a busca.')
    const previous = rows.size
    for (const row of data.items) {
      if (
        !Number.isSafeInteger(row.id) ||
        row.id <= 0 ||
        !Number.isSafeInteger(row.featureId) ||
        typeof row.name !== 'string' ||
        typeof row.indicator !== 'string'
      )
        throw new Error('O histórico contém um registro inválido.')
      rows.set(row.id, row)
    }
    progress(0, expected)
    if (rows.size >= expected) break
    if (rows.size === previous) throw new Error('Não foi possível carregar todo o histórico.')
  }
  const records = [...rows.values()]
  const entries: { indicator: string; entry: AreaCalculation }[] = new Array(records.length)
  let cursor = 0,
    done = 0
  async function worker() {
    while (cursor < records.length) {
      signal.throwIfAborted()
      const index = cursor++,
        row = records[index]!
      const area = { id: row.id, featureId: row.featureId, name: row.name }
      const selected = indicator || row.indicator
      try {
        const saved = await getHistory(row.id, signal)
        const result = { ...saved.result }
        result.calculoId = saved.calculation.id
        result.calculadoEm ??= saved.calculation.calculatedAt
        if (selected !== 'todos') {
          for (const key of metricGroups)
            if (
              !(selected === 'idesmat' ? key.startsWith('IDesmat') : key.toLowerCase() === selected)
            )
              delete result[key]
        }
        const snapshot: CalculationSnapshot = {
          name: saved.calculation.name,
          featureId: saved.calculation.featureId,
          indicator: selected,
          parameters: saved.parameters,
          result,
        }
        entries[index] = { indicator: selected, entry: { area, snapshot } }
      } catch (error) {
        signal.throwIfAborted()
        entries[index] = {
          indicator: selected,
          entry: {
            area,
            error: apiError(
              error,
              'Não foi possível carregar este cálculo salvo. Atualize a busca.',
            ),
          },
        }
      }
      progress(++done, records.length)
    }
  }
  await Promise.all(Array.from({ length: Math.min(4, records.length) }, worker))
  signal.throwIfAborted()
  const groups = new Map<string, AreaCalculation[]>()
  for (const row of entries) {
    const group = groups.get(row.indicator) ?? []
    group.push(row.entry)
    groups.set(row.indicator, group)
  }
  return [...groups].map(([indicator, entries]) => ({ indicator, entries }))
}
