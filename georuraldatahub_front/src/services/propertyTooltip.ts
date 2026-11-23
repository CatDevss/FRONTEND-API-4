/** Balão exibido ao passar o mouse sobre um imóvel do CAR no mapa. */
export type Properties = Record<string, unknown> | null | undefined
export interface TooltipRow {
  label: string
  value: string
}

/** Campos do arquivo que não ajudam a identificar o imóvel. */
export const hiddenTooltipFields = ['camada', 'arquivo', 'nom_tema', 'cod_tema']

// Nomes de campo do SICAR; qualquer outro campo aparece com o próprio nome.
const labels: Record<string, string> = {
  cod_imovel: 'Código CAR',
  nom_munici: 'Município',
  municipio: 'Município',
  num_area: 'Área',
  cod_estado: 'UF',
  num_modulo: 'Módulos fiscais',
  tipo_imove: 'Tipo',
  situacao: 'Situação',
  condicao_i: 'Condição',
}
const firstFields = ['cod_imovel', 'nom_munici', 'municipio', 'num_area']
const numberFormat = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 4 })

function text(value: unknown): string {
  if (typeof value === 'number' && Number.isFinite(value)) return numberFormat.format(value)
  if (typeof value === 'boolean') return value ? 'Sim' : 'Não'
  if (typeof value === 'string') return value.trim()
  return ''
}
/** Só feições com código CAR são tratadas como imóvel. */
export function isCarProperty(properties: Properties): boolean {
  return Object.entries(properties ?? {}).some(
    ([key, value]) => key.toLowerCase() === 'cod_imovel' && text(value) !== '',
  )
}
export function tooltipRows(properties: Properties, max = 8): TooltipRow[] {
  const rows = Object.entries(properties ?? {})
    .map(([key, value]) => ({ key: key.toLowerCase(), original: key, value: text(value) }))
    .filter((row) => row.value !== '' && !hiddenTooltipFields.includes(row.key))
  const rank = (key: string) => {
    const index = firstFields.indexOf(key)
    return index === -1 ? firstFields.length : index
  }
  // sort é estável: os campos fora da lista mantêm a ordem do arquivo.
  return rows
    .sort((a, b) => rank(a.key) - rank(b.key))
    .slice(0, max)
    .map((row) => ({ label: labels[row.key] ?? row.original, value: row.value }))
}
/** Monta o balão com textContent: o valor vem do arquivo e nunca é lido como HTML. */
export function tooltipElement(rows: TooltipRow[]): HTMLElement {
  const root = document.createElement('div')
  root.className = 'property-tooltip-body'
  for (const row of rows) {
    const line = document.createElement('div')
    const label = document.createElement('span')
    const value = document.createElement('strong')
    label.textContent = row.label
    value.textContent = row.value
    line.append(label, value)
    root.append(line)
  }
  return root
}