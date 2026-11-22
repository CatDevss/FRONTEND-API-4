import { metricGroups, metricLabels, type CalculationSnapshot } from './environmentalReport'
import type { AnalysisArea, AreaCalculation } from './environmentalBatch'
export interface Repair {
  feicaoId: number
  papel: string
  nome?: string
  registro: Record<string, unknown>
}
export function resultRepairs(result: Record<string, unknown>): Repair[] {
  if (!Array.isArray(result.reparos)) return []
  return result.reparos.filter(
    (item): item is Repair =>
      item &&
      typeof item === 'object' &&
      typeof item.papel === 'string' &&
      item.registro &&
      typeof item.registro === 'object',
  )
}
export function resultAvailability(result: Record<string, unknown>) {
  const groups = metricGroups
    .map((key) => result[key])
    .filter((value) => value && typeof value === 'object') as Record<string, unknown>[]
  if (!groups.length || groups.every((group) => group.situacao === 'SEM_DADOS')) return 'Sem dados'
  if (groups.some((group) => group.situacao === 'SEM_DADOS' || group.situacao === 'PARCIAL'))
    return 'Dados parciais'
  if (groups.some((group) => group.situacao === 'SEM_BASE')) return 'Sem base percentual'
  if (groups.some((group) => typeof group.situacao !== 'string'))
    return 'Disponibilidade não informada'
  return 'Dados presentes nas fontes'
}
export function comparisonColumns(entries: AreaCalculation[]) {
  return metricGroups.flatMap((group) =>
    Object.entries(metricLabels)
      .filter(([key]) =>
        entries.some((e) => {
          const metrics = e.snapshot?.result[group]
          return metrics && typeof metrics === 'object' && key in metrics
        }),
      )
      .map(([key, [label, unit]]) => ({
        key: `${group}.${key}`,
        label: `${group} · ${label}`,
        unit,
      })),
  )
}
export function comparisonValue(
  snapshot: CalculationSnapshot | undefined,
  key: string,
): number | null {
  const [group, metric] = key.split('.')
  const object = snapshot?.result[group!]
  const value =
    object && typeof object === 'object' ? (object as Record<string, unknown>)[metric!] : undefined
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}
export function sortedComparison(
  areas: AnalysisArea[],
  entries: AreaCalculation[],
  key: string,
  descending: boolean,
) {
  const indexed = new Map(entries.map((entry) => [entry.area.id, entry]))
  return areas
    .map((area) => indexed.get(area.id) ?? { area })
    .sort((a, b) => {
      if (key === 'name')
        return a.area.name.localeCompare(b.area.name, 'pt-BR') * (descending ? -1 : 1)
      const av = comparisonValue(a.snapshot, key),
        bv = comparisonValue(b.snapshot, key)
      if (av === null) return bv === null ? a.area.name.localeCompare(b.area.name, 'pt-BR') : 1
      if (bv === null) return -1
      return (av - bv) * (descending ? -1 : 1) || a.area.name.localeCompare(b.area.name, 'pt-BR')
    })
}
