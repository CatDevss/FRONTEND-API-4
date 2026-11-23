import { describe, expect, it } from 'vitest'
import { isCarProperty, tooltipElement, tooltipRows } from '@/services/propertyTooltip'

describe('balão do imóvel do CAR', () => {
  it('reconhece imóvel pelo código CAR, sem diferenciar maiúsculas', () => {
    expect(isCarProperty({ COD_IMOVEL: 'PR-1' })).toBe(true)
    expect(isCarProperty({ cod_imovel: '  ' })).toBe(false)
    expect(isCarProperty({ nom_munici: 'Cambira' })).toBe(false)
    expect(isCarProperty(null)).toBe(false)
  })
  it('omite camada, arquivo, nom_tema e cod_tema (qualquer caixa) e campos vazios', () => {
    const rows = tooltipRows({
      CAMADA: 'x',
      Arquivo: 'y',
      NOM_TEMA: 'z',
      cod_tema: 'w',
      vazio: '',
      nulo: null,
      objeto: { a: 1 },
      cod_imovel: 'PR-1',
    })
    expect(rows).toEqual([{ label: 'Código CAR', value: 'PR-1' }])
  })
  it('põe código, município e área primeiro e formata números em pt-BR', () => {
    const rows = tooltipRows({
      situacao: 'AT',
      num_area: 1234.5678,
      nom_munici: 'Cambira',
      cod_imovel: 'PR-1',
    })
    expect(rows.map((row) => row.label)).toEqual(['Código CAR', 'Município', 'Área', 'Situação'])
    expect(rows[2]!.value).toBe('1.234,5678')
  })
  it('mostra campos desconhecidos com o nome original e limita a quantidade', () => {
    const many = Object.fromEntries(Array.from({ length: 12 }, (_, i) => [`campo_${i}`, i + 1]))
    expect(tooltipRows(many)).toHaveLength(8)
    expect(tooltipRows({ Outro_Campo: 'a' })[0]!.label).toBe('Outro_Campo')
  })
  it('nunca interpreta o valor do arquivo como HTML', () => {
    const element = tooltipElement([{ label: 'Município', value: '<img src=x onerror=alert(1)>' }])
    expect(element.querySelector('img')).toBeNull()
    expect(element.textContent).toContain('<img src=x onerror=alert(1)>')
  })
})