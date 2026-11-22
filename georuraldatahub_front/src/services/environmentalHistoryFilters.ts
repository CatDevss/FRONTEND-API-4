export interface HistoryFilters {
  camadaId?: number
  inicio?: string
  fim?: string
}

export function historyFilterError(filters: HistoryFilters): string {
  for (const date of [filters.inicio, filters.fim]) {
    if (!date) continue
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || date.startsWith('0000'))
      return 'Informe uma data válida.'
    const parsed = new Date(`${date}T00:00:00Z`)
    if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date)
      return 'Informe uma data válida.'
  }
  if (filters.inicio && filters.fim && filters.inicio > filters.fim)
    return 'O início deve ser anterior ou igual ao fim.'
  return ''
}
