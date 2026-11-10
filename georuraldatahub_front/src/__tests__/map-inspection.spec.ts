import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import type { Feature, Geometry, Position } from 'geojson'
import {
  featuresAt,
  indexFeatures,
  type HitQuery,
  type MapInspection,
} from '@/services/mapInspection'
import WorkspaceInspection from '@/components/workspace/WorkspaceInspection.vue'

const square = (a: number, b: number): Position[] => [
  [a, a],
  [b, a],
  [b, b],
  [a, b],
  [a, a],
]
const feature = (
  geometry: Geometry | null,
  properties: Feature['properties'] = {},
): Feature<Geometry | null> => ({
  type: 'Feature',
  geometry,
  properties,
})
function query(x: number, y: number, scale = 100): HitQuery {
  const tolerance = 7,
    margin = tolerance / scale
  return {
    longitude: x,
    latitude: y,
    bounds: [x - margin, y - margin, x + margin, y + margin],
    pixel: { x: x * scale, y: y * scale },
    tolerance,
    project: ([longitude, latitude]) => ({ x: longitude! * scale, y: latitude! * scale }),
  }
}
function find(features: Feature<Geometry | null>[], x: number, y: number, scale = 100) {
  return featuresAt(indexFeatures({ type: 'FeatureCollection', features }), query(x, y, scale))
}

describe('point inspection of geographic features', () => {
  it('finds every overlapping polygon including shared boundaries, independent of draw order', () => {
    const bioma = feature(
      { type: 'Polygon', coordinates: [square(0, 10)] },
      { bioma: 'Mata Atlântica' },
    )
    const provincia = feature(
      { type: 'Polygon', coordinates: [square(2, 8)] },
      { provincia: 'Paraná' },
    )
    expect(find([bioma, provincia], 5, 5)).toEqual([bioma, provincia])
    expect(find([provincia, bioma], 2, 5)).toEqual([provincia, bioma])
    expect(find([bioma, provincia], 11, 5)).toEqual([])
  })
  it('excludes polygon holes but includes their boundary and respects concavity', () => {
    const hole = feature({ type: 'Polygon', coordinates: [square(0, 10), square(3, 7)] })
    expect(find([hole], 5, 5)).toEqual([])
    expect(find([hole], 3, 5)).toEqual([hole])
    expect(find([hole], 1, 1)).toEqual([hole])
    const concave = feature({
      type: 'Polygon',
      coordinates: [
        [
          [0, 0],
          [5, 0],
          [5, 1],
          [1, 1],
          [1, 5],
          [0, 5],
          [0, 0],
        ],
      ],
    })
    expect(find([concave], 3, 3)).toEqual([])
    expect(find([concave], 0.5, 3)).toEqual([concave])
  })
  it('handles multipolygons and geometry collections once per feature', () => {
    const multi = feature({ type: 'MultiPolygon', coordinates: [[square(0, 2)], [square(4, 6)]] })
    const collection = feature({
      type: 'GeometryCollection',
      geometries: [
        { type: 'Polygon', coordinates: [square(4, 6)] },
        { type: 'Point', coordinates: [5, 5] },
      ],
    })
    expect(find([multi, collection], 5, 5)).toEqual([multi, collection])
    expect(find([multi], 3, 3)).toEqual([])
  })
  it('uses a screen-space tolerance for points and lines as zoom changes', () => {
    const point = feature({
      type: 'MultiPoint',
      coordinates: [
        [1, 1],
        [2, 2],
      ],
    })
    const line = feature({
      type: 'MultiLineString',
      coordinates: [
        [
          [0, 0],
          [3, 0],
        ],
        [
          [0, 1],
          [3, 1],
        ],
      ],
    })
    expect(find([point, line], 1, 1.06)).toEqual([point, line])
    expect(find([point, line], 1, 1.08)).toEqual([])
    expect(find([point, line], 1, 1.06, 200)).toEqual([])
    expect(find([line], 3.06, 1)).toEqual([line])
    expect(find([line], 3.08, 1)).toEqual([])
  })
  it('skips null and empty geometries and ignores an untrusted GeoJSON bbox', () => {
    const polygon = {
      ...feature({ type: 'Polygon', coordinates: [square(0, 2)] }),
      bbox: [100, 100, 101, 101] as [number, number, number, number],
    }
    expect(
      find([feature(null), feature({ type: 'GeometryCollection', geometries: [] }), polygon], 1, 1),
    ).toEqual([polygon])
  })
})

describe('inspection side panel', () => {
  const result: MapInspection = {
    latitude: -25,
    longitude: -49,
    pending: [],
    failed: [],
    groups: [
      {
        fileId: 1,
        name: 'Biomas',
        color: '#FF8A1F',
        features: [
          feature(null, {
            nome: '<img src=x onerror=alert(1)>',
            area: 0,
            ativo: false,
            extra: { codigo: '012' },
            ausente: null,
          }),
        ],
      },
      {
        fileId: 2,
        name: 'Províncias',
        color: '#00D5FF',
        features: [feature(null, { nome: 'Paraná' })],
      },
    ],
  }
  it('shows attributes from both layers as text and supports closing', async () => {
    const wrapper = mount(WorkspaceInspection, { props: { result } })
    expect(wrapper.findAll('.inspection-layer')).toHaveLength(2)
    expect(wrapper.text()).toContain('Biomas')
    expect(wrapper.text()).toContain('Províncias')
    expect(wrapper.text()).toContain('Paraná')
    expect(wrapper.text()).toContain('<img src=x onerror=alert(1)>')
    expect(wrapper.find('img').exists()).toBe(false)
    expect(wrapper.findAll('dd').map((dd) => dd.text())).toEqual([
      '<img src=x onerror=alert(1)>',
      '0',
      'false',
      '{"codigo":"012"}',
      '—',
      'Paraná',
    ])
    await wrapper.get('button[aria-label="Fechar informações do local"]').trigger('click')
    expect(wrapper.emitted('close')).toHaveLength(1)
    wrapper.unmount()
  })
  it('keeps all matches accessible in batches and resets on a different location', async () => {
    const many = {
      ...result,
      groups: [
        {
          ...result.groups[0]!,
          features: Array.from({ length: 25 }, (_, id) => ({ ...feature(null, {}), id })),
        },
      ],
    }
    const wrapper = mount(WorkspaceInspection, { props: { result: many } })
    expect(wrapper.findAll('details')).toHaveLength(20)
    await wrapper.get('.show-more').trigger('click')
    expect(wrapper.findAll('details')).toHaveLength(25)
    await wrapper.setProps({ result: { ...many, latitude: -24 } })
    expect(wrapper.findAll('details')).toHaveLength(20)
    await wrapper.setProps({
      result: { ...result, groups: [], pending: ['Biomas'], failed: ['Províncias'] },
    })
    expect(wrapper.text()).toContain('Carregando Biomas')
    expect(wrapper.text()).toContain('Não foi possível consultar: Províncias')
    expect(wrapper.find('.inspection-empty').exists()).toBe(false)
    wrapper.unmount()
  })
})
